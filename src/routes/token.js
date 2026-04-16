import express from "express";
import jwt from "jsonwebtoken";
import { pool } from "../utils/db.js";

const router = express.Router();

router.post("/", async (req, res) => {
  const { tg_id } = req.body || {};

  if (!tg_id) {
    return res.status(400).json({ ok: false, error: "tg_id_required" });
  }

  try {
    const { rows } = await pool.query(
      "SELECT id, tg_id, status FROM users WHERE tg_id = $1",
      [tg_id]
    );

    if (!rows.length) {
      return res.status(404).json({ ok: false, error: "user_not_found" });
    }

    const user = rows[0];
    const secret = process.env.JWT_SECRET || process.env.SESSION_SECRET || "ql-trading-secret";
    const token = jwt.sign(
      { id: user.id, tg_id: user.tg_id },
      secret,
      { expiresIn: "7d" }
    );

    res.json({ ok: true, token });
  } catch (err) {
    console.error("Token generation error:", err);
    res.status(500).json({ ok: false, error: "server_error" });
  }
});

export default router;
