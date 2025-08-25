import { getPool, sql } from "../db/mssql.js";
import { rowsToProperties } from "../utils/shape.js";

// GET: /api/Property/GetProperties
export async function GetProperties(req, res) {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT p.*, i.ImageId, i.ImageUrl
      FROM Properties p
      LEFT JOIN PropertiesImage i ON i.PropertyId = p.PropertyId
      ORDER BY p.PropertyId DESC, i.ImageId ASC
    `);

    const items = rowsToProperties(result.recordset || []);
    res.json(items);
  } catch (err) {
    console.error("GetProperties error:", err);
    res.status(500).json({ error: "Server error" });
  }
}

// GET: /api/Property/GetProperty/{id}
export async function GetProperty(req, res) {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid id" });

  try {
    const pool = await getPool();
    const result = await pool.request().input("id", sql.Int, id).query(`
        SELECT p.*, i.ImageId, i.ImageUrl
        FROM Properties p
        LEFT JOIN PropertiesImage i ON i.PropertyId = p.PropertyId
        WHERE p.PropertyId = @id
        ORDER BY i.ImageId ASC
      `);

    const items = rowsToProperties(result.recordset || []);
    if (items.length === 0) return res.status(404).json({ error: "Not found" });
    res.json(items[0]);
  } catch (err) {
    console.error("GetProperty error:", err);
    res.status(500).json({ error: "Server error" });
  }
}

// POST: /api/Property/PostProperty
// Body: PropertyDto (like your .NET DTO)
export async function PostProperty(req, res) {
  const p = req.body;
  try {
    const pool = await getPool();
    const tx = new sql.Transaction(pool);
    await tx.begin();

    try {
      const request = new sql.Request(tx);
      const insert = await request
        .input("Title", sql.NVarChar(200), p.title)
        .input("Description", sql.NVarChar(sql.MAX), p.description)
        .input("Address", sql.NVarChar(255), p.address)
        .input("City", sql.NVarChar(100), p.city)
        .input("State", sql.NVarChar(100), p.state)
        .input("ZipCode", sql.NVarChar(50), p.zipCode)
        .input("PropertyType", sql.NVarChar(50), p.propertyType)
        .input("IsForSale", sql.Bit, !!p.isForSale)
        .input("IsForRent", sql.Bit, !!p.isForRent)
        .input("Price", sql.NVarChar(100), p.price) // string in your model
        .input("Bedrooms", sql.Int, p.bedrooms ?? 0)
        .input("Bathrooms", sql.Int, p.bathrooms ?? 0)
        .input("SquareFeet", sql.Int, p.squareFeet ?? 0)
        .input("IsAvailable", sql.Bit, !!p.isAvailable)
        .input("Orientation", sql.NVarChar(50), p.orientation)
        .input("Furniture", sql.NVarChar(100), p.furniture)
        .input("HeatingSystem", sql.NVarChar(100), p.heatingSystem)
        .input(
          "AdditionalFeatures",
          sql.NVarChar(sql.MAX),
          p.additionalFeatures
        )
        .input("HasOwnershipDocument", sql.Bit, !!p.hasOwnershipDocument)
        .input("Spaces", sql.Int, p.spaces ?? 0)
        .input("FloorLevel", sql.NVarChar(50), p.floorLevel)
        .input("Country", sql.NVarChar(100), p.country)
        .input("Neighborhood", sql.NVarChar(100), p.neighborhood)
        .input("Builder", sql.NVarChar(100), p.builder)
        .input("Complex", sql.NVarChar(100), p.complex)
        .input("Latitude", sql.Float, p.latitude ?? 0)
        .input("Longitude", sql.Float, p.longitude ?? 0)
        .input("ExteriorVideo", sql.NVarChar(500), p.exteriorVideo)
        .input("InteriorVideo", sql.NVarChar(500), p.interiorVideo).query(`
          INSERT INTO Properties
          (Title,Description,Address,City,State,ZipCode,PropertyType,IsForSale,IsForRent,Price,Bedrooms,Bathrooms,SquareFeet,IsAvailable,Orientation,Furniture,HeatingSystem,AdditionalFeatures,HasOwnershipDocument,Spaces,FloorLevel,Country,Neighborhood,Builder,Complex,Latitude,Longitude,ExteriorVideo,InteriorVideo)
          OUTPUT INSERTED.PropertyId
          VALUES (@Title,@Description,@Address,@City,@State,@ZipCode,@PropertyType,@IsForSale,@IsForRent,@Price,@Bedrooms,@Bathrooms,@SquareFeet,@IsAvailable,@Orientation,@Furniture,@HeatingSystem,@AdditionalFeatures,@HasOwnershipDocument,@Spaces,@FloorLevel,@Country,@Neighborhood,@Builder,@Complex,@Latitude,@Longitude,@ExteriorVideo,@InteriorVideo)
        `);

      const newId = insert.recordset[0].PropertyId;

      // If you plan to pass images in the same request (array of urls)
      if (Array.isArray(p.images) && p.images.length) {
        const req2 = new sql.Request(tx).input("PropertyId", sql.Int, newId);
        for (const url of p.images) {
          await req2
            .input("ImageUrl", sql.NVarChar(1000), url)
            .query(
              `INSERT INTO PropertiesImage (ImageUrl, PropertyId) VALUES (@ImageUrl, @PropertyId)`
            );
          req2.parameters = { PropertyId: req2.parameters.PropertyId }; // reset ImageUrl param
        }
      }

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

// PUT: /api/Property/PutProperty/{id}
export async function PutProperty(req, res) {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid id" });

  const p = req.body;

  try {
    const pool = await getPool();
    const request = pool.request().input("PropertyId", sql.Int, id);

    // Update property
    await request
      .input("Title", sql.NVarChar(200), p.title)
      .input("Description", sql.NVarChar(sql.MAX), p.description)
      .input("Address", sql.NVarChar(255), p.address)
      .input("City", sql.NVarChar(100), p.city)
      .input("State", sql.NVarChar(100), p.state)
      .input("ZipCode", sql.NVarChar(50), p.zipCode)
      .input("PropertyType", sql.NVarChar(50), p.propertyType)
      .input("IsForSale", sql.Bit, !!p.isForSale)
      .input("IsForRent", sql.Bit, !!p.isForRent)
      .input("Price", sql.NVarChar(100), p.price)
      .input("Bedrooms", sql.Int, p.bedrooms ?? 0)
      .input("Bathrooms", sql.Int, p.bathrooms ?? 0)
      .input("SquareFeet", sql.Int, p.squareFeet ?? 0)
      .input("IsAvailable", sql.Bit, !!p.isAvailable)
      .input("Orientation", sql.NVarChar(50), p.orientation)
      .input("Furniture", sql.NVarChar(100), p.furniture)
      .input("HeatingSystem", sql.NVarChar(100), p.heatingSystem)
      .input("AdditionalFeatures", sql.NVarChar(sql.MAX), p.additionalFeatures)
      .input("HasOwnershipDocument", sql.Bit, !!p.hasOwnershipDocument)
      .input("Spaces", sql.Int, p.spaces ?? 0)
      .input("FloorLevel", sql.NVarChar(50), p.floorLevel)
      .input("Country", sql.NVarChar(100), p.country)
      .input("Neighborhood", sql.NVarChar(100), p.neighborhood)
      .input("Builder", sql.NVarChar(100), p.builder)
      .input("Complex", sql.NVarChar(100), p.complex)
      .input("Latitude", sql.Float, p.latitude ?? 0)
      .input("Longitude", sql.Float, p.longitude ?? 0)
      .input("ExteriorVideo", sql.NVarChar(500), p.exteriorVideo)
      .input("InteriorVideo", sql.NVarChar(500), p.interiorVideo).query(`
        UPDATE Properties SET
          Title=@Title, Description=@Description, Address=@Address, City=@City, State=@State, ZipCode=@ZipCode,
          PropertyType=@PropertyType, IsForSale=@IsForSale, IsForRent=@IsForRent, Price=@Price,
          Bedrooms=@Bedrooms, Bathrooms=@Bathrooms, SquareFeet=@SquareFeet, IsAvailable=@IsAvailable,
          Orientation=@Orientation, Furniture=@Furniture, HeatingSystem=@HeatingSystem, AdditionalFeatures=@AdditionalFeatures,
          HasOwnershipDocument=@HasOwnershipDocument, Spaces=@Spaces, FloorLevel=@FloorLevel, Country=@Country, Neighborhood=@Neighborhood,
          Builder=@Builder, Complex=@Complex, Latitude=@Latitude, Longitude=@Longitude, ExteriorVideo=@ExteriorVideo, InteriorVideo=@InteriorVideo
        WHERE PropertyId=@PropertyId
      `);

    res.json({ message: "Property updated successfully!" });
  } catch (err) {
    console.error("PutProperty error:", err);
    res.status(500).json({ error: "Server error" });
  }
}

// DELETE: /api/Property/DeleteProperty/{id}
export async function DeleteProperty(req, res) {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid id" });

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

// GET: /api/Property/GetPropertyImages/{propertyId}
export async function GetPropertyImages(req, res) {
  const propertyId = Number(req.params.propertyId);
  if (!propertyId) return res.status(400).json({ error: "Invalid propertyId" });

  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("propertyId", sql.Int, propertyId)
      .query(
        `SELECT * FROM PropertiesImage WHERE PropertyId=@propertyId ORDER BY ImageId ASC`
      );

    if (result.recordset.length === 0) {
      return res
        .status(404)
        .json({ message: "No images found for this property" });
    }
    res.json(result.recordset);
  } catch (err) {
    console.error("GetPropertyImages error:", err);
    res.status(500).json({ error: "Server error" });
  }
}

// POST: /api/Property/AddPropertyImage/{propertyId}
export async function AddPropertyImage(req, res) {
  const propertyId = Number(req.params.propertyId);
  const imageUrl = req.body?.imageUrl || req.body; // supports raw string or {imageUrl}
  if (!propertyId || !imageUrl)
    return res.status(400).json({ error: "Missing propertyId or imageUrl" });

  try {
    const pool = await getPool();
    await pool
      .request()
      .input("propertyId", sql.Int, propertyId)
      .input("imageUrl", sql.NVarChar(1000), String(imageUrl))
      .query(
        `INSERT INTO PropertiesImage (ImageUrl, PropertyId) VALUES (@imageUrl, @propertyId)`
      );
    res.json({ message: "Image added successfully!" });
  } catch (err) {
    console.error("AddPropertyImage error:", err);
    res.status(500).json({ error: "Server error" });
  }
}

// PUT: /api/Property/UpdatePropertyImages/{propertyId}
// Body: ["url1","url2",...]
export async function UpdatePropertyImages(req, res) {
  const propertyId = Number(req.params.propertyId);
  const urls = Array.isArray(req.body) ? req.body : [];
  if (!propertyId) return res.status(400).json({ error: "Invalid propertyId" });

  try {
    const pool = await getPool();
    const tx = new sql.Transaction(pool);
    await tx.begin();

    try {
      const r1 = new sql.Request(tx).input("propertyId", sql.Int, propertyId);
      await r1.query(
        `DELETE FROM PropertiesImage WHERE PropertyId=@propertyId`
      );

      if (urls.length) {
        for (const u of urls) {
          await new sql.Request(tx)
            .input("propertyId", sql.Int, propertyId)
            .input("imageUrl", sql.NVarChar(1000), String(u))
            .query(
              `INSERT INTO PropertiesImage (ImageUrl, PropertyId) VALUES (@imageUrl, @propertyId)`
            );
        }
      }

      await tx.commit();
      res.json({ message: "Images updated successfully!" });
    } catch (err) {
      await tx.rollback();
      throw err;
    }
  } catch (err) {
    console.error("UpdatePropertyImages error:", err);
    res.status(500).json({ error: "Server error" });
  }
}

// DELETE: /api/Property/DeletePropertyImage/{propertyId}/{imageId}
export async function DeletePropertyImage(req, res) {
  const propertyId = Number(req.params.propertyId);
  const imageId = Number(req.params.imageId);
  if (!propertyId || !imageId)
    return res.status(400).json({ error: "Invalid params" });

  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("propertyId", sql.Int, propertyId)
      .input("imageId", sql.Int, imageId)
      .query(
        `DELETE FROM PropertiesImage WHERE PropertyId=@propertyId AND ImageId=@imageId`
      );

    // rowsAffected is array per statement; sum to check >0
    const affected = result.rowsAffected?.reduce((a, b) => a + b, 0) ?? 0;
    if (affected === 0)
      return res.status(404).json({
        message: "Image not found or does not belong to the property",
      });

    res.json({ message: "Image deleted successfully!" });
  } catch (err) {
    console.error("DeletePropertyImage error:", err);
    res.status(500).json({ error: "Server error" });
  }
}
