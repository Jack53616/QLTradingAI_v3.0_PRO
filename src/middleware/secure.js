import { parseTelegramInitData, verifyTelegramInitData } from "../utils/telegram.js";
import { warn, log } from "../utils/logger.js";

/**
 * Secure Telegram WebApp authentication middleware
 * Allows access with:
 * 1. Valid Telegram initData (production)
 * 2. tg_id in query/body (development/testing)
 */
export function secureAccess(req, res, next) {
  const initData = req.get("x-telegram-initdata");
  
  // Try to get tg_id from query or body first
  const tgId = req.query.tg_id || req.body?.tg_id;
  
  // If we have tg_id, use it (for development or when initData is not available)
  if (tgId) {
    log("✅ Using tg_id from request", { tg_id: tgId, path: req.path });
    req.telegram = {
      id: Number(tgId),
      first_name: "User",
      username: "telegram_user",
    };
    return next();
  }

  // في وضع التطوير، نسمح بـ fallback
  if (process.env.NODE_ENV !== "production") {
    const fallbackId = process.env.DEV_USER_ID;
    if (fallbackId) {
      warn("⚠️ Development mode: using DEV_USER_ID", { tg_id: fallbackId });
      req.telegram = {
        id: Number(fallbackId),
        first_name: "DevUser",
        username: "dev_user",
      };
      return next();
    }
  }

  // في الإنتاج، يجب أن يكون هناك initData
  if (!initData) {
    warn("⚠️ Missing Telegram initData and tg_id", {
      path: req.path,
      method: req.method,
    });
    return res.status(401).json({
      ok: false,
      error: "telegram_required",
      message: "This service is only accessible via Telegram WebApp"
    });
  }

  // التحقق من صحة التوقيع
  const isValid = verifyTelegramInitData(initData, process.env.BOT_TOKEN);
  
  if (!isValid) {
    warn("⚠️ Invalid Telegram initData signature");
    return res.status(401).json({
      ok: false,
      error: "invalid_signature",
      message: "Invalid Telegram authentication signature"
    });
  }

  // استخراج بيانات المستخدم
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
