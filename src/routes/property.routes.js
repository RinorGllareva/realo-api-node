import { Router } from "express";
import {
  GetProperties,
  GetProperty,
  PostProperty,
  PutProperty,
  DeleteProperty,
  GetPropertyImages,
  AddPropertyImage,
  UpdatePropertyImages,
  DeletePropertyImage,
  GetPropertyMainImage,
  ShareProperty,
} from "../controllers/property.controller.js";

import { getPool, sql } from "../db/mssql.js";

const router = Router();

/* ============= API ROUTES ============= */
router.get("/GetProperties", GetProperties);
router.get("/GetProperty/:id", GetProperty);
router.post("/PostProperty", PostProperty);
router.put("/PutProperty/:id", PutProperty);
router.delete("/DeleteProperty/:id", DeleteProperty);
router.get("/GetPropertyImages/:propertyId", GetPropertyImages);
router.get("/GetPropertyMainImage/:propertyId", GetPropertyMainImage);
router.post("/AddPropertyImage/:propertyId", AddPropertyImage);
router.put("/UpdatePropertyImages/:propertyId", UpdatePropertyImages);
router.delete("/DeletePropertyImage/:propertyId/:imageId", DeletePropertyImage);

/* ✅ OG Share endpoint (this one is enough) */
router.get("/ShareProperty/:id", ShareProperty);

/* ❌ Optional (I recommend deleting this entire route) */
router.get("/og/property/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).send("Invalid property id");

  try {
    const pool = await getPool();
    const result = await pool.request().input("id", sql.Int, id).query(`
      SELECT TOP 1 p.Title, p.Description, i.ImageUrl
      FROM Properties p
      LEFT JOIN PropertiesImage i ON p.PropertyId = i.PropertyId
      WHERE p.PropertyId = @id
      ORDER BY i.ImageId ASC
    `);

    if (result.recordset.length === 0) {
      return res.status(404).send("Property not found");
    }

    const property = result.recordset[0];

    const pageUrl = `https://www.realo-realestate.com/properties/${encodeURIComponent(
      property.Title.replace(/\s+/g, "-"),
    )}/${id}`;

    const imageUrl = property.ImageUrl?.startsWith("http")
      ? property.ImageUrl
      : `https://www.realo-realestate.com/og.png`;

    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${property.Title}</title>
  <meta name="description" content="${property.Description || ""}" />

  <meta property="og:title" content="${property.Title}" />
  <meta property="og:description" content="${property.Description || ""}" />
  <meta property="og:image" content="${imageUrl}" />
  <meta property="og:url" content="${pageUrl}" />
  <meta property="og:type" content="article" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${property.Title}" />
  <meta name="twitter:description" content="${property.Description || ""}" />
  <meta name="twitter:image" content="${imageUrl}" />
</head>
<body></body>
</html>`);
  } catch (err) {
    console.error("OG route error:", err);
    res.status(500).send("Server error");
  }
});

export default router;
