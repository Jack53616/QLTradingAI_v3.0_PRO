import { parseTelegramInitData, verifyTelegramInitData } from "../utils/telegram.js";
import { warn } from "../utils/logger.js";

/**
 * Verify Telegram WebApp initData middleware
 * This is a stricter version that always requires valid Telegram authentication
 */
export function verifyTelegram(req, res, next) {
  const initData = req.get("x-telegram-initdata");

  if (!initData) {
    warn("⚠️ Missing Telegram initData");
    return res.status(401).json({ 
      ok: false, 
      error: "telegram_required",
      message: "Telegram WebApp authentication is required"
    });
  }

  // Verify the signature
  const isValid = verifyTelegramInitData(initData, process.env.BOT_TOKEN);
  
  if (!isValid) {
    warn("⚠️ Invalid Telegram initData signature");
    return res.status(401).json({ 
      ok: false, 
      error: "invalid_signature",
      message: "Invalid Telegram authentication signature"
    });
  }

  // Parse user data
  const telegramUser = parseTelegramInitData(initData);
  
  if (!telegramUser || !telegramUser.id) {
    warn("⚠️ Could not parse Telegram user data");
    return res.status(401).json({ 
      ok: false, 
      error: "invalid_user_data",
      message: "Could not extract user information from Telegram data"
    });
  }

  req.telegram = telegramUser;
  next();
}
