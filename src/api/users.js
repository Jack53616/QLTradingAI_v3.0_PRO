import express from "express";
import { pool } from "../utils/db.js";
import { ensureAdmin } from "../utils/auth.js";

export const usersRouter = express.Router();

// 🧩 Get all users (Admin)
usersRouter.get("/", ensureAdmin, async (_req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, name, username, level, balance, sub_expires FROM users ORDER BY id DESC"
    );
    res.json({ ok: true, users: rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 🧠 Get current user
usersRouter.get("/me", async (req, res) => {
  try {
    const userId = req.telegram?.id || process.env.DEV_USER_ID || 999999999;

    if (!userId) return res.status(401).json({ ok: false, error: "no_user" });

    let { rows } = await pool.query(
      "SELECT id, name, username, level, balance, sub_expires FROM users WHERE id = $1",
      [userId]
    );

    // Create fallback user if missing
    if (!rows.length) {
      const { rows: insert } = await pool.query(
        `INSERT INTO users (id, name, username, level, balance, sub_expires, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW() + interval '30 days', NOW())
         RETURNING id, name, username, level, balance, sub_expires`,
        [userId, "NewUser", "guest", "Bronze", 0]
      );
      rows = insert;
    }

    res.json({ ok: true, user: rows[0] });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});
