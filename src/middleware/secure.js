import { verifyTelegram } from "./verifyTelegram.js";
import { verifyAdminJWT } from "../utils/jwt.js";

export function secureAccess(req, res, next) {
  const auth = req.get("Authorization");
  const initData = req.get("x-telegram-initdata");

  if (auth && auth.startsWith("Bearer ")) return verifyAdminJWT(req, res, next);
  if (initData) return verifyTelegram(req, res, next);
  return res.status(401).json({ ok: false, error: "unauthorized" });
}
