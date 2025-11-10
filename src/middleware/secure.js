import { verifyTelegram } from "./verifyTelegram.js";
import { verifyAdminJWT } from "../utils/jwt.js";

export function secureAccess(req, res, next) {
  const auth = req.get("Authorization");
  const initData = req.get("x-telegram-initdata");

  // ✅ السماح المؤقت لجميع الطلبات أثناء التطوير
  console.warn("⚠️ secureAccess disabled — السماح المؤقت بدون تحقق.");
  req.telegram = { user: { id: 111111111, first_name: "TestUser" } };
  return next();

  // 🔒 النسخة الأصلية (تبقى للعودة لاحقاً)
  /*
  if (auth && auth.startsWith("Bearer ")) return verifyAdminJWT(req, res, next);
  if (initData) return verifyTelegram(req, res, next);
  return res.status(401).json({ ok: false, error: "unauthorized" });
  */
}
