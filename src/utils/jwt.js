import jwt from "jsonwebtoken";
import { config } from "../config/env.js";
import { log } from "./logger.js";

const JWT_SECRET = config.JWT_SECRET || "change-this-secret-in-production";
const JWT_EXPIRES_IN = "24h";

/**
 * Sign a JWT token for admin
 * @param {string} username - Admin username
 * @returns {string} - Signed JWT token
 */
export function signAdmin(username) {
  return jwt.sign(
    { 
      username, 
      role: "admin",
      iat: Math.floor(Date.now() / 1000)
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

/**
 * Verify admin JWT token middleware
 */
export function verifyAdminJWT(req, res, next) {
  const authHeader = req.get("Authorization");
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ ok: false, error: "missing_token" });
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    if (decoded.role !== "admin") {
      return res.status(403).json({ ok: false, error: "insufficient_permissions" });
    }

    req.admin = decoded;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ ok: false, error: "token_expired" });
    }
    log("❌ JWT verification failed:", err.message);
    return res.status(401).json({ ok: false, error: "invalid_token" });
  }
}
