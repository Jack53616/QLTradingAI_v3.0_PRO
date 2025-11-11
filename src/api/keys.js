import express from "express";
import { pool } from "../utils/db.js";
import { hashKey } from "../utils/hash.js";
import { log, warn, error } from "../utils/logger.js";
import { parseTelegramInitData, verifyTelegramInitData } from "../utils/telegram.js";
import { strictRateLimiter } from "../middleware/rateLimiter.js";

export const keysRouter = express.Router();
keysRouter.use("/activate", strictRateLimiter());

/**
 * POST /api/keys/activate
 * Activate or extend a subscription key
 */
keysRouter.post("/activate", async (req, res) => {
  const { key, tg_id, name, username, email } = req.body || {};

  if (!key) {
    return res.status(400).json({
      ok: false,
      error: "missing_key",
      message: "Subscription key is required",
    });
  }

  // 🧠 Detect user
  let userId = tg_id;
  if (!userId) {
    const initData = req.get("x-telegram-initdata");
    if (initData && verifyTelegramInitData(initData, process.env.BOT_TOKEN)) {
      const telegram = parseTelegramInitData(initData);
      userId = telegram?.id;
    }
  }

  if (!userId) {
    userId = Number(process.env.DEV_USER_ID || 999999999);
  }

  const trimmedKey = key.trim().toUpperCase();
  const hashedKey = hashKey(trimmedKey);

  try {
    // 🧩 Verify key
    const { rows: keyRows, rowCount } = await pool.query(
      "SELECT id, key_code, used_by, used_at, duration_days, level FROM keys WHERE key_code = $1",
      [hashedKey]
    );

    if (!rowCount) {
      warn("⚠️ Invalid key attempt", { key: trimmedKey, userId });
      return res.status(400).json({
        ok: false,
        error: "invalid_key",
        message: "Invalid subscription key",
      });
    }

    const keyData = keyRows[0];
    const duration = keyData.duration_days || 30;
    const level = keyData.level || "Bronze";

    // 🛡️ Already used check
    if (keyData.used_by && keyData.used_by !== Number(userId)) {
      return res.status(409).json({
        ok: false,
        error: "key_used",
        message: "This key is already activated by another user",
      });
    }

    // 🧠 Ensure user exists before activation
    await pool.query(
      `INSERT INTO users (id, name, username, email, level, balance, sub_expires, created_at)
       VALUES ($1, $2, $3, $4, $5, 0, NOW() + ($6 || ' days')::interval, NOW())
       ON CONFLICT (id) DO UPDATE
         SET name = COALESCE(EXCLUDED.name, users.name),
             username = COALESCE(EXCLUDED.username, users.username),
             email = COALESCE(EXCLUDED.email, users.email),
             level = EXCLUDED.level,
             sub_expires = GREATEST(users.sub_expires, NOW()) + ($6 || ' days')::interval`,
      [userId, name || "User", username || "guest", email || null, level, duration.toString()]
    );

    // 🧾 Mark key as used
    await pool.query(
      "UPDATE keys SET used_by = $1, used_at = NOW() WHERE id = $2",
      [userId, keyData.id]
    );

    log("✅ Key activated successfully", { userId, duration, level });
    res.json({
      ok: true,
      duration,
      level,
      message: `Subscription activated for ${duration} days`,
    });
  } catch (err) {
    error("❌ Key activation error:", err);
    res.status(500).json({
      ok: false,
      error: "activation_failed",
      message: "Could not activate subscription key",
    });
  }
});
