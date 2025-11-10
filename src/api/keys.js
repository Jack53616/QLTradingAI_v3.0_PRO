import express from "express";
import { pool } from "../utils/db.js";
import { hashKey } from "../utils/hash.js";
import { log } from "../utils/logger.js";
import { parseTelegramInitData, verifyTelegramInitData } from "../utils/telegram.js";

export const keysRouter = express.Router();

keysRouter.use((req, _res, next) => {
  log("🧩 Keys route", {
    method: req.method,
    url: req.originalUrl,
    origin: req.get("origin") || null,
    hasInitData: Boolean(req.get("x-telegram-initdata")),
    contentType: req.get("content-type") || null,
  });
  next();
});

keysRouter.options("/activate", (req, res) => {
  res.set({
    "Access-Control-Allow-Origin": req.get("origin") || "*",
    "Access-Control-Allow-Headers": req.get("access-control-request-headers") || "Content-Type",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Credentials": "true",
  });
  res.sendStatus(204);
});

function normalizePayload(body, rawBody) {
  if (!body || (typeof body === "object" && !Array.isArray(body) && !Object.keys(body).length)) {
    if (rawBody instanceof Buffer) {
      rawBody = rawBody.toString("utf8");
    }
    if (typeof rawBody === "string" && rawBody.trim()) {
      body = rawBody;
    }
  }

  if (!body) return {};
  if (typeof body === "string") {
    const trimmed = body.trim();
    if (!trimmed) return {};
    try {
      return JSON.parse(trimmed);
    } catch {
      if (trimmed.includes("=")) {
        const params = new URLSearchParams(trimmed);
        return Object.fromEntries(params.entries());
      }
      return { key: trimmed };
    }
  }
  return body;
}

keysRouter.post("/activate", async (req, res) => {
  const payload = normalizePayload(req.body, req.rawBody);
  log("📥 Activation payload", {
    keys: Object.keys(payload || {}),
    hasRawBody: Boolean(req.rawBody && req.rawBody.length),
  });
  const { key, tg_id, name, username, email } = payload;
  if (!key) return res.status(400).json({ ok: false, error: "missing_key" });

  let userId = tg_id;
  if (!userId) {
    const initData = req.get("x-telegram-initdata");
    if (initData && verifyTelegramInitData(initData, process.env.BOT_TOKEN)) {
      const telegram = parseTelegramInitData(initData);
      userId = telegram?.id;
    }
  }

  const normalizedKey = key.trim();
  const hashedKey = hashKey(normalizedKey);

  let client;
  try {
    client = await pool.connect();
  } catch (connectionError) {
    console.error("❌ Key activation connection error", {
      message: connectionError?.message,
      stack: connectionError?.stack,
    });
    log("❌ Key activation connection error", connectionError);
    return res.status(503).json({ ok: false, error: "db_unavailable" });
  }

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
      log("⚠️  Activation failed: invalid key", {
        userId,
        hashedKey,
        providedKeySuffix: normalizedKey.slice(-4),
      });
      await client.query("ROLLBACK");
      transactionStarted = false;
      return res.status(400).json({ ok: false, error: "invalid_key" });
    }

    const keyData = keyResult.rows[0];

    if (!userId) {
      userId = keyData.used_by;
    }

    const numericUserId = Number.parseInt(userId, 10);
    if (!numericUserId) {
      log("⚠️  Activation failed: missing user", { provided: userId, keyId: keyData.id });
      await client.query("ROLLBACK");
      transactionStarted = false;
      return res.status(400).json({ ok: false, error: "missing_user" });
    }

    userId = numericUserId;

    if (keyData.used_by && keyData.used_by !== numericUserId) {
      log("⚠️  Activation failed: key already used", {
        keyId: keyData.id,
        usedBy: keyData.used_by,
        attempt: numericUserId,
      });
      await client.query("ROLLBACK");
      transactionStarted = false;
      return res.status(409).json({ ok: false, error: "key_used" });
    }

    const duration = Number(keyData.duration_days) || 30;
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
          name ?? current.name ?? null,
          username ?? current.username ?? null,
          email ?? current.email ?? null,
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

    const keyUpdate = await client.query(
      `UPDATE keys
          SET used_by = $1,
              used_at = NOW()
        WHERE id = $2`,
      [numericUserId, keyData.id]
    );

    if (!keyUpdate.rowCount) {
      throw new Error(`Failed to update key usage for key ${keyData.id}`);
    }

    await client.query("COMMIT");
    transactionStarted = false;

    log("✅ Key activated", {
      keyId: keyData.id,
      userId: numericUserId,
      duration,
      level,
    });

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
      providedKey: normalizedKey,
      hashedKey,
      tg_id: tg_id || null,
      derivedUserId: userId || null,
      rawBody: req.rawBody || null,
      bodyType: typeof req.body,
      error: err?.message,
      stack: err?.stack,
    });
    log("❌ Key activation error", err);
    res.status(500).json({ ok: false, error: "activation_failed" });
  } finally {
    client?.release();
  }
});
