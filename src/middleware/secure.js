export function secureAccess(req, res, next) {
  // 🟢 تمت إزالة نظام الحماية بالكامل
  // جميع الطلبات مسموح بها بدون تحقق من Telegram أو JWT
  req.telegram = { user: { id: 999999999, first_name: "GuestUser" } };
  return next();
}
