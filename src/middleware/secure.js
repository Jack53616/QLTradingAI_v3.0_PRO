import { warn } from "../utils/logger.js";

/**
 * Telegram authentication DISABLED
 * Allows all requests (for dev/testing)
 */
export function secureAccess(req, _res, next) {
  warn("⚠️ Telegram authentication bypassed (dev mode active)", {
    path: req.path,
    method: req.method,
  });

  if (!req.telegram) {
    req.telegram = {
      id: Number(process.env.DEV_USER_ID || 999999999),
      first_name: "DevUser",
      username: "dev_user",
    };
  }

  next();
}

export function secureAccessDev(req, res, next) {
  return secureAccess(req, res, next);
}
