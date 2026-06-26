import { getPool, sql } from "../db/mssql.js";
import { panoramaApiUrl, processPanoramaBuffer } from "../utils/panoramas.js";

function isValidId(n) {
  return Number.isInteger(n) && n > 0;
}

function num(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function ensureTourSchema(pool) {
  await pool.request().query(`
    IF OBJECT_ID('PropertyVirtualTours', 'U') IS NULL
    BEGIN
      CREATE TABLE PropertyVirtualTours (
        TourId INT IDENTITY(1,1) PRIMARY KEY,
        PropertyId INT NOT NULL,
        Title NVARCHAR(200) NULL,
        StartRoomId INT NULL,
        IsPublished BIT NOT NULL DEFAULT 0,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
      );
      CREATE UNIQUE INDEX UX_PropertyVirtualTours_PropertyId ON PropertyVirtualTours(PropertyId);
    END

    IF OBJECT_ID('VirtualTourRooms', 'U') IS NULL
    BEGIN
      CREATE TABLE VirtualTourRooms (
        RoomId INT IDENTITY(1,1) PRIMARY KEY,
        TourId INT NOT NULL,
        Label NVARCHAR(200) NOT NULL,
        PanoramaImageData VARBINARY(MAX) NOT NULL,
        PanoramaMimeType NVARCHAR(100) NOT NULL,
        PanoramaWidth INT NULL,
        PanoramaHeight INT NULL,
        SortOrder INT NOT NULL DEFAULT 0,
        InitialYaw FLOAT NOT NULL DEFAULT 0,
        InitialPitch FLOAT NOT NULL DEFAULT 0,
        CompassOffset FLOAT NOT NULL DEFAULT 0,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_VirtualTourRooms_Tour FOREIGN KEY (TourId)
          REFERENCES PropertyVirtualTours(TourId) ON DELETE CASCADE
      );
    END

    IF OBJECT_ID('VirtualTourHotspots', 'U') IS NULL
    BEGIN
      CREATE TABLE VirtualTourHotspots (
        HotspotId INT IDENTITY(1,1) PRIMARY KEY,
        FromRoomId INT NOT NULL,
        ToRoomId INT NOT NULL,
        Label NVARCHAR(200) NULL,
        Yaw FLOAT NOT NULL DEFAULT 0,
        Pitch FLOAT NOT NULL DEFAULT 0,
        SortOrder INT NOT NULL DEFAULT 0,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_VirtualTourHotspots_FromRoom FOREIGN KEY (FromRoomId)
          REFERENCES VirtualTourRooms(RoomId) ON DELETE CASCADE
      );
    END
  `);
}

async function getOrCreateTour(pool, propertyId, title = "Virtual Tour") {
  await ensureTourSchema(pool);
  const existing = await pool.request().input("propertyId", sql.Int, propertyId).query(`
    SELECT TOP 1 * FROM PropertyVirtualTours WHERE PropertyId=@propertyId
  `);
  if (existing.recordset[0]) return existing.recordset[0];

  const created = await pool
    .request()
    .input("propertyId", sql.Int, propertyId)
    .input("title", sql.NVarChar(200), title)
    .query(`
      INSERT INTO PropertyVirtualTours (PropertyId, Title)
      OUTPUT INSERTED.*
      VALUES (@propertyId, @title)
    `);
  return created.recordset[0];
}

function shapeTour(tour, rooms, hotspots) {
  if (!tour) return null;
  return {
    tourId: tour.TourId,
    propertyId: tour.PropertyId,
    title: tour.Title || "Virtual Tour",
    startRoomId: tour.StartRoomId,
    isPublished: !!tour.IsPublished,
    rooms: rooms.map((room) => ({
      roomId: room.RoomId,
      tourId: room.TourId,
      label: room.Label,
      panoramaUrl: panoramaApiUrl(room.RoomId),
      panoramaWidth: room.PanoramaWidth,
      panoramaHeight: room.PanoramaHeight,
      sortOrder: room.SortOrder ?? 0,
      initialYaw: room.InitialYaw ?? 0,
      initialPitch: room.InitialPitch ?? 0,
      compassOffset: room.CompassOffset ?? 0,
      hotspots: hotspots
        .filter((hotspot) => hotspot.FromRoomId === room.RoomId)
        .map((hotspot) => ({
          hotspotId: hotspot.HotspotId,
          fromRoomId: hotspot.FromRoomId,
          toRoomId: hotspot.ToRoomId,
          label: hotspot.Label || "",
          yaw: hotspot.Yaw ?? 0,
          pitch: hotspot.Pitch ?? 0,
          sortOrder: hotspot.SortOrder ?? 0,
        })),
    })),
  };
}

async function loadTourByProperty(pool, propertyId) {
  await ensureTourSchema(pool);
  const tourResult = await pool.request().input("propertyId", sql.Int, propertyId).query(`
    SELECT TOP 1 * FROM PropertyVirtualTours WHERE PropertyId=@propertyId
  `);
  const tour = tourResult.recordset[0];
  if (!tour) return null;

  const roomsResult = await pool.request().input("tourId", sql.Int, tour.TourId).query(`
    SELECT RoomId, TourId, Label, PanoramaMimeType, PanoramaWidth, PanoramaHeight,
           SortOrder, InitialYaw, InitialPitch, CompassOffset
    FROM VirtualTourRooms
    WHERE TourId=@tourId
    ORDER BY SortOrder ASC, RoomId ASC
  `);
  const roomIds = roomsResult.recordset.map((room) => room.RoomId);
  if (!roomIds.length) return shapeTour(tour, [], []);

  const hotspotsResult = await pool.request().input("tourId", sql.Int, tour.TourId).query(`
    SELECT h.*
    FROM VirtualTourHotspots h
    INNER JOIN VirtualTourRooms r ON r.RoomId = h.FromRoomId
    WHERE r.TourId=@tourId
    ORDER BY h.SortOrder ASC, h.HotspotId ASC
  `);
  return shapeTour(tour, roomsResult.recordset, hotspotsResult.recordset);
}

export async function GetTourByProperty(req, res) {
  const propertyId = Number(req.params.propertyId);
  if (!isValidId(propertyId)) return res.status(400).json({ error: "Invalid propertyId" });

  try {
    const pool = await getPool();
    const tour = await loadTourByProperty(pool, propertyId);
    res.json(tour || { propertyId, rooms: [], isPublished: false });
  } catch (err) {
    console.error("GetTourByProperty error:", err);
    res.status(500).json({ error: "Server error" });
  }
}

export async function CreateOrUpdateTour(req, res) {
  const propertyId = Number(req.params.propertyId);
  if (!isValidId(propertyId)) return res.status(400).json({ error: "Invalid propertyId" });

  try {
    const pool = await getPool();
    const tour = await getOrCreateTour(pool, propertyId, req.body?.title || "Virtual Tour");
    await pool
      .request()
      .input("tourId", sql.Int, tour.TourId)
      .input("title", sql.NVarChar(200), req.body?.title || tour.Title || "Virtual Tour")
      .input("startRoomId", sql.Int, Number(req.body?.startRoomId) || null)
      .input("isPublished", sql.Bit, !!req.body?.isPublished)
      .query(`
        UPDATE PropertyVirtualTours
        SET Title=@title, StartRoomId=@startRoomId, IsPublished=@isPublished, UpdatedAt=SYSUTCDATETIME()
        WHERE TourId=@tourId
      `);

    const updated = await loadTourByProperty(pool, propertyId);
    res.json(updated);
  } catch (err) {
    console.error("CreateOrUpdateTour error:", err);
    res.status(500).json({ error: "Server error" });
  }
}

export async function AddRoom(req, res) {
  const propertyId = Number(req.params.propertyId);
  if (!isValidId(propertyId)) return res.status(400).json({ error: "Invalid propertyId" });
  if (!req.file?.buffer) return res.status(400).json({ error: "Panorama file is required" });

  try {
    const pool = await getPool();
    const tour = await getOrCreateTour(pool, propertyId);
    const processed = await processPanoramaBuffer(req.file.buffer);
    const orderResult = await pool.request().input("tourId", sql.Int, tour.TourId).query(`
      SELECT COALESCE(MAX(SortOrder), -1) + 1 AS NextSortOrder
      FROM VirtualTourRooms
      WHERE TourId=@tourId
    `);
    const sortOrder = orderResult.recordset[0]?.NextSortOrder ?? 0;
    const label = req.body?.label || `Room ${sortOrder + 1}`;

    const inserted = await pool
      .request()
      .input("tourId", sql.Int, tour.TourId)
      .input("label", sql.NVarChar(200), label)
      .input("imageData", sql.VarBinary(sql.MAX), processed.buffer)
      .input("mimeType", sql.NVarChar(100), processed.mimeType)
      .input("width", sql.Int, processed.width)
      .input("height", sql.Int, processed.height)
      .input("sortOrder", sql.Int, sortOrder)
      .query(`
        INSERT INTO VirtualTourRooms
          (TourId, Label, PanoramaImageData, PanoramaMimeType, PanoramaWidth, PanoramaHeight, SortOrder)
        OUTPUT INSERTED.RoomId
        VALUES
          (@tourId, @label, @imageData, @mimeType, @width, @height, @sortOrder)
      `);

    if (!tour.StartRoomId) {
      await pool
        .request()
        .input("tourId", sql.Int, tour.TourId)
        .input("roomId", sql.Int, inserted.recordset[0].RoomId)
        .query(`UPDATE PropertyVirtualTours SET StartRoomId=@roomId WHERE TourId=@tourId`);
    }

    const updated = await loadTourByProperty(pool, propertyId);
    res.json(updated);
  } catch (err) {
    console.error("AddRoom error:", err);
    res.status(500).json({ error: "Server error" });
  }
}

export async function UpdateRooms(req, res) {
  const tourId = Number(req.params.tourId);
  if (!isValidId(tourId)) return res.status(400).json({ error: "Invalid tourId" });
  const rooms = Array.isArray(req.body?.rooms) ? req.body.rooms : [];

  try {
    const pool = await getPool();
    await ensureTourSchema(pool);
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      for (let index = 0; index < rooms.length; index += 1) {
        const room = rooms[index];
        await new sql.Request(tx)
          .input("tourId", sql.Int, tourId)
          .input("roomId", sql.Int, Number(room.roomId))
          .input("label", sql.NVarChar(200), room.label || `Room ${index + 1}`)
          .input("sortOrder", sql.Int, index)
          .input("initialYaw", sql.Float, num(room.initialYaw))
          .input("initialPitch", sql.Float, num(room.initialPitch))
          .input("compassOffset", sql.Float, num(room.compassOffset))
          .query(`
            UPDATE VirtualTourRooms
            SET Label=@label,
                SortOrder=@sortOrder,
                InitialYaw=@initialYaw,
                InitialPitch=@initialPitch,
                CompassOffset=@compassOffset,
                UpdatedAt=SYSUTCDATETIME()
            WHERE TourId=@tourId AND RoomId=@roomId
          `);
      }
      await new sql.Request(tx)
        .input("tourId", sql.Int, tourId)
        .input("startRoomId", sql.Int, Number(req.body?.startRoomId) || null)
        .input("title", sql.NVarChar(200), req.body?.title || "Virtual Tour")
        .input("isPublished", sql.Bit, !!req.body?.isPublished)
        .query(`
          UPDATE PropertyVirtualTours
          SET StartRoomId=@startRoomId, Title=@title, IsPublished=@isPublished, UpdatedAt=SYSUTCDATETIME()
          WHERE TourId=@tourId
        `);
      await tx.commit();
    } catch (err) {
      await tx.rollback();
      throw err;
    }

    const propertyResult = await pool.request().input("tourId", sql.Int, tourId).query(`
      SELECT PropertyId FROM PropertyVirtualTours WHERE TourId=@tourId
    `);
    const updated = await loadTourByProperty(pool, propertyResult.recordset[0]?.PropertyId);
    res.json(updated);
  } catch (err) {
    console.error("UpdateRooms error:", err);
    res.status(500).json({ error: "Server error" });
  }
}

export async function DeleteRoom(req, res) {
  const roomId = Number(req.params.roomId);
  if (!isValidId(roomId)) return res.status(400).json({ error: "Invalid roomId" });

  try {
    const pool = await getPool();
    await ensureTourSchema(pool);
    await pool.request().input("roomId", sql.Int, roomId).query(`
      DELETE FROM VirtualTourHotspots WHERE FromRoomId=@roomId OR ToRoomId=@roomId;
      UPDATE PropertyVirtualTours SET StartRoomId=NULL WHERE StartRoomId=@roomId;
      DELETE FROM VirtualTourRooms WHERE RoomId=@roomId;
    `);
    res.status(204).send();
  } catch (err) {
    console.error("DeleteRoom error:", err);
    res.status(500).json({ error: "Server error" });
  }
}

export async function AddHotspot(req, res) {
  const fromRoomId = Number(req.params.fromRoomId);
  if (!isValidId(fromRoomId)) return res.status(400).json({ error: "Invalid fromRoomId" });
  const toRoomId = Number(req.body?.toRoomId);
  if (!isValidId(toRoomId)) return res.status(400).json({ error: "Invalid toRoomId" });

  try {
    const pool = await getPool();
    await ensureTourSchema(pool);
    const order = await pool.request().input("fromRoomId", sql.Int, fromRoomId).query(`
      SELECT COALESCE(MAX(SortOrder), -1) + 1 AS NextSortOrder
      FROM VirtualTourHotspots
      WHERE FromRoomId=@fromRoomId
    `);
    const result = await pool
      .request()
      .input("fromRoomId", sql.Int, fromRoomId)
      .input("toRoomId", sql.Int, toRoomId)
      .input("label", sql.NVarChar(200), req.body?.label || "Go")
      .input("yaw", sql.Float, num(req.body?.yaw))
      .input("pitch", sql.Float, num(req.body?.pitch))
      .input("sortOrder", sql.Int, order.recordset[0]?.NextSortOrder ?? 0)
      .query(`
        INSERT INTO VirtualTourHotspots (FromRoomId, ToRoomId, Label, Yaw, Pitch, SortOrder)
        OUTPUT INSERTED.*
        VALUES (@fromRoomId, @toRoomId, @label, @yaw, @pitch, @sortOrder)
      `);
    res.json(result.recordset[0]);
  } catch (err) {
    console.error("AddHotspot error:", err);
    res.status(500).json({ error: "Server error" });
  }
}

export async function UpdateHotspots(req, res) {
  const roomId = Number(req.params.roomId);
  if (!isValidId(roomId)) return res.status(400).json({ error: "Invalid roomId" });
  const hotspots = Array.isArray(req.body?.hotspots) ? req.body.hotspots : [];

  try {
    const pool = await getPool();
    await ensureTourSchema(pool);
    const keepIds = hotspots.map((hotspot) => Number(hotspot.hotspotId)).filter(isValidId);
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      if (keepIds.length) {
        await new sql.Request(tx)
          .input("roomId", sql.Int, roomId)
          .input("ids", sql.NVarChar(sql.MAX), keepIds.join(","))
          .query(`
            DELETE FROM VirtualTourHotspots
            WHERE FromRoomId=@roomId
              AND CHARINDEX(',' + CAST(HotspotId AS NVARCHAR(20)) + ',', ',' + @ids + ',') = 0
          `);
      } else {
        await new sql.Request(tx).input("roomId", sql.Int, roomId).query(`
          DELETE FROM VirtualTourHotspots WHERE FromRoomId=@roomId
        `);
      }

      for (let index = 0; index < hotspots.length; index += 1) {
        const hotspot = hotspots[index];
        await new sql.Request(tx)
          .input("roomId", sql.Int, roomId)
          .input("hotspotId", sql.Int, Number(hotspot.hotspotId))
          .input("toRoomId", sql.Int, Number(hotspot.toRoomId))
          .input("label", sql.NVarChar(200), hotspot.label || "")
          .input("yaw", sql.Float, num(hotspot.yaw))
          .input("pitch", sql.Float, num(hotspot.pitch))
          .input("sortOrder", sql.Int, index)
          .query(`
            UPDATE VirtualTourHotspots
            SET ToRoomId=@toRoomId,
                Label=@label,
                Yaw=@yaw,
                Pitch=@pitch,
                SortOrder=@sortOrder,
                UpdatedAt=SYSUTCDATETIME()
            WHERE FromRoomId=@roomId AND HotspotId=@hotspotId
          `);
      }
      await tx.commit();
      res.json({ message: "Hotspots updated" });
    } catch (err) {
      await tx.rollback();
      throw err;
    }
  } catch (err) {
    console.error("UpdateHotspots error:", err);
    res.status(500).json({ error: "Server error" });
  }
}

export async function DeleteHotspot(req, res) {
  const hotspotId = Number(req.params.hotspotId);
  if (!isValidId(hotspotId)) return res.status(400).json({ error: "Invalid hotspotId" });

  try {
    const pool = await getPool();
    await pool.request().input("hotspotId", sql.Int, hotspotId).query(`
      DELETE FROM VirtualTourHotspots WHERE HotspotId=@hotspotId
    `);
    res.status(204).send();
  } catch (err) {
    console.error("DeleteHotspot error:", err);
    res.status(500).json({ error: "Server error" });
  }
}

export async function GetPanorama(req, res) {
  const roomId = Number(req.params.roomId);
  if (!isValidId(roomId)) return res.status(400).json({ error: "Invalid roomId" });

  try {
    const pool = await getPool();
    await ensureTourSchema(pool);
    const result = await pool.request().input("roomId", sql.Int, roomId).query(`
      SELECT TOP 1 PanoramaImageData, PanoramaMimeType
      FROM VirtualTourRooms
      WHERE RoomId=@roomId
    `);
    const row = result.recordset[0];
    if (!row?.PanoramaImageData) return res.status(404).json({ error: "Panorama not found" });
    res.set("Content-Type", row.PanoramaMimeType || "image/jpeg");
    res.set("Cache-Control", "public, max-age=31536000, immutable");
    res.send(Buffer.from(row.PanoramaImageData));
  } catch (err) {
    console.error("GetPanorama error:", err);
    res.status(500).json({ error: "Server error" });
  }
}
