// index.js
import express from "express";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";
import propertyRoutes from "./routes/property.routes.js";

dotenv.config();

const app = express();

/* ------------------------- middleware ------------------------- */
app.use(express.json({ limit: "2mb" }));
app.use(morgan("dev"));

/* --------------------------- CORS ----------------------------- */
/**
 * Put this in Render env (no trailing slashes):
 * CORS_ORIGINS=https://realo-realestate.com,https://www.realo-realestate.com,https://realo-realestate-git-main-rinorgllarevas-projects.vercel.app
 *
 * If you want to allow ALL preview URLs, the regex below handles *.vercel.app.
 */
const STATIC_ORIGINS = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((s) => s.trim().replace(/\/+$/, "")) // strip trailing slashes
  .filter(Boolean);

// allow all *.vercel.app previews (optional but helpful)
const DYNAMIC_ORIGINS = [/^https:\/\/[a-z0-9-]+\.vercel\.app$/i];

const corsOptions = {
  origin: (origin, cb) => {
    // no Origin => server-to-server/curl/Postman: allow
    if (!origin) return cb(null, true);

    const normalized = origin.replace(/\/+$/, "");
    const allowedStatic = STATIC_ORIGINS.includes(normalized);
    const allowedDynamic = DYNAMIC_ORIGINS.some((rx) => rx.test(normalized));

    if (allowedStatic || allowedDynamic) return cb(null, true);
    return cb(new Error(`Not allowed by CORS: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
// handle preflight for every route
app.options("*", cors(corsOptions));

/* ------------------------ health check ------------------------ */
app.get("/health", (_req, res) => res.status(200).json({ status: "ok" }));

/* --------------------------- routes --------------------------- */
// Match your .NET-style path: /api/Property/...
app.use("/api/Property", propertyRoutes);

/* --------------------------- 404 ------------------------------ */
app.use((req, res) => {
  res.status(404).json({ error: "Not found", path: req.originalUrl });
});

/* ------------------------ error handler ----------------------- */
app.use((err, _req, res, _next) => {
  // CORS or other errors fall through here
  const status = err.message?.startsWith("Not allowed by CORS") ? 403 : 500;
  res.status(status).json({ error: err.message || "Server error" });
});
import propertyRoutes from "./routes/property.routes.js";
app.use("/api/Property", propertyRoutes);

/* --------------------------- start ---------------------------- */
const PORT = Number(process.env.PORT || 3000);
// Bind on 0.0.0.0 for Render
app.listen(PORT, "0.0.0.0", () => {
  console.log(`API listening on http://0.0.0.0:${PORT}`);
});
