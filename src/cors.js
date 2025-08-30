import cors from "cors";

const STATIC = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((s) => s.trim().replace(/\/+$/, ""))
  .filter(Boolean);

// Allow all *.vercel.app previews (optional)
const DYNAMIC = [/^https:\/\/[a-z0-9-]+\.vercel\.app$/i];

export const corsMiddleware = cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // server-to-server, curl
    if (STATIC.includes(origin) || DYNAMIC.some((rx) => rx.test(origin)))
      return cb(null, true);
    cb(new Error(`Not allowed by CORS: ${origin}`));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
});
