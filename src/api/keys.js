import express from "express";
import { pool } from "../utils/db.js";
import { hashKey } from "../utils/hash.js";
import { log } from "../utils/logger.js";
import { parseTelegramInitData, verifyTelegramInitData } from "../utils/telegram.js";

export const keysRouter = express.Router();

keysRouter.post("/activate", async (req, res) => {
  const { key, tg_id, name, username, email } = req.body || {};
  if (!key) return res.status(400).json({ ok: false, error: "missing_key" });

  let userId = tg_id;
  if (!userId) {
    const initData = req.get("x-telegram-initdata");
    if (initData && verifyTelegramInitData(initData, process.env.BOT_TOKEN)) {
      const telegram = parseTelegramInitData(initData);
      userId = telegram?.id;
    }
  }

  const hashedKey = hashKey(key.trim());

  const client = await pool.connect();

  let transactionStarted = false;

  try {
    await client.query("BEGIN");
    transactionStarted = true;

    const keyResult = await client.query(
      `SELECT id, used_by, duration_days, level
         FROM keys
        WHERE key_code = $1
        FOR UPDATE`,
      [hashedKey]
    );

    if (!keyResult.rowCount) {
      await client.query("ROLLBACK");
      transactionStarted = false;
      return res.status(400).json({ ok: false, error: "invalid_key" });
    }

    const keyData = keyResult.rows[0];

    if (!userId) {
      userId = keyData.used_by;
    }

    const numericUserId = Number(userId);
    if (!numericUserId) {
      await client.query("ROLLBACK");
      transactionStarted = false;
      return res.status(400).json({ ok: false, error: "missing_user" });
    }

    userId = numericUserId;

    if (keyData.used_by && keyData.used_by !== numericUserId) {
      await client.query("ROLLBACK");
      transactionStarted = false;
      return res.status(409).json({ ok: false, error: "key_used" });
    }

    const duration = keyData.duration_days || 30;
    const level = keyData.level || "Bronze";

    const existingUserResult = await client.query(
      `SELECT id, name, username, email, level, balance, sub_expires
         FROM users
        WHERE id = $1
        FOR UPDATE`,
      [numericUserId]
    );

    let userRow;

    if (existingUserResult.rowCount) {
      const current = existingUserResult.rows[0];
      const updateResult = await client.query(
        `UPDATE users
            SET name = COALESCE($2, name),
                username = COALESCE($3, username),
                email = COALESCE($4, email),
                level = $5,
                sub_expires = GREATEST(COALESCE(sub_expires, NOW()), NOW()) + ($6 || ' days')::interval
          WHERE id = $1
        RETURNING id, name, username, level, balance, sub_expires`,
        [
          numericUserId,
          name || current.name || null,
          username || current.username || null,
          email || current.email || null,
          level,
          duration.toString(),
        ]
      );
      userRow = updateResult.rows[0];
    } else {
      const insertResult = await client.query(
        `INSERT INTO users (id, name, username, email, level, balance, sub_expires)
         VALUES ($1, $2, $3, $4, $5, 0, NOW() + ($6 || ' days')::interval)
        RETURNING id, name, username, level, balance, sub_expires`,
        [numericUserId, name || null, username || null, email || null, level, duration.toString()]
      );
      userRow = insertResult.rows[0];
    }

    await client.query(
      `UPDATE keys
          SET used_by = $1,
              used_at = NOW()
        WHERE id = $2`,
      [numericUserId, keyData.id]
    );

    await client.query("COMMIT");
    transactionStarted = false;

    res.json({ ok: true, user: userRow, duration, level });
  } catch (err) {
    if (transactionStarted) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("❌ Failed to rollback key activation", rollbackError);
      }
    }
    console.error("❌ Key activation error", {
      providedKey: key,
      hashedKey,
      tg_id: tg_id || null,
      derivedUserId: userId || null,
      error: err?.message,
      stack: err?.stack,
    });
    log("❌ Key activation error", err);
    res.status(500).json({ ok: false, error: "activation_failed" });
  } finally {
    client.release();
  }
});
