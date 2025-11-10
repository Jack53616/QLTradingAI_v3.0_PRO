import jwt from "jsonwebtoken";

export function signAdmin(id) {
  return jwt.sign({ id, role: "admin" }, process.env.JWT_SECRET, { expiresIn: "24h" });
}

export function verifyAdminJWT(req, res, next) {
  const auth = req.get("Authorization") || "";
  const token = auth.split(" ")[1];
  if (!token) return res.status(401).json({ ok: false, error: "missing_token" });

  try {
    const data = jwt.verify(token, process.env.JWT_SECRET);
    if (data.role !== "admin") throw new Error("invalid_role");
    req.admin = data;
    next();
  } catch {
    res.status(401).json({ ok: false, error: "invalid_token" });
  }
}
