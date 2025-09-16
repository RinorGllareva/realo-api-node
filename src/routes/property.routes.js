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
} from "../controllers/property.controller.js";

import { getPool, sql } from "../db/mssql.js";

const router = Router();

/* ============= API ROUTES ============= */

// Matches: /api/Property/GetProperties
router.get("/GetProperties", GetProperties);

// Matches: /api/Property/GetProperty/{id}
router.get("/GetProperty/:id", GetProperty);

// Matches: /api/Property/PostProperty
router.post("/PostProperty", PostProperty);

// Matches: /api/Property/PutProperty/{id}
router.put("/PutProperty/:id", PutProperty);

// Matches: /api/Property/DeleteProperty/{id}
router.delete("/DeleteProperty/:id", DeleteProperty);

// Matches: /api/Property/GetPropertyImages/{propertyId}
router.get("/GetPropertyImages/:propertyId", GetPropertyImages);

// Matches: /api/Property/GetPropertyMainImage/{propertyId}
router.get("/GetPropertyMainImage/:propertyId", GetPropertyMainImage);

// Matches: /api/Property/AddPropertyImage/{propertyId}
router.post("/AddPropertyImage/:propertyId", AddPropertyImage);

// Matches: /api/Property/UpdatePropertyImages/:propertyId
router.put("/UpdatePropertyImages/:propertyId", UpdatePropertyImages);

// Matches: /api/Property/DeletePropertyImage/{propertyId}/{imageId}
router.delete("/DeletePropertyImage/:propertyId/:imageId", DeletePropertyImage);

/* ============= SOCIAL PREVIEW ROUTE ============= */
// Dynamic OG tags so Facebook/LinkedIn/Twitter show property preview
// Dynamic property page with OG tags
router.get("/properties/:slug/:id", async (req, res) => {
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

    // Canonical page URL
    const pageUrl = `https://realo-realestate.com/properties/${encodeURIComponent(
      req.params.slug
    )}/${id}`;

    // Build a safe image URL (absolute)
    let imageUrl = "/og.png"; // fallback
    if (property.ImageUrl) {
      imageUrl = property.ImageUrl.startsWith("http")
        ? property.ImageUrl
        : `https://realo-realestate.com${property.ImageUrl}`;
    } else {
      imageUrl = `https://realo-realestate.com/og.png`;
    }

    // Return OG tags as HTML (this is what scrapers read)
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${property.Title || "Property Listing"}</title>
  <meta name="description" content="${property.Description || ""}" />

  <!-- Open Graph -->
  <meta property="og:title" content="${property.Title || "Property Listing"}" />
  <meta property="og:description" content="${property.Description || ""}" />
  <meta property="og:image" content="${imageUrl}" />
  <meta property="og:url" content="${pageUrl}" />
  <meta property="og:type" content="article" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${
    property.Title || "Property Listing"
  }" />
  <meta name="twitter:description" content="${property.Description || ""}" />
  <meta name="twitter:image" content="${imageUrl}" />
</head>
<body>
  <h1>${property.Title}</h1>
  <p>${property.Description || ""}</p>
  <img src="${imageUrl}" alt="Property Image" />
</body>
</html>`);
  } catch (err) {
    console.error("OG route error:", err);
    res.status(500).send("Server error");
  }
});

export default router;
