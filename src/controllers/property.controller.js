import { getPool, sql } from "../db/mssql.js";
import { rowsToProperties } from "../utils/shape.js";

/* ------------------------ helpers ------------------------ */
function isValidId(n) {
  return Number.isInteger(n) && n > 0;
}

function escapeHtml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function toAbsoluteImageUrl(url) {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;

  // If DB stores relative paths like "/uploads/..."
  return `https://www.realo-realestate.com${url.startsWith("/") ? "" : "/"}${url}`;
}

function buildSpaUrlFromProperty(p, id) {
  // Your frontend structure seems like:
  // /properties/<encoded title>/<id>
  const title = p?.title || "Property";
  const slug = encodeURIComponent(title);
  return `https://www.realo-realestate.com/properties/${slug}/${id}`;
}

/* ------------------------ GET: /api/Property/GetProperties ------------------------ */
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

/* ------------------------ GET: /api/Property/GetProperty/{id} ------------------------ */
export async function GetProperty(req, res) {
  const id = Number(req.params.id);
  if (!isValidId(id)) return res.status(400).json({ error: "Invalid id" });

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

/* ------------------------ NEW: GET HTML share page (OG tags) ------------------------ */
/**
 * GET: /api/Property/ShareProperty/{id}
 *
 * This returns HTML with OG meta tags so link previews show the property image.
 * Humans get redirected to the SPA property page.
 */
export async function ShareProperty(req, res) {
  const id = Number(req.params.id);
  if (!isValidId(id)) return res.status(400).send("Invalid id");

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
    if (items.length === 0) return res.status(404).send("Not found");

    const p = items[0];

    const titleRaw = p.title || "Property";
    const city = p.city || "";
    const price = p.price ? String(p.price).trim() : "";
    const descriptionRaw =
      [city, price ? `€${price.replace(/^€\s*/, "")}` : ""]
        .filter(Boolean)
        .join(" • ") || "View property";

    const firstImage =
      p?.images?.[0]?.imageUrl ||
      p?.images?.[0]?.ImageUrl ||
      p?.Images?.[0]?.ImageUrl ||
      p?.images?.[0]?.url ||
      p?.mainImageUrl ||
      p?.imageUrl ||
      "";

    const ogImage =
      toAbsoluteImageUrl(firstImage) ||
      "https://www.realo-realestate.com/og.png";

    const redirectUrl = buildSpaUrlFromProperty(p, id);
    const shareUrl = `https://www.realo-realestate.com/share/${id}`;

    const title = escapeHtml(titleRaw);
    const description = escapeHtml(descriptionRaw);
    const ogImageSafe = escapeHtml(ogImage);

    // ✅ BOT DETECTION (stronger + simpler)
    const ua = (req.headers["user-agent"] || "").toLowerCase();
    const isBot = [
      "facebookexternalhit",
      "facebot",
      "twitterbot",
      "slackbot",
      "whatsapp",
      "telegrambot",
      "discordbot",
      "linkedinbot",
      "linkedin",
    ].some((s) => ua.includes(s));

    // ✅ Humans: redirect (ONLY server redirect)
    if (!isBot) {
      return res.redirect(302, redirectUrl);
    }

    // ✅ Bots: OG tags ONLY (NO refresh, NO JS redirect)
    res.status(200);
    res.set("Content-Type", "text/html; charset=utf-8");
    res.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate",
    );
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");

    return res.send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${title}</title>

  <meta property="og:type" content="website" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:url" content="${shareUrl}" />
  <meta property="og:image" content="${ogImageSafe}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${ogImageSafe}" />
</head>
<body></body>
</html>`);
  } catch (err) {
    console.error("ShareProperty error:", err);
    return res.status(500).send("Server error");
  }
}

/* ------------------------ POST: /api/Property/PostProperty ------------------------ */
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

/* ------------------------ PUT: /api/Property/PutProperty/{id} ------------------------ */
export async function PutProperty(req, res) {
  const id = Number(req.params.id);
  if (!isValidId(id)) return res.status(400).json({ error: "Invalid id" });

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

/* ------------------------ DELETE: /api/Property/DeleteProperty/{id} ------------------------ */
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

/* ------------------------ GET: /api/Property/GetPropertyImages/{propertyId} ------------------------ */
export async function GetPropertyImages(req, res) {
  const propertyId = Number(req.params.propertyId);
  if (!isValidId(propertyId))
    return res.status(400).json({ error: "Invalid propertyId" });

  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("propertyId", sql.Int, propertyId)
      .query(
        `SELECT * FROM PropertiesImage WHERE PropertyId=@propertyId ORDER BY ImageId ASC`,
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

/* ------------------------ GET: /api/Property/GetPropertyMainImage/{propertyId} ------------------------ */
export async function GetPropertyMainImage(req, res) {
  const propertyId = Number(req.params.propertyId);
  if (!isValidId(propertyId))
    return res.status(400).json({ error: "Invalid propertyId" });

  try {
    const pool = await getPool();
    const result = await pool.request().input("propertyId", sql.Int, propertyId)
      .query(`
        SELECT TOP 1 ImageId, ImageUrl, PropertyId
        FROM PropertiesImage
        WHERE PropertyId = @propertyId
        ORDER BY ImageId ASC
      `);

    if (result.recordset.length === 0) {
      return res
        .status(404)
        .json({ message: "No image found for this property" });
    }

    res.json(result.recordset[0]);
  } catch (err) {
    console.error("GetPropertyMainImage error:", err);
    res.status(500).json({ error: "Server error" });
  }
}

/* ------------------------ POST: /api/Property/AddPropertyImage/:propertyId ------------------------ */
export async function AddPropertyImage(req, res) {
  const propertyId = Number(req.params.propertyId);
  const imageUrl = req.body?.imageUrl || req.body; // supports raw string or {imageUrl}

  if (!isValidId(propertyId) || !imageUrl) {
    return res.status(400).json({ error: "Missing propertyId or imageUrl" });
  }

  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("propertyId", sql.Int, propertyId)
      .input("imageUrl", sql.NVarChar(1000), String(imageUrl)).query(`
        INSERT INTO PropertiesImage (ImageUrl, PropertyId)
        OUTPUT INSERTED.ImageId, INSERTED.ImageUrl, INSERTED.PropertyId
        VALUES (@imageUrl, @propertyId)
      `);

    res.json(result.recordset[0]);
  } catch (err) {
    console.error("AddPropertyImage error:", err);
    res.status(500).json({ error: "Server error" });
  }
}

/* ------------------------ PUT: /api/Property/UpdatePropertyImages/{propertyId} ------------------------ */
export async function UpdatePropertyImages(req, res) {
  const propertyId = Number(req.params.propertyId);
  const urls = Array.isArray(req.body) ? req.body : [];
  if (!isValidId(propertyId))
    return res.status(400).json({ error: "Invalid propertyId" });

  try {
    const pool = await getPool();
    const tx = new sql.Transaction(pool);
    await tx.begin();

    try {
      await new sql.Request(tx)
        .input("propertyId", sql.Int, propertyId)
        .query(`DELETE FROM PropertiesImage WHERE PropertyId=@propertyId`);

      if (urls.length) {
        for (const u of urls) {
          await new sql.Request(tx)
            .input("propertyId", sql.Int, propertyId)
            .input("imageUrl", sql.NVarChar(1000), String(u))
            .query(
              `INSERT INTO PropertiesImage (ImageUrl, PropertyId) VALUES (@imageUrl, @propertyId)`,
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

/* ------------------------ DELETE: /api/Property/DeletePropertyImage/{propertyId}/{imageId} ------------------------ */
export async function DeletePropertyImage(req, res) {
  const propertyId = Number(req.params.propertyId);
  const imageId = Number(req.params.imageId);

  if (!isValidId(propertyId) || !isValidId(imageId))
    return res.status(400).json({ error: "Invalid params" });

  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("propertyId", sql.Int, propertyId)
      .input("imageId", sql.Int, imageId)
      .query(
        `DELETE FROM PropertiesImage WHERE PropertyId=@propertyId AND ImageId=@imageId`,
      );

    if ((result.rowsAffected?.[0] ?? 0) === 0) {
      return res.status(404).json({
        message: "Image not found or does not belong to the property",
      });
    }

    res.json({ message: "Image deleted successfully!" });
  } catch (err) {
    console.error("DeletePropertyImage error:", err);
    res.status(500).json({ error: "Server error" });
  }
}
