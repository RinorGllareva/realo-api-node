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

    // ----- Build content -----
    const titleRaw = p?.title || "Property";
    const city = p?.city || "";
    const price = p?.price ? String(p.price).trim() : "";

    const descriptionRaw =
      [city, price ? `€${price.replace(/^€\s*/, "")}` : ""]
        .filter(Boolean)
        .join(" • ") || "View property";

    // Try common shapes for first image
    const firstImage =
      p?.images?.[0]?.imageUrl ||
      p?.images?.[0]?.ImageUrl ||
      p?.Images?.[0]?.ImageUrl ||
      p?.mainImageUrl ||
      p?.imageUrl ||
      "";

    const ogImage =
      toAbsoluteImageUrl(firstImage) ||
      "https://www.realo-realestate.com/og.png";

    const redirectUrl = buildSpaUrlFromProperty(p, id);
    const shareUrl = `https://www.realo-realestate.com/share/${id}`;

    // Escape only at the last moment
    const title = escapeHtml(titleRaw);
    const description = escapeHtml(descriptionRaw);
    const ogImageSafe = escapeHtml(ogImage);

    // ----- Bot detection -----
    const ua = (req.headers["user-agent"] || "").toLowerCase();
    const isBot =
      /facebookexternalhit|facebot|twitterbot|slackbot|whatsapp|telegrambot|discordbot|linkedinbot/i.test(
        ua,
      );

    // Humans: redirect to SPA property page
    if (!isBot) {
      return res.redirect(302, redirectUrl);
    }

    // Bots: OG HTML ONLY (no refresh, no JS redirect)
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
