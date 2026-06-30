import { getPool, sql } from "../db/mssql.js";
import { rowsToProperties } from "../utils/shape.js";
import {
  apiOrigin,
  imageApiUrl,
  preferredImageUrl,
  processImageBuffer,
  remoteImageToRecord,
} from "../utils/images.js";

const SITE_ORIGIN = process.env.PUBLIC_SITE_ORIGIN || "https://www.realo-realestate.com";

function isValidId(n) {
  return Number.isInteger(n) && n > 0;
}

function sendControllerError(res, err, fallback = "Server error") {
  const status = Number(err?.statusCode) || 500;
  res.status(status).json({ error: err?.publicMessage || (status < 500 ? err?.message : fallback) || fallback });
}

function escapeHtml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function toAbsoluteUrl(url) {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  return `${SITE_ORIGIN}${url.startsWith("/") ? "" : "/"}${url}`;
}

function buildPropertyUrl(title, id) {
  return `${SITE_ORIGIN}/properties/${encodeURIComponent(title || "Property")}/${id}`;
}

function floorPlanApiUrl(propertyId) {
  if (!propertyId) return "";
  return `${apiOrigin()}/api/Property/GetFloorPlanImage/${propertyId}`;
}

async function ensureSchema(pool) {
  await pool.request().query(`
    IF OBJECT_ID('Properties', 'U') IS NULL
    BEGIN
      CREATE TABLE Properties (
        PropertyId INT IDENTITY(1,1) PRIMARY KEY,
        Title NVARCHAR(200) NOT NULL,
        Description NVARCHAR(MAX) NULL,
        Address NVARCHAR(255) NULL,
        City NVARCHAR(100) NULL,
        PropertyType NVARCHAR(50) NULL,
        IsForSale BIT NOT NULL DEFAULT 0,
        IsForRent BIT NOT NULL DEFAULT 0,
        Price NVARCHAR(100) NULL,
        Bedrooms INT NULL,
        Bathrooms INT NULL,
        SquareFeet INT NULL,
        HasOwnershipDocument BIT NOT NULL DEFAULT 0,
        Furniture NVARCHAR(100) NULL,
        FloorPlanUrl NVARCHAR(1000) NULL,
        VirtualTourUrl NVARCHAR(1000) NULL,
        Latitude FLOAT NULL,
        Longitude FLOAT NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
      );
    END
    IF COL_LENGTH('Properties', 'CreatedAt') IS NULL
      ALTER TABLE Properties ADD CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME();
    IF COL_LENGTH('Properties', 'UpdatedAt') IS NULL
      ALTER TABLE Properties ADD UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME();
    IF COL_LENGTH('Properties', 'FloorPlanImageData') IS NULL
      ALTER TABLE Properties ADD FloorPlanImageData VARBINARY(MAX) NULL;
    IF COL_LENGTH('Properties', 'FloorPlanMimeType') IS NULL
      ALTER TABLE Properties ADD FloorPlanMimeType NVARCHAR(100) NULL;
    IF COL_LENGTH('Properties', 'FloorPlanOriginalName') IS NULL
      ALTER TABLE Properties ADD FloorPlanOriginalName NVARCHAR(255) NULL;
    IF COL_LENGTH('Properties', 'FloorPlanWidth') IS NULL
      ALTER TABLE Properties ADD FloorPlanWidth INT NULL;
    IF COL_LENGTH('Properties', 'FloorPlanHeight') IS NULL
      ALTER TABLE Properties ADD FloorPlanHeight INT NULL;

    IF OBJECT_ID('PropertiesImage', 'U') IS NULL
    BEGIN
      CREATE TABLE PropertiesImage (
        ImageId INT IDENTITY(1,1) PRIMARY KEY,
        PropertyId INT NOT NULL,
        ImageUrl NVARCHAR(1000) NULL,
        OriginalUrl NVARCHAR(1000) NULL,
        ImageData VARBINARY(MAX) NULL,
        MimeType NVARCHAR(100) NULL,
        Width INT NULL,
        Height INT NULL,
        SortOrder INT NOT NULL DEFAULT 0,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_PropertiesImage_Properties FOREIGN KEY (PropertyId)
          REFERENCES Properties(PropertyId) ON DELETE CASCADE
      );
    END

    IF COL_LENGTH('PropertiesImage', 'OriginalUrl') IS NULL
      ALTER TABLE PropertiesImage ADD OriginalUrl NVARCHAR(1000) NULL;
    IF COL_LENGTH('PropertiesImage', 'ImageData') IS NULL
      ALTER TABLE PropertiesImage ADD ImageData VARBINARY(MAX) NULL;
    IF COL_LENGTH('PropertiesImage', 'MimeType') IS NULL
      ALTER TABLE PropertiesImage ADD MimeType NVARCHAR(100) NULL;
    IF COL_LENGTH('PropertiesImage', 'Width') IS NULL
      ALTER TABLE PropertiesImage ADD Width INT NULL;
    IF COL_LENGTH('PropertiesImage', 'Height') IS NULL
      ALTER TABLE PropertiesImage ADD Height INT NULL;
    IF COL_LENGTH('PropertiesImage', 'SortOrder') IS NULL
      ALTER TABLE PropertiesImage ADD SortOrder INT NOT NULL DEFAULT 0;

    IF OBJECT_ID('PropertyVirtualTours', 'U') IS NULL
    BEGIN
      CREATE TABLE PropertyVirtualTours (
        TourId INT IDENTITY(1,1) PRIMARY KEY,
        PropertyId INT NOT NULL,
        Title NVARCHAR(200) NULL,
        StartRoomId INT NULL,
        IsPublished BIT NOT NULL DEFAULT 0,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_PropertyVirtualTours_Properties FOREIGN KEY (PropertyId)
          REFERENCES Properties(PropertyId) ON DELETE CASCADE
      );
      CREATE UNIQUE INDEX UX_PropertyVirtualTours_PropertyId ON PropertyVirtualTours(PropertyId);
    END

    IF OBJECT_ID('VirtualTourRooms', 'U') IS NULL
    BEGIN
      CREATE TABLE VirtualTourRooms (
        RoomId INT IDENTITY(1,1) PRIMARY KEY,
        TourId INT NOT NULL,
        Label NVARCHAR(120) NOT NULL,
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
        CONSTRAINT FK_VirtualTourRooms_Tours FOREIGN KEY (TourId)
          REFERENCES PropertyVirtualTours(TourId) ON DELETE CASCADE
      );
    END
  `);
}

async function insertPropertyImages(tx, propertyId, images) {
  if (!images?.length) return;
  for (let index = 0; index < images.length; index += 1) {
    const image = images[index];
    const sourceUrl = image?.OriginalUrl || image?.originalUrl || image?.ImageUrl || image?.imageUrl || "";
    const processed = /^https?:\/\//i.test(sourceUrl) ? await remoteImageToRecord(sourceUrl) : null;
    const request = new sql.Request(tx);
    request
      .input("PropertyId", sql.Int, propertyId)
      .input("ImageUrl", sql.NVarChar(1000), processed?.originalUrl || sourceUrl || "pending")
      .input("OriginalUrl", sql.NVarChar(1000), processed?.originalUrl || sourceUrl || null)
      .input("ImageData", sql.VarBinary(sql.MAX), processed?.buffer || image.ImageData || null)
      .input("MimeType", sql.NVarChar(100), processed?.mimeType || image.MimeType || null)
      .input("Width", sql.Int, processed?.width || image.Width || null)
      .input("Height", sql.Int, processed?.height || image.Height || null)
      .input("SortOrder", sql.Int, image.SortOrder ?? index);
    const inserted = await request.query(`
      INSERT INTO PropertiesImage
        (PropertyId, ImageUrl, OriginalUrl, ImageData, MimeType, Width, Height, SortOrder)
      OUTPUT INSERTED.ImageId
      VALUES
        (@PropertyId, @ImageUrl, @OriginalUrl, @ImageData, @MimeType, @Width, @Height, @SortOrder)
    `);
    const imageId = inserted.recordset[0]?.ImageId;
    if (imageId && processed?.buffer) {
      await new sql.Request(tx)
        .input("imageId", sql.Int, imageId)
        .input("imageUrl", sql.NVarChar(1000), imageApiUrl(imageId))
        .query(`UPDATE PropertiesImage SET ImageUrl=@imageUrl WHERE ImageId=@imageId`);
    }
  }
}

function normalizeProperty(property) {
  const images = Array.isArray(property.images) ? property.images : [];
  const sortedImages = images.slice().sort((a, b) => (a.SortOrder ?? a.sortOrder ?? 0) - (b.SortOrder ?? b.sortOrder ?? 0));
  return {
    ...property,
    images: sortedImages,
    galleryImages: sortedImages.map((image) => preferredImageUrl(image)).filter(Boolean),
    heroImage:
      property.heroImage ||
      preferredImageUrl(sortedImages.find((image) => (image.SortOrder ?? image.sortOrder ?? 0) === 0)) ||
      preferredImageUrl(sortedImages[0]) ||
      "",
  };
}

async function loadPropertyById(pool, id) {
  const result = await pool.request().input("id", sql.Int, id).query(`
    SELECT p.*, i.ImageId, i.ImageUrl, i.OriginalUrl,
           CASE WHEN i.ImageData IS NULL THEN CAST(0 AS bit) ELSE CAST(1 AS bit) END AS HasImageData,
           i.MimeType, i.Width, i.Height, i.SortOrder,
           vt.TourId AS VirtualTourId,
           ISNULL(vt.RoomCount, 0) AS VirtualTourRoomCount,
           CASE WHEN vt.TourId IS NOT NULL AND ISNULL(vt.RoomCount, 0) > 0 THEN CAST(1 AS bit) ELSE CAST(0 AS bit) END AS HasInternalVirtualTour,
           CASE WHEN vt.IsPublished = 1 AND ISNULL(vt.RoomCount, 0) > 0 THEN CAST(1 AS bit) ELSE CAST(0 AS bit) END AS HasPublishedVirtualTour
    FROM Properties p
    LEFT JOIN PropertiesImage i ON i.PropertyId = p.PropertyId
    OUTER APPLY (
      SELECT TOP 1 t.TourId, t.IsPublished,
             (SELECT COUNT(*) FROM VirtualTourRooms r WHERE r.TourId = t.TourId) AS RoomCount
      FROM PropertyVirtualTours t
      WHERE t.PropertyId = p.PropertyId
      ORDER BY t.UpdatedAt DESC, t.TourId DESC
    ) vt
    WHERE p.PropertyId = @id
    ORDER BY i.SortOrder ASC, i.ImageId ASC
  `);
  const items = rowsToProperties(result.recordset || []);
  return items[0] ? normalizeProperty(items[0]) : null;
}

export async function GetProperties(_req, res) {
  try {
    const pool = await getPool();
    await ensureSchema(pool);
    const result = await pool.request().query(`
      SELECT p.*, i.ImageId, i.ImageUrl, i.OriginalUrl,
             CASE WHEN i.ImageData IS NULL THEN CAST(0 AS bit) ELSE CAST(1 AS bit) END AS HasImageData,
             i.MimeType, i.Width, i.Height, i.SortOrder,
             vt.TourId AS VirtualTourId,
             ISNULL(vt.RoomCount, 0) AS VirtualTourRoomCount,
             CASE WHEN vt.TourId IS NOT NULL AND ISNULL(vt.RoomCount, 0) > 0 THEN CAST(1 AS bit) ELSE CAST(0 AS bit) END AS HasInternalVirtualTour,
             CASE WHEN vt.IsPublished = 1 AND ISNULL(vt.RoomCount, 0) > 0 THEN CAST(1 AS bit) ELSE CAST(0 AS bit) END AS HasPublishedVirtualTour
      FROM Properties p
      LEFT JOIN PropertiesImage i ON i.PropertyId = p.PropertyId
      OUTER APPLY (
        SELECT TOP 1 t.TourId, t.IsPublished,
               (SELECT COUNT(*) FROM VirtualTourRooms r WHERE r.TourId = t.TourId) AS RoomCount
        FROM PropertyVirtualTours t
        WHERE t.PropertyId = p.PropertyId
        ORDER BY t.UpdatedAt DESC, t.TourId DESC
      ) vt
      ORDER BY p.PropertyId DESC, i.SortOrder ASC, i.ImageId ASC
    `);
    res.json(rowsToProperties(result.recordset || []).map(normalizeProperty));
  } catch (err) {
    console.error("GetProperties error:", err);
    res.status(500).json({ error: "Server error" });
  }
}

export async function GetProperty(req, res) {
  const id = Number(req.params.id);
  if (!isValidId(id)) return res.status(400).json({ error: "Invalid id" });

  try {
    const pool = await getPool();
    await ensureSchema(pool);
    const property = await loadPropertyById(pool, id);
    if (!property) return res.status(404).json({ error: "Not found" });
    res.json(property);
  } catch (err) {
    console.error("GetProperty error:", err);
    res.status(500).json({ error: "Server error" });
  }
}

export async function ShareProperty(req, res) {
  const id = Number(req.params.id);
  if (!isValidId(id)) return res.status(400).send("Invalid id");

  try {
    const pool = await getPool();
    await ensureSchema(pool);
    const property = await loadPropertyById(pool, id);
    if (!property) return res.status(404).send("Not found");

    const title = escapeHtml(property.title || "Property");
    const description = escapeHtml(
      [property.city, property.price ? `€${String(property.price).replace(/^€\s*/, "")}` : ""]
        .filter(Boolean)
        .join(" • ") || "View property",
    );
    const ogImage = escapeHtml(toAbsoluteUrl(property.galleryImages[0] || property.heroImage || `${SITE_ORIGIN}/og.png`));
    const redirectUrl = buildPropertyUrl(property.title, id);

    res.set("Content-Type", "text/html; charset=utf-8");
    return res.send(`<!doctype html><html><head>
      <meta charset="utf-8" />
      <meta http-equiv="refresh" content="0;url=${redirectUrl}" />
      <meta property="og:type" content="website" />
      <meta property="og:title" content="${title}" />
      <meta property="og:description" content="${description}" />
      <meta property="og:image" content="${ogImage}" />
    </head><body></body></html>`);
  } catch (err) {
    console.error("ShareProperty error:", err);
    res.status(500).send("Server error");
  }
}

export async function PostProperty(req, res) {
  const p = req.body;

  try {
    const pool = await getPool();
    await ensureSchema(pool);
    const tx = new sql.Transaction(pool);
    await tx.begin();

    try {
      const insert = await new sql.Request(tx)
        .input("Title", sql.NVarChar(200), p.title ?? "")
        .input("Description", sql.NVarChar(sql.MAX), p.description ?? "")
        .input("Address", sql.NVarChar(255), p.address ?? "")
        .input("City", sql.NVarChar(100), p.city ?? "")
        .input("PropertyType", sql.NVarChar(50), p.propertyType ?? "")
        .input("IsForSale", sql.Bit, !!p.isForSale)
        .input("IsForRent", sql.Bit, !!p.isForRent)
        .input("Price", sql.NVarChar(100), String(p.price ?? ""))
        .input("Bedrooms", sql.Int, Number(p.bedrooms) || null)
        .input("Bathrooms", sql.Int, Number(p.bathrooms) || null)
        .input("SquareFeet", sql.Int, Number(p.squareFeet) || null)
        .input("HasOwnershipDocument", sql.Bit, !!p.hasOwnershipDocument)
        .input("Furniture", sql.NVarChar(100), p.furniture ?? "")
        .input("FloorPlanUrl", sql.NVarChar(1000), p.floorPlanUrl ?? "")
        .input("VirtualTourUrl", sql.NVarChar(1000), p.virtualTourUrl ?? "")
        .input("Latitude", sql.Float, Number(p.latitude) || null)
        .input("Longitude", sql.Float, Number(p.longitude) || null).query(`
          INSERT INTO Properties
            (Title, Description, Address, City, PropertyType, IsForSale, IsForRent,
             Price, Bedrooms, Bathrooms, SquareFeet, HasOwnershipDocument, Furniture,
             FloorPlanUrl, VirtualTourUrl, Latitude, Longitude)
          OUTPUT INSERTED.PropertyId
          VALUES
            (@Title, @Description, @Address, @City, @PropertyType, @IsForSale, @IsForRent,
             @Price, @Bedrooms, @Bathrooms, @SquareFeet, @HasOwnershipDocument, @Furniture,
             @FloorPlanUrl, @VirtualTourUrl, @Latitude, @Longitude)
        `);

      const newId = insert.recordset[0].PropertyId;
      await insertPropertyImages(tx, newId, Array.isArray(p.images) ? p.images : []);
      await tx.commit();
      res.status(200).json({ message: "OK", propertyId: newId });
    } catch (err) {
      await tx.rollback();
      throw err;
    }
  } catch (err) {
    console.error("PostProperty error:", err);
    res.status(500).json({ error: "Server error" });
  }
}

export async function PutProperty(req, res) {
  const id = Number(req.params.id);
  if (!isValidId(id)) return res.status(400).json({ error: "Invalid id" });

  const p = req.body;

  try {
    const pool = await getPool();
    await ensureSchema(pool);
    await pool
      .request()
      .input("PropertyId", sql.Int, id)
      .input("Title", sql.NVarChar(200), p.title ?? "")
      .input("Description", sql.NVarChar(sql.MAX), p.description ?? "")
      .input("Address", sql.NVarChar(255), p.address ?? "")
      .input("City", sql.NVarChar(100), p.city ?? "")
      .input("PropertyType", sql.NVarChar(50), p.propertyType ?? "")
      .input("IsForSale", sql.Bit, !!p.isForSale)
      .input("IsForRent", sql.Bit, !!p.isForRent)
      .input("Price", sql.NVarChar(100), String(p.price ?? ""))
      .input("Bedrooms", sql.Int, Number(p.bedrooms) || null)
      .input("Bathrooms", sql.Int, Number(p.bathrooms) || null)
      .input("SquareFeet", sql.Int, Number(p.squareFeet) || null)
      .input("HasOwnershipDocument", sql.Bit, !!p.hasOwnershipDocument)
      .input("Furniture", sql.NVarChar(100), p.furniture ?? "")
      .input("FloorPlanUrl", sql.NVarChar(1000), p.floorPlanUrl ?? "")
      .input("VirtualTourUrl", sql.NVarChar(1000), p.virtualTourUrl ?? "")
      .input("Latitude", sql.Float, Number(p.latitude) || null)
      .input("Longitude", sql.Float, Number(p.longitude) || null).query(`
        UPDATE Properties SET
          Title=@Title,
          Description=@Description,
          Address=@Address,
          City=@City,
          PropertyType=@PropertyType,
          IsForSale=@IsForSale,
          IsForRent=@IsForRent,
          Price=@Price,
          Bedrooms=@Bedrooms,
          Bathrooms=@Bathrooms,
          SquareFeet=@SquareFeet,
          HasOwnershipDocument=@HasOwnershipDocument,
          Furniture=@Furniture,
          FloorPlanUrl=@FloorPlanUrl,
          VirtualTourUrl=@VirtualTourUrl,
          Latitude=@Latitude,
          Longitude=@Longitude,
          UpdatedAt=SYSUTCDATETIME()
        WHERE PropertyId=@PropertyId
      `);

    res.json({ message: "Property updated successfully!" });
  } catch (err) {
    console.error("PutProperty error:", err);
    res.status(500).json({ error: "Server error" });
  }
}

export async function UpdatePropertyMedia(req, res) {
  const id = Number(req.params.id);
  if (!isValidId(id)) return res.status(400).json({ error: "Invalid id" });

  const p = req.body ?? {};

  try {
    const pool = await getPool();
    await ensureSchema(pool);
    const result = await pool
      .request()
      .input("PropertyId", sql.Int, id)
      .input("FloorPlanUrl", sql.NVarChar(1000), p.floorPlanUrl ?? "")
      .input("VirtualTourUrl", sql.NVarChar(1000), p.virtualTourUrl ?? "")
      .query(`
        UPDATE Properties SET
          FloorPlanUrl = @FloorPlanUrl,
          VirtualTourUrl = @VirtualTourUrl,
          UpdatedAt = SYSUTCDATETIME()
        WHERE PropertyId = @PropertyId;

        SELECT PropertyId, FloorPlanUrl, VirtualTourUrl
        FROM Properties
        WHERE PropertyId = @PropertyId;
      `);

    const updated = result.recordset?.[0];
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json({ propertyId: updated.PropertyId, floorPlanUrl: updated.FloorPlanUrl ?? "", virtualTourUrl: updated.VirtualTourUrl ?? "" });
  } catch (err) {
    console.error("UpdatePropertyMedia error:", err);
    res.status(500).json({ error: "Server error" });
  }
}

export async function GetPropertyMedia(req, res) {
  const id = Number(req.params.id);
  if (!isValidId(id)) return res.status(400).json({ error: "Invalid id" });

  try {
    const pool = await getPool();
    await ensureSchema(pool);
    const result = await pool.request().input("PropertyId", sql.Int, id).query(`
      SELECT PropertyId, FloorPlanUrl, VirtualTourUrl
      FROM Properties
      WHERE PropertyId = @PropertyId
    `);
    const property = result.recordset?.[0];
    if (!property) return res.status(404).json({ error: "Not found" });
    res.json({
      propertyId: property.PropertyId,
      floorPlanUrl: property.FloorPlanUrl ?? "",
      virtualTourUrl: property.VirtualTourUrl ?? "",
    });
  } catch (err) {
    console.error("GetPropertyMedia error:", err);
    res.status(500).json({ error: "Server error" });
  }
}

export async function GetFloorPlanImage(req, res) {
  const propertyId = Number(req.params.propertyId);
  if (!isValidId(propertyId)) return res.status(400).json({ error: "Invalid propertyId" });

  try {
    const pool = await getPool();
    await ensureSchema(pool);
    const result = await pool.request().input("propertyId", sql.Int, propertyId).query(`
      SELECT TOP 1 FloorPlanImageData, FloorPlanMimeType
      FROM Properties
      WHERE PropertyId = @propertyId
    `);
    const row = result.recordset[0];
    if (!row || !row.FloorPlanImageData) return res.status(404).json({ error: "Floor plan image not found" });
    res.set("Content-Type", row.FloorPlanMimeType || "image/jpeg");
    res.set("Cache-Control", "public, max-age=31536000, immutable");
    res.send(Buffer.from(row.FloorPlanImageData));
  } catch (err) {
    console.error("GetFloorPlanImage error:", err);
    res.status(500).json({ error: "Server error" });
  }
}

export async function UploadFloorPlanImage(req, res) {
  const propertyId = Number(req.params.propertyId);
  if (!isValidId(propertyId)) return res.status(400).json({ error: "Invalid propertyId" });
  if (!req.file?.buffer) return res.status(400).json({ error: "Missing floor plan image" });

  try {
    const pool = await getPool();
    await ensureSchema(pool);
    const processed = await processImageBuffer(req.file.buffer);
    const floorPlanUrl = floorPlanApiUrl(propertyId);
    const result = await pool.request()
      .input("propertyId", sql.Int, propertyId)
      .input("floorPlanUrl", sql.NVarChar(1000), floorPlanUrl)
      .input("floorPlanImageData", sql.VarBinary(sql.MAX), processed.buffer)
      .input("floorPlanMimeType", sql.NVarChar(100), processed.mimeType)
      .input("floorPlanOriginalName", sql.NVarChar(255), req.file.originalname || "floor-plan")
      .input("floorPlanWidth", sql.Int, processed.width)
      .input("floorPlanHeight", sql.Int, processed.height)
      .query(`
        UPDATE Properties
        SET FloorPlanUrl=@floorPlanUrl,
            FloorPlanImageData=@floorPlanImageData,
            FloorPlanMimeType=@floorPlanMimeType,
            FloorPlanOriginalName=@floorPlanOriginalName,
            FloorPlanWidth=@floorPlanWidth,
            FloorPlanHeight=@floorPlanHeight,
            UpdatedAt=SYSUTCDATETIME()
        OUTPUT INSERTED.PropertyId, INSERTED.FloorPlanUrl, INSERTED.FloorPlanMimeType, INSERTED.FloorPlanWidth, INSERTED.FloorPlanHeight
        WHERE PropertyId=@propertyId
      `);
    const updated = result.recordset[0];
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json({
      propertyId: updated.PropertyId,
      floorPlanUrl: updated.FloorPlanUrl,
      floorPlanMimeType: updated.FloorPlanMimeType,
      floorPlanWidth: updated.FloorPlanWidth,
      floorPlanHeight: updated.FloorPlanHeight,
    });
  } catch (err) {
    console.error("UploadFloorPlanImage error:", err);
    sendControllerError(res, err);
  }
}

export async function DeleteProperty(req, res) {
  const id = Number(req.params.id);
  if (!isValidId(id)) return res.status(400).json({ error: "Invalid id" });

  try {
    const pool = await getPool();
    await pool.request().input("id", sql.Int, id).query(`
      DELETE FROM PropertiesImage WHERE PropertyId=@id;
      DELETE FROM Properties WHERE PropertyId=@id;
    `);
    res.status(204).send();
  } catch (err) {
    console.error("DeleteProperty error:", err);
    res.status(500).json({ error: "Server error" });
  }
}

export async function GetPropertyImages(req, res) {
  const propertyId = Number(req.params.propertyId);
  if (!isValidId(propertyId)) return res.status(400).json({ error: "Invalid propertyId" });

  try {
    const pool = await getPool();
    await ensureSchema(pool);
    const result = await pool.request().input("propertyId", sql.Int, propertyId).query(`
      SELECT ImageId, PropertyId, ImageUrl, OriginalUrl,
             CASE WHEN ImageData IS NULL THEN CAST(0 AS bit) ELSE CAST(1 AS bit) END AS HasImageData,
             MimeType, Width, Height, SortOrder
      FROM PropertiesImage
      WHERE PropertyId=@propertyId
      ORDER BY SortOrder ASC, ImageId ASC
    `);
    res.json(result.recordset.map((image) => ({
      ...image,
      imageUrl: preferredImageUrl(image),
      hasImageData: !!image.HasImageData,
    })));
  } catch (err) {
    console.error("GetPropertyImages error:", err);
    res.status(500).json({ error: "Server error" });
  }
}

export async function GetPropertyMainImage(req, res) {
  const propertyId = Number(req.params.propertyId);
  if (!isValidId(propertyId)) return res.status(400).json({ error: "Invalid propertyId" });

  try {
    const pool = await getPool();
    await ensureSchema(pool);
    const result = await pool.request().input("propertyId", sql.Int, propertyId).query(`
      SELECT TOP 1 ImageId, PropertyId, ImageUrl, OriginalUrl,
             CASE WHEN ImageData IS NULL THEN CAST(0 AS bit) ELSE CAST(1 AS bit) END AS HasImageData,
             MimeType, Width, Height, SortOrder
      FROM PropertiesImage
      WHERE PropertyId = @propertyId
      ORDER BY SortOrder ASC, ImageId ASC
    `);
    if (result.recordset.length === 0) return res.status(404).json({ message: "No image found for this property" });
    const image = result.recordset[0];
    res.json({ ...image, imageUrl: preferredImageUrl(image), hasImageData: !!image.HasImageData });
  } catch (err) {
    console.error("GetPropertyMainImage error:", err);
    res.status(500).json({ error: "Server error" });
  }
}

export async function GetPropertyImage(req, res) {
  const imageId = Number(req.params.imageId);
  if (!isValidId(imageId)) return res.status(400).json({ error: "Invalid imageId" });

  try {
    const pool = await getPool();
    await ensureSchema(pool);
    const result = await pool.request().input("imageId", sql.Int, imageId).query(`
      SELECT TOP 1 ImageData, MimeType
      FROM PropertiesImage
      WHERE ImageId = @imageId
    `);
    const row = result.recordset[0];
    if (!row || !row.ImageData) return res.status(404).json({ error: "Image not found" });
    res.set("Content-Type", row.MimeType || "image/jpeg");
    res.set("Cache-Control", "public, max-age=31536000, immutable");
    res.send(Buffer.from(row.ImageData));
  } catch (err) {
    console.error("GetPropertyImage error:", err);
    res.status(500).json({ error: "Server error" });
  }
}

export async function UpscalePropertyImage(req, res) {
  const imageId = Number(req.params.imageId);
  if (!isValidId(imageId)) return res.status(400).json({ error: "Invalid imageId" });

  try {
    const pool = await getPool();
    await ensureSchema(pool);
    const existing = await pool.request().input("imageId", sql.Int, imageId).query(`
      SELECT TOP 1 ImageId, PropertyId, ImageUrl, OriginalUrl, ImageData, MimeType, SortOrder
      FROM PropertiesImage
      WHERE ImageId = @imageId
    `);
    const image = existing.recordset[0];
    if (!image) return res.status(404).json({ error: "Image not found" });

    let sourceBuffer = image.ImageData ? Buffer.from(image.ImageData) : null;
    let originalUrl = image.OriginalUrl || "";
    const remoteUrl = [image.OriginalUrl, image.ImageUrl].find((value) => /^https?:\/\//i.test(value || ""));

    if (!sourceBuffer && remoteUrl) {
      const remote = await remoteImageToRecord(remoteUrl);
      sourceBuffer = remote.buffer;
      originalUrl = originalUrl || remote.originalUrl;
    }

    if (!sourceBuffer) {
      return res.status(400).json({ error: "This image has no database binary or remote source to upscale." });
    }

    const processed = await processImageBuffer(sourceBuffer);
    const internalUrl = imageApiUrl(imageId);
    await pool.request()
      .input("imageId", sql.Int, imageId)
      .input("imageUrl", sql.NVarChar(1000), internalUrl)
      .input("originalUrl", sql.NVarChar(1000), originalUrl || image.ImageUrl || null)
      .input("imageData", sql.VarBinary(sql.MAX), processed.buffer)
      .input("mimeType", sql.NVarChar(100), processed.mimeType)
      .input("width", sql.Int, processed.width)
      .input("height", sql.Int, processed.height)
      .query(`
        UPDATE PropertiesImage
        SET ImageUrl=@imageUrl,
            OriginalUrl=COALESCE(NULLIF(@originalUrl, ''), OriginalUrl),
            ImageData=@imageData,
            MimeType=@mimeType,
            Width=@width,
            Height=@height
        WHERE ImageId=@imageId
      `);

    res.json({
      imageId,
      propertyId: image.PropertyId,
      imageUrl: internalUrl,
      originalUrl: originalUrl || image.OriginalUrl || "",
      hasImageData: true,
      mimeType: processed.mimeType,
      width: processed.width,
      height: processed.height,
      sortOrder: image.SortOrder ?? 0,
    });
  } catch (err) {
    console.error("UpscalePropertyImage error:", err);
    sendControllerError(res, err);
  }
}

export async function AddPropertyImage(req, res) {
  const propertyId = Number(req.params.propertyId);
  if (!isValidId(propertyId)) return res.status(400).json({ error: "Invalid propertyId" });

  try {
    const pool = await getPool();
    await ensureSchema(pool);
    const tx = new sql.Transaction(pool);
    await tx.begin();

    try {
      const property = await new sql.Request(tx)
        .input("propertyId", sql.Int, propertyId)
        .query(`SELECT TOP 1 PropertyId FROM Properties WHERE PropertyId=@propertyId`);
      if (!property.recordset[0]) {
        const err = new Error("Property not found.");
        err.statusCode = 404;
        err.publicMessage = "Property not found.";
        throw err;
      }

      const input = req.file?.buffer || req.body?.imageUrl || req.body?.file || "";
      let originalUrl = req.body?.originalUrl || "";
      let imageData = null;
      let mimeType = "image/jpeg";
      let width = null;
      let height = null;

      if (Buffer.isBuffer(input)) {
        const processed = await processImageBuffer(input);
        imageData = processed.buffer;
        mimeType = processed.mimeType;
        width = processed.width;
        height = processed.height;
        originalUrl = originalUrl || req.file?.originalname || "";
      } else if (typeof input === "string") {
        const remote = await remoteImageToRecord(input.trim());
        imageData = remote.buffer;
        mimeType = remote.mimeType;
        width = remote.width;
        height = remote.height;
        originalUrl = remote.originalUrl;
      }

      if (!imageData) {
        const err = new Error("Choose an image file or enter a valid image URL.");
        err.statusCode = 400;
        err.publicMessage = "Choose an image file or enter a valid image URL.";
        throw err;
      }

      const orderResult = await new sql.Request(tx)
        .input("propertyId", sql.Int, propertyId)
        .query(`SELECT COALESCE(MAX(SortOrder), -1) + 1 AS NextSortOrder FROM PropertiesImage WHERE PropertyId=@propertyId`);
      const sortOrder = orderResult.recordset[0]?.NextSortOrder ?? 0;

      const result = await new sql.Request(tx)
        .input("PropertyId", sql.Int, propertyId)
        .input("ImageUrl", sql.NVarChar(1000), originalUrl || "pending")
        .input("OriginalUrl", sql.NVarChar(1000), originalUrl)
        .input("ImageData", sql.VarBinary(sql.MAX), imageData)
        .input("MimeType", sql.NVarChar(100), mimeType)
        .input("Width", sql.Int, width)
        .input("Height", sql.Int, height)
        .input("SortOrder", sql.Int, sortOrder).query(`
          INSERT INTO PropertiesImage
            (PropertyId, ImageUrl, OriginalUrl, ImageData, MimeType, Width, Height, SortOrder)
          OUTPUT INSERTED.ImageId, INSERTED.ImageUrl, INSERTED.OriginalUrl, INSERTED.MimeType, INSERTED.Width, INSERTED.Height, INSERTED.SortOrder
          VALUES (@PropertyId, @ImageUrl, @OriginalUrl, @ImageData, @MimeType, @Width, @Height, @SortOrder)
        `);
      const inserted = result.recordset[0];
      const imageUrl = imageApiUrl(inserted.ImageId);
      await new sql.Request(tx)
        .input("imageId", sql.Int, inserted.ImageId)
        .input("imageUrl", sql.NVarChar(1000), imageUrl)
        .query(`UPDATE PropertiesImage SET ImageUrl=@imageUrl WHERE ImageId=@imageId`);

      await tx.commit();
      res.json({ ...inserted, imageUrl, hasImageData: true });
    } catch (err) {
      await tx.rollback();
      throw err;
    }
  } catch (err) {
    console.error("AddPropertyImage error:", err);
    sendControllerError(res, err);
  }
}

export async function ImportPropertyImages(req, res) {
  const propertyId = Number(req.params.propertyId);
  const urls = Array.isArray(req.body?.urls) ? req.body.urls : [];
  if (!isValidId(propertyId) || !urls.length) return res.status(400).json({ error: "Missing propertyId or urls" });

  try {
    const pool = await getPool();
    await ensureSchema(pool);
    const tx = new sql.Transaction(pool);
    await tx.begin();

    try {
      const imported = [];
      for (let index = 0; index < urls.length; index += 1) {
        const remote = await remoteImageToRecord(String(urls[index]));
        const result = await new sql.Request(tx)
          .input("PropertyId", sql.Int, propertyId)
          .input("ImageUrl", sql.NVarChar(1000), remote.originalUrl)
          .input("OriginalUrl", sql.NVarChar(1000), remote.originalUrl)
          .input("ImageData", sql.VarBinary(sql.MAX), remote.buffer)
          .input("MimeType", sql.NVarChar(100), remote.mimeType)
          .input("Width", sql.Int, remote.width)
          .input("Height", sql.Int, remote.height)
          .input("SortOrder", sql.Int, index).query(`
            INSERT INTO PropertiesImage
              (PropertyId, ImageUrl, OriginalUrl, ImageData, MimeType, Width, Height, SortOrder)
            OUTPUT INSERTED.ImageId, INSERTED.ImageUrl, INSERTED.OriginalUrl, INSERTED.MimeType, INSERTED.Width, INSERTED.Height, INSERTED.SortOrder
            VALUES (@PropertyId, @ImageUrl, @OriginalUrl, @ImageData, @MimeType, @Width, @Height, @SortOrder)
        `);

        const inserted = result.recordset[0];
        const imageUrl = imageApiUrl(inserted.ImageId);
        await new sql.Request(tx)
          .input("imageId", sql.Int, inserted.ImageId)
          .input("imageUrl", sql.NVarChar(1000), imageUrl)
          .query(`UPDATE PropertiesImage SET ImageUrl=@imageUrl WHERE ImageId=@imageId`);
        imported.push({ ...inserted, imageUrl, hasImageData: true });
      }
      await tx.commit();
      res.json({ message: "Imported", images: imported });
    } catch (err) {
      await tx.rollback();
      throw err;
    }
  } catch (err) {
    console.error("ImportPropertyImages error:", err);
    sendControllerError(res, err);
  }
}

export async function UpdatePropertyImages(req, res) {
  const propertyId = Number(req.params.propertyId);
  const images = Array.isArray(req.body) ? req.body : [];
  if (!isValidId(propertyId)) return res.status(400).json({ error: "Invalid propertyId" });

  try {
    const pool = await getPool();
    await ensureSchema(pool);
    const tx = new sql.Transaction(pool);
    await tx.begin();

    try {
      const existingResult = await new sql.Request(tx)
        .input("propertyId", sql.Int, propertyId)
        .query(`SELECT ImageId FROM PropertiesImage WHERE PropertyId=@propertyId`);
      const existingIds = new Set(existingResult.recordset.map((row) => Number(row.ImageId)));
      const keepIds = new Set(
        images
          .map((value) => Number((typeof value === "object" ? value?.imageId ?? value?.ImageId : null) || 0))
          .filter((imageId) => existingIds.has(imageId)),
      );

      for (const imageId of existingIds) {
        if (!keepIds.has(imageId)) {
          await new sql.Request(tx)
            .input("propertyId", sql.Int, propertyId)
            .input("imageId", sql.Int, imageId)
            .query(`DELETE FROM PropertiesImage WHERE PropertyId=@propertyId AND ImageId=@imageId`);
        }
      }

      for (let index = 0; index < images.length; index += 1) {
        const value = images[index];
        const body = typeof value === "string" ? { imageUrl: value } : value || {};
        const existingImageId = Number(body.imageId ?? body.ImageId ?? 0);

        if (keepIds.has(existingImageId)) {
          await new sql.Request(tx)
            .input("propertyId", sql.Int, propertyId)
            .input("imageId", sql.Int, existingImageId)
            .input("sortOrder", sql.Int, index)
            .query(`
              UPDATE PropertiesImage
              SET SortOrder=@sortOrder
              WHERE PropertyId=@propertyId AND ImageId=@imageId
            `);
          continue;
        }

        const sourceUrl = body.originalUrl || body.imageUrl || body.ImageUrl || "";
        if (!sourceUrl || !/^https?:\/\//i.test(sourceUrl)) continue;

        const remote = await remoteImageToRecord(String(sourceUrl));
        const insert = await new sql.Request(tx)
          .input("propertyId", sql.Int, propertyId)
          .input("imageUrl", sql.NVarChar(1000), remote.originalUrl)
          .input("originalUrl", sql.NVarChar(1000), remote.originalUrl)
          .input("imageData", sql.VarBinary(sql.MAX), remote.buffer)
          .input("mimeType", sql.NVarChar(100), remote.mimeType)
          .input("width", sql.Int, remote.width)
          .input("height", sql.Int, remote.height)
          .input("sortOrder", sql.Int, index)
          .query(`
            INSERT INTO PropertiesImage
              (PropertyId, ImageUrl, OriginalUrl, ImageData, MimeType, Width, Height, SortOrder)
            OUTPUT INSERTED.ImageId
            VALUES
              (@propertyId, @imageUrl, @originalUrl, @imageData, @mimeType, @width, @height, @sortOrder)
          `);
        const imageId = insert.recordset[0].ImageId;
        await new sql.Request(tx)
          .input("imageId", sql.Int, imageId)
          .input("imageUrl", sql.NVarChar(1000), imageApiUrl(imageId))
          .query(`UPDATE PropertiesImage SET ImageUrl=@imageUrl WHERE ImageId=@imageId`);
      }

      await tx.commit();
      res.json({ message: "Images updated successfully!" });
    } catch (err) {
      await tx.rollback();
      throw err;
    }
  } catch (err) {
    console.error("UpdatePropertyImages error:", err);
    sendControllerError(res, err);
  }
}

export async function DeletePropertyImage(req, res) {
  const propertyId = Number(req.params.propertyId);
  const imageId = Number(req.params.imageId);
  if (!isValidId(propertyId) || !isValidId(imageId)) return res.status(400).json({ error: "Invalid params" });

  try {
    const pool = await getPool();
    const result = await pool.request().input("propertyId", sql.Int, propertyId).input("imageId", sql.Int, imageId).query(`
      DELETE FROM PropertiesImage WHERE PropertyId=@propertyId AND ImageId=@imageId
    `);
    if ((result.rowsAffected?.[0] ?? 0) === 0) return res.status(404).json({ message: "Image not found or does not belong to the property" });
    res.json({ message: "Image deleted successfully!" });
  } catch (err) {
    console.error("DeletePropertyImage error:", err);
    res.status(500).json({ error: "Server error" });
  }
}
