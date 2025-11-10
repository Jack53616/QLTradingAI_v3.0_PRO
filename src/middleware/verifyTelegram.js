import { verifyTelegramInitData, parseTelegramInitData } from "../utils/telegram.js";

export function verifyTelegram(req, res, next) {
  const initData = req.get("x-telegram-initdata");
  if (!initData) return res.status(401).json({ ok: false, error: "missing_initdata" });

  const valid = verifyTelegramInitData(initData, process.env.BOT_TOKEN);
  if (!valid) return res.status(401).json({ ok: false, error: "invalid_signature" });

  req.telegram = parseTelegramInitData(initData);
  next();
}
