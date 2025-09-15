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
        .input("Title", sql.NVarChar(200), p.title ?? "")
        .input("Description", sql.NVarChar(sql.MAX), p.description ?? "")
        .input("Address", sql.NVarChar(255), p.address ?? "")
        .input("City", sql.NVarChar(100), p.city ?? "")
        .input("PropertyType", sql.NVarChar(50), p.propertyType ?? "")
        .input("IsForSale", sql.Bit, !!p.isForSale)
        .input("IsForRent", sql.Bit, !!p.isForRent)
        .input("Price", sql.NVarChar(100), String(p.price ?? "")) // Price is NVARCHAR
        .input("Bedrooms", sql.Int, Number(p.bedrooms) || 0)
        .input("Bathrooms", sql.Int, Number(p.bathrooms) || 0)
        .input("SquareFeet", sql.Int, Number(p.squareFeet) || 0)
        .input("HasOwnershipDocument", sql.Bit, !!p.hasOwnershipDocument)
        .input("Furniture", sql.NVarChar(100), p.furniture ?? "")
        .input("Latitude", sql.Float, Number(p.latitude) || 0)
        .input("Longitude", sql.Float, Number(p.longitude) || 0).query(`
          INSERT INTO Properties
            (Title, Description, Address, City, PropertyType, IsForSale, IsForRent,
             Price, Bedrooms, Bathrooms, SquareFeet, HasOwnershipDocument, Furniture,
             Latitude, Longitude)
          OUTPUT INSERTED.PropertyId
          VALUES
            (@Title, @Description, @Address, @City, @PropertyType, @IsForSale, @IsForRent,
             @Price, @Bedrooms, @Bathrooms, @SquareFeet, @HasOwnershipDocument, @Furniture,
             @Latitude, @Longitude)
        `);

      const newId = insert.recordset[0].PropertyId;

      // (optional) insert images here if you send them in the request…

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
      .input("Bedrooms", sql.Int, Number(p.bedrooms) || 0)
      .input("Bathrooms", sql.Int, Number(p.bathrooms) || 0)
      .input("SquareFeet", sql.Int, Number(p.squareFeet) || 0)
      .input("HasOwnershipDocument", sql.Bit, !!p.hasOwnershipDocument)
      .input("Furniture", sql.NVarChar(100), p.furniture ?? "")
      .input("Latitude", sql.Float, Number(p.latitude) || 0)
      .input("Longitude", sql.Float, Number(p.longitude) || 0).query(`
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
          Latitude=@Latitude,
          Longitude=@Longitude
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
      .query(`DELETE FROM PropertiesImage WHERE PropertyId=@propertyId`);

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
