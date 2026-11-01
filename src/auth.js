// auth.js
// Admin authentication. The username and password live only in the server's environment
// (ADMIN_USERNAME / ADMIN_PASSWORD), never in the website's code. A successful login
// returns a signed, expiring token that the dashboard sends as "Authorization: Bearer ...".
import crypto from "node:crypto";
import { Router } from "express";

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

const config = () => ({
  username: process.env.ADMIN_USERNAME || "",
  password: process.env.ADMIN_PASSWORD || "",
  secret: process.env.ADMIN_TOKEN_SECRET || "",
});

// Signing key depends on the password too, so changing the password logs everyone out.
const signingKey = () => {
  const { password, secret } = config();
  return crypto.createHash("sha256").update(`realo-admin:${secret}:${password}`).digest();
};

const b64url = (buf) => Buffer.from(buf).toString("base64url");

const sign = (payload) => {
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(crypto.createHmac("sha256", signingKey()).update(body).digest());
  return `${body}.${sig}`;
};

const safeEqual = (a, b) => {
  // Hash both sides first so lengths match and timing does not leak the value.
  const ha = crypto.createHash("sha256").update(String(a)).digest();
  const hb = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
};

export const verifyToken = (token) => {
  if (!config().password || typeof token !== "string") return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = b64url(crypto.createHmac("sha256", signingKey()).update(body).digest());
  if (!safeEqual(sig, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    return payload.exp > Date.now() ? payload : null;
  } catch {
    return null;
  }
};

/* ------------------------- login throttle ------------------------- */
// Per-IP limit on failed logins to slow down password guessing.
const MAX_FAILS = 8;
const WINDOW_MS = 15 * 60 * 1000;
const failures = new Map();

// The hosting proxy appends the real client address last; earlier entries can be faked.
const clientIp = (req) =>
  String(req.headers["x-forwarded-for"] || "").split(",").pop().trim() || req.ip || "unknown";

const isLocked = (ip) => {
  const entry = failures.get(ip);
  if (!entry) return false;
  if (Date.now() - entry.first > WINDOW_MS) {
    failures.delete(ip);
    return false;
  }
  return entry.count >= MAX_FAILS;
};

const recordFailure = (ip) => {
  const entry = failures.get(ip);
  if (!entry || Date.now() - entry.first > WINDOW_MS) failures.set(ip, { count: 1, first: Date.now() });
  else entry.count += 1;
};

/* ----------------------------- routes ----------------------------- */
export const authRoutes = Router();

authRoutes.post("/Login", (req, res) => {
  const { username, password } = config();
  if (!username || !password) {
    return res.status(503).json({ error: "Admin login is not configured on the server." });
  }

  const ip = clientIp(req);
  if (isLocked(ip)) {
    return res.status(429).json({ error: "Too many attempts. Try again in 15 minutes." });
  }

  const ok =
    safeEqual(req.body?.username ?? "", username) & safeEqual(req.body?.password ?? "", password);
  if (!ok) {
    recordFailure(ip);
    return res.status(401).json({ error: "Invalid username or password." });
  }

  failures.delete(ip);
  const exp = Date.now() + TOKEN_TTL_MS;
  res.json({ token: sign({ sub: "admin", exp }), expiresAt: exp });
});

authRoutes.get("/Me", (req, res) => {
  const payload = verifyToken(bearer(req));
  if (!payload) return res.status(401).json({ error: "Not signed in." });
  res.json({ user: payload.sub, expiresAt: payload.exp });
});

/* --------------------------- middleware --------------------------- */
const bearer = (req) => {
  const header = req.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
};

const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// Every request that changes data (POST/PUT/PATCH/DELETE) needs a valid admin token,
// except logging in. Reads stay public because the website shows them to everyone.
export const requireAdminForWrites = (req, res, next) => {
  if (READ_METHODS.has(req.method)) return next();
  if (req.path === "/api/Auth/Login") return next();
  if (verifyToken(bearer(req))) return next();
  res.status(401).json({ error: "Admin login required." });
};
