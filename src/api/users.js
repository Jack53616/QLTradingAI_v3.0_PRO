import express from "express";
import { pool } from "../utils/db.js";
import { ensureAdmin } from "../utils/auth.js";

export const usersRouter = express.Router();

usersRouter.get("/", ensureAdmin, async (_req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, username, level, balance, sub_expires FROM users ORDER BY id DESC"
    );
    res.json({ ok: true, users: result.rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

usersRouter.get("/me", async (req, res) => {
  const userId = req.telegram?.id;
  if (!userId) return res.status(401).json({ ok: false, error: "telegram_only" });

  try {
    const { rows } = await pool.query(
      "SELECT id, name, username, level, balance, sub_expires FROM users WHERE id = $1",
      [userId]
    );
    if (!rows.length) return res.json({ ok: false, error: "not_found" });
    res.json({ ok: true, user: rows[0] });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});
