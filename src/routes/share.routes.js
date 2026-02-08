export async function ShareProperty(req, res) {
  const id = Number(req.params.id);
  if (!isValidId(id)) return res.status(400).send("Invalid id");

  try {
    // ... fetch property, build p ...

    const redirectUrl = buildSpaUrlFromProperty(p, id);
    const shareUrl = `https://www.realo-realestate.com/share/${id}`;

    const title = escapeHtml(titleRaw);
    const description = escapeHtml(descriptionRaw);
    const ogImageSafe = escapeHtml(ogImage);

    // ✅ ADD THIS RIGHT HERE
    const ua = (req.headers["user-agent"] || "").toLowerCase();
    const isBot =
      /facebookexternalhit|facebot|twitterbot|slackbot|whatsapp|telegram|discord|linkedin/i.test(
        ua,
      );

    // Humans: go to SPA page
    if (!isBot) {
      return res.redirect(302, redirectUrl);
    }

    // Bots: OG tags only (NO redirect)
    res.set("Content-Type", "text/html; charset=utf-8");
    res.set("Cache-Control", "no-store");

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
