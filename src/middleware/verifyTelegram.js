export function verifyTelegram(req, res, next) {
  const initData = req.get("x-telegram-initdata");

  // 🔓 تخطي التحقق مؤقتاً أثناء التطوير
  if (!initData) {
    console.warn("⚠️ initData مفقود — السماح المؤقت بدون تحقق.");
    req.telegram = { user: { id: 111111111, first_name: "TestUser" } }; // بيانات وهمية
    return next();
  }

  // ✅ تحقق فعلي عندما يكون initData موجود
  const valid = verifyTelegramInitData(initData, process.env.BOT_TOKEN);
  if (!valid) {
    console.warn("⚠️ initData غير صالح — السماح المؤقت بدون تحقق.");
    req.telegram = { user: { id: 111111111, first_name: "TestUser" } };
    return next();
  }

  req.telegram = parseTelegramInitData(initData);
  next();
}
