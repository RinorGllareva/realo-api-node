import express from "express";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";
import propertyRoutes from "./routes/property.routes.js";

dotenv.config();

const app = express();

// Middleware
app.use(express.json({ limit: "2mb" }));
app.use(morgan("dev"));

// CORS
const allowed = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || allowed.length === 0 || allowed.includes(origin))
        return cb(null, true);
      return cb(new Error("Not allowed by CORS"), false);
    },
    credentials: true,
  })
);

// Health
app.get("/health", (_req, res) => res.json({ status: "ok" }));

// Routes (match .NET: [Route("api/[controller]/[action]")])
app.use("/api/Property", propertyRoutes);

// 404
app.use((req, res) => {
  res.status(404).json({ error: "Not found", path: req.originalUrl });
});

// Start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API listening on :${PORT}`));
