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
    log(`🔹 Starting key activation for user: ${userId}`);

    await client.query("BEGIN");
    transactionStarted = true;

    // 🔍 جلب بيانات المفتاح مع قفل الصف
    const keyResult = await client.query(
      "SELECT id, used_by, duration_days, level FROM keys WHERE key_code = $1 FOR UPDATE",
      [hashedKey]
    );

    if (!keyResult.rowCount) {
      await client.query("ROLLBACK");
      return res.status(400).json({ ok: false, error: "invalid_key" });
    }

    const keyData = keyResult.rows[0];

    // 🚫 مفتاح مستخدم من قبل
    if (keyData.used_by && keyData.used_by !== Number(userId)) {
      await client.query("ROLLBACK");
      return res.status(409).json({ ok: false, error: "key_used" });
    }

    const duration = keyData.duration_days || 30;
    const level = keyData.level || "Bronze";

    // 🧩 تحديث أو إدخال المستخدم
    const userQuery = `
      INSERT INTO users (id, name, username, email, level, balance, sub_expires)
      VALUES ($1, $2, $3, $4, $5, 0, NOW() + ($6 || ' days')::interval)
      ON CONFLICT (id) DO UPDATE SET
        name = COALESCE(EXCLUDED.name, users.name),
        username = COALESCE(EXCLUDED.username, users.username),
        email = COALESCE(EXCLUDED.email, users.email),
        level = EXCLUDED.level,
        sub_expires = COALESCE(users.sub_expires, NOW()) + ($6 || ' days')::interval
      RETURNING id, name, username, level, sub_expires;
    `;

    const userResult = await client.query(userQuery, [
      userId,
      name || null,
      username || null,
      email || null,
      level,
      duration.toString()
    ]);

    // 🗝️ تحديث حالة المفتاح
    await client.query(
      "UPDATE keys SET used_by = $1, used_at = NOW() WHERE id = $2",
      [userId, keyData.id]
    );

    await client.query("COMMIT");
    transactionStarted = false;

    log(`✅ Subscription activated successfully for user ${userId} (${level}, ${duration}d)`);

    return res.json({
      ok: true,
      user: userResult.rows[0],
      message: "✅ تم تفعيل اشتراكك بنجاح!"
    });
  } catch (err) {
    if (transactionStarted) await client.query("ROLLBACK");
    log("❌ Key activation error:", err.message || err);
    return res.status(500).json({ ok: false, error: err.message || "activation_failed" });
  } finally {
    client.release();
  }
});
