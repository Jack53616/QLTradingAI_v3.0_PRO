export function ensureAdmin(req, res, next) {
  if (!req.admin) return res.status(401).json({ ok: false, error: "admin_required" });
  next();
}
