import express from "express";
import { pool } from "../utils/db.js";
import { hashKey } from "../utils/hash.js";

export const authRouter = express.Router();

// 🎫 Get token (optional - for compatibility)
authRouter.post("/token", async (req, res) => {
  try {
    const { tg_id } = req.body;
    if (!tg_id) return res.status(400).json({ ok: false, error: "missing_tg_id" });

    // For now, just return success (token not needed in current implementation)
    res.json({ ok: true, token: null });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 🔑 Activate subscription
authRouter.post("/activate", async (req, res) => {
  try {
    const { key, tg_id, name, email } = req.body;

    if (!key) return res.status(400).json({ ok: false, error: "missing_key" });
    if (!tg_id) return res.status(400).json({ ok: false, error: "missing_tg_id" });

    const keyHash = hashKey(key);

    // Check if key exists and is valid
    const keyResult = await pool.query(
      "SELECT * FROM subscription_keys WHERE key_hash = $1",
      [keyHash]
    );

    if (!keyResult.rows.length) {
      return res.json({ ok: false, error: "invalid_key" });
    }

    const keyData = keyResult.rows[0];

    if (keyData.used) {
      return res.json({ ok: false, error: "key_already_used" });
    }

    if (keyData.expires_at && new Date(keyData.expires_at) < new Date()) {
      return res.json({ ok: false, error: "key_expired" });
    }

    // Check if user already exists
    let userResult = await pool.query(
      "SELECT * FROM users WHERE tg_id = $1",
      [tg_id]
    );

    let user;

    if (userResult.rows.length) {
      // Update existing user
      const updateResult = await pool.query(
        `UPDATE users 
         SET name = COALESCE($2, name),
             email = COALESCE($3, email),
             level = $4,
             sub_expires = NOW() + ($5 || ' days')::interval
         WHERE tg_id = $1
         RETURNING id, tg_id, name, email, level, balance, sub_expires`,
        [tg_id, name, email, keyData.level, keyData.duration_days]
      );
      user = updateResult.rows[0];
    } else {
      // Create new user
      const insertResult = await pool.query(
        `INSERT INTO users (tg_id, name, email, level, balance, sub_expires, created_at)
         VALUES ($1, $2, $3, $4, 0, NOW() + ($5 || ' days')::interval, NOW())
         RETURNING id, tg_id, name, email, level, balance, sub_expires`,
        [tg_id, name || "User", email, keyData.level, keyData.duration_days]
      );
      user = insertResult.rows[0];
    }

    // Mark key as used
    await pool.query(
      "UPDATE subscription_keys SET used = true, used_by = $1, used_at = NOW() WHERE key_hash = $2",
      [tg_id, keyHash]
    );

    res.json({ ok: true, user });
  } catch (err) {
    console.error("Activate error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});
