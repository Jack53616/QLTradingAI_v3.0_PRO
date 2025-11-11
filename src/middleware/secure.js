import { parseTelegramInitData, verifyTelegramInitData } from "../utils/telegram.js";
import { log, warn } from "../utils/logger.js";

/**
 * Secure access middleware - Verifies Telegram WebApp authentication
 */
export function secureAccess(req, res, next) {
  const initData = req.get("x-telegram-initdata");

  // Check if initData exists
  if (!initData) {
    warn("⚠️ Missing Telegram initData in request", {
      path: req.path,
      method: req.method,
      ip: req.ip
    });
    return res.status(401).json({ 
      ok: false, 
      error: "telegram_auth_required",
      message: "This endpoint requires Telegram WebApp authentication"
    });
  }

  // Verify initData signature
  const isValid = verifyTelegramInitData(initData, process.env.BOT_TOKEN);
  
  if (!isValid) {
    warn("⚠️ Invalid Telegram initData signature", {
      path: req.path,
      method: req.method,
      ip: req.ip
    });
    return res.status(401).json({ 
      ok: false, 
      error: "invalid_telegram_auth",
      message: "Invalid Telegram authentication data"
    });
  }

  // Parse and attach user data
  const telegramUser = parseTelegramInitData(initData);
  
  if (!telegramUser || !telegramUser.id) {
    warn("⚠️ Failed to parse Telegram user data", {
      path: req.path,
      method: req.method
    });
    return res.status(401).json({ 
      ok: false, 
      error: "invalid_user_data",
      message: "Could not extract user information"
    });
  }

  // Attach telegram user to request
  req.telegram = telegramUser;
  
  log("✅ Telegram authentication successful", {
    userId: telegramUser.id,
    username: telegramUser.username,
    path: req.path
  });

  next();
}

/**
 * Development-only bypass (use with extreme caution)
 */
export function secureAccessDev(req, res, next) {
  if (process.env.NODE_ENV === "production") {
    return secureAccess(req, res, next);
  }

  // Development mode: allow bypass with warning
  warn("⚠️ DEVELOPMENT MODE: Bypassing Telegram authentication");
  req.telegram = {
    id: parseInt(process.env.DEV_USER_ID || "999999999"),
    first_name: "DevUser",
    username: "devuser"
  };
  next();
}
