import express from "express";
import { pool } from "../utils/db.js";
import { ensureAdmin } from "../utils/auth.js";

export const usersRouter = express.Router();

// 🧩 Get all users (Admin)
usersRouter.get("/", ensureAdmin, async (_req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, name, email, level, balance, sub_expires FROM users ORDER BY id DESC"
    );
    const usersWithAlias = rows.map(u => ({ ...u, tg_id: u.id }));
    res.json({ ok: true, users: usersWithAlias });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 🧠 Get current user
// 🔍 Get user by Telegram ID
usersRouter.get("/:tg", async (req, res) => {
  try {
    const tgId = Number(req.params.tg);
    if (!tgId) return res.status(400).json({ ok: false, error: "invalid_tg_id" });

    const { rows } = await pool.query(
      "SELECT id, name, email, level, balance, sub_expires FROM users WHERE id = $1",
      [tgId]
    );

    if (!rows.length) {
      return res.json({ ok: false, error: "user_not_found" });
    }

    const userWithAlias = { ...rows[0], tg_id: rows[0].id };
    res.json({ ok: true, user: userWithAlias });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

usersRouter.get("/me", async (req, res) => {
  try {
    const userId = req.telegram?.id || process.env.DEV_USER_ID || 999999999;

    if (!userId) return res.status(401).json({ ok: false, error: "no_user" });

    let { rows } = await pool.query(
      "SELECT id, name, email, level, balance, sub_expires FROM users WHERE id = $1",
      [userId]
    );

    // Create fallback user if missing
    if (!rows.length) {
      const { rows: insert } = await pool.query(
        `INSERT INTO users (id, name, email, level, balance, sub_expires, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW() + interval '30 days', NOW())
         RETURNING id, name, email, level, balance, sub_expires`,
        [userId, "NewUser", null, "Bronze", 0]
      );
      rows = insert;
    }

    const userWithAlias = { ...rows[0], tg_id: rows[0].id };
    res.json({ ok: true, user: userWithAlias });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});
