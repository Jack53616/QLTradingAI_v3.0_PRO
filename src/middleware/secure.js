import { log, warn } from "../utils/logger.js";

/**
 * secure.js — TELEGRAM AUTH DISABLED (DANGEROUS)
 *
 * This middleware intentionally bypasses Telegram WebApp authentication
 * and allows all requests to pass through. Use only for local testing
 * or short debugging sessions. Remove or revert this file as soon as
 * you finish testing.
 */

/**
 * Disabled secureAccess: allow all requests
 */
export function secureAccess(req, res, next) {
  // Log a loud warning for every request (optional — helps audit)
  warn("⚠️ Telegram security check DISABLED — allowing all requests", {
    path: req.path,
    method: req.method,
    ip: req.ip,
  });

  // Optionally attach a dummy telegram user if some code expects req.telegram
  // Comment or remove the block below if you don't want any dummy data attached.
  if (!req.telegram) {
    req.telegram = {
      id: Number(process.env.DEV_USER_ID || 999999999),
      first_name: process.env.DEV_USER_FIRST_NAME || "DevUser",
      username: process.env.DEV_USER_USERNAME || "devuser",
      // you can add other fields your code expects (language_code, last_name, etc.)
    };
  }

  return next();
}

/**
 * secureAccessDev kept for compatibility (just calls the disabled secureAccess)
 * Keeps existing imports/usage unchanged elsewhere in the codebase.
 */
export function secureAccessDev(req, res, next) {
  // Same behaviour: pass all requests
  warn("⚠️ secureAccessDev: bypassing Telegram auth (disabled globally)");
  if (!req.telegram) {
    req.telegram = {
      id: Number(process.env.DEV_USER_ID || 999999999),
      first_name: process.env.DEV_USER_FIRST_NAME || "DevUser",
      username: process.env.DEV_USER_USERNAME || "devuser",
    };
  }
  return next();
}
