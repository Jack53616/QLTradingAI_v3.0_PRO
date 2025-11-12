import jwt from "jsonwebtoken";
import { config } from "../config/env.js";

const JWT_SECRET = config.JWT_SECRET || "ql_wallet_dev_secret";

export function authenticate(req, res, next) {
  const authHeader = req.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;

  if (!token) {
    return res.status(401).json({ success: false, message: "authentication_required" });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: "invalid_token" });
  }
}

export function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ success: false, message: "admin_only" });
  }

  next();
}

export function signToken(payload, options = {}) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "12h", ...options });
}
