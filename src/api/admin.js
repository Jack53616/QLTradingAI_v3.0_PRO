import express from "express";
import { verifyAdminJWT, signAdmin } from "../utils/jwt.js";
import { pool } from "../utils/db.js";

export const adminRouter = express.Router();

adminRouter.post("/login", (req, res) => {
  const { token } = req.body;
  if (token !== process.env.ADMIN_TOKEN) return res.status(401).json({ ok: false, error: "invalid_admin_token" });
  const jwt = signAdmin("root");
  res.json({ ok: true, jwt });
});

adminRouter.get("/users", verifyAdminJWT, async (req, res) => {
  const result = await pool.query("SELECT * FROM users ORDER BY id DESC");
  res.json({ ok: true, users: result.rows });
});
