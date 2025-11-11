import express from "express";
import { pool } from "../utils/db.js";
import { hashKey } from "../utils/hash.js";
import { log, warn, error } from "../utils/logger.js";
import { parseTelegramInitData, verifyTelegramInitData } from "../utils/telegram.js";
import { strictRateLimiter } from "../middleware/rateLimiter.js";

export const keysRouter = express.Router();

// Apply strict rate limiting to key activation
keysRouter.use("/activate", strictRateLimiter());

/**
 * POST /api/keys/activate
 * Activate a subscription key
 */
keysRouter.post("/activate", async (req, res) => {
  const { key, tg_id, name, username, email } = req.body || {};
  
  if (!key || typeof key !== "string") {
    return res.status(400).json({ 
      ok: false, 
      error: "missing_key",
      message: "Subscription key is required"
    });
  }

  // Get user ID from Telegram or request body
  let userId = tg_id;
  if (!userId) {
    const initData = req.get("x-telegram-initdata");
    if (initData && verifyTelegramInitData(initData, process.env.BOT_TOKEN)) {
      const telegram = parseTelegramInitData(initData);
      userId = telegram?.id;
    }
  }

  if (!userId) {
    return res.status(400).json({ 
      ok: false, 
      error: "missing_user",
      message: "User identification required"
    });
  }

  const trimmedKey = key.trim().toUpperCase();
  const hashedKey = hashKey(trimmedKey);

  try {
    // Check if key exists
    const { rows: keyRows, rowCount } = await pool.query(
      "SELECT id, key_code, used_by, used_at, duration_days, level FROM keys WHERE key_code = $1",
      [hashedKey]
    );

    if (!rowCount) {
      warn("⚠️ Invalid key attempt", { key: trimmedKey.substring(0, 4) + "****", userId });
      return res.status(400).json({ 
        ok: false, 
        error: "invalid_key",
        message: "This subscription key is invalid"
      });
    }

    const keyData = keyRows[0];

    // Check if key is already used by another user
    if (keyData.used_by && keyData.used_by !== Number(userId)) {
      warn("⚠️ Key already used", { 
        keyId: keyData.id, 
        usedBy: keyData.used_by, 
        attemptBy: userId 
      });
      return res.status(409).json({ 
        ok: false, 
        error: "key_used",
        message: "This key has already been activated by another user"
      });
    }

    const duration = keyData.duration_days || 30;
    const level = keyData.level || "Bronze";

    // Activate key and update/create user
    const { rows: userRows } = await pool.query(
      `INSERT INTO users (id, name, username, email, level, balance, sub_expires, created_at)
       VALUES ($1, $2, $3, $4, $5, 0, NOW() + ($6 || ' days')::interval, NOW())
       ON CONFLICT (id) DO UPDATE SET
         name = COALESCE(EXCLUDED.name, users.name),
         username = COALESCE(EXCLUDED.username, users.username),
         email = COALESCE(EXCLUDED.email, users.email),
         level = EXCLUDED.level,
         sub_expires = GREATEST(users.sub_expires, NOW()) + ($6 || ' days')::interval
       RETURNING id, name, username, level, balance, sub_expires`,
      [userId, name || null, username || null, email || null, level, duration.toString()]
    );

    // Mark key as used
    if (!keyData.used_by) {
      await pool.query(
        "UPDATE keys SET used_by = $1, used_at = NOW() WHERE id = $2",
        [userId, keyData.id]
      );
    }

    log("✅ Key activated successfully", {
      keyId: keyData.id,
      userId,
      duration,
      level
    });

    res.json({ 
      ok: true, 
      user: userRows[0], 
      duration,
      message: `Subscription activated for ${duration} days`
    });

  } catch (err) {
    error("❌ Key activation error:", err);
    res.status(500).json({ 
      ok: false, 
      error: "activation_failed",
      message: "Could not activate subscription key"
    });
  }
});
