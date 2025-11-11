import { parseTelegramInitData, verifyTelegramInitData } from "../utils/telegram.js";
import { warn } from "../utils/logger.js";

/**
 * Secure Telegram WebApp authentication middleware
 * Only allows access from valid Telegram WebApp with proper initData
 */
export function secureAccess(req, res, next) {
  const initData = req.get("x-telegram-initdata");

  // في وضع التطوير فقط، نسمح بالوصول
  if (process.env.NODE_ENV === "development" && process.env.DEV_USER_ID) {
    warn("⚠️ Development mode: bypassing Telegram authentication");
    req.telegram = {
      id: Number(process.env.DEV_USER_ID),
      first_name: "DevUser",
      username: "dev_user",
    };
    return next();
  }

  // في الإنتاج، يجب أن يكون هناك initData
  if (!initData) {
    warn("⚠️ Missing Telegram initData", {
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
