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

  let client;
  try {
    const { rows, rowCount } = await pool.query(
      "SELECT id, key_code, used_by, duration_days, level FROM keys WHERE key_code = $1",
      [hashedKey]
    );
    if (!rowCount) return res.status(400).json({ ok: false, error: "invalid_key" });

    const keyData = rows[0];
    if (!userId) userId = keyData.used_by;
    if (!userId) return res.status(400).json({ ok: false, error: "missing_user" });

    if (keyData.used_by && keyData.used_by !== Number(userId)) {
      return res.status(409).json({ ok: false, error: "key_used" });
    }

    const duration = keyData.duration_days || 30;
    const level = keyData.level || "Bronze";

    const { rows: userRows } = await pool.query(
      `INSERT INTO users (id, name, username, email, level, balance, sub_expires)
       VALUES ($1, $2, $3, $4, $5, COALESCE((SELECT balance FROM users WHERE id = $1), 0), NOW() + ($6 || ' days')::interval)
       ON CONFLICT (id) DO UPDATE SET
         name = COALESCE(EXCLUDED.name, users.name),
         username = COALESCE(EXCLUDED.username, users.username),
         email = COALESCE(EXCLUDED.email, users.email),
         level = EXCLUDED.level,
         sub_expires = COALESCE(users.sub_expires, NOW()) + ($6 || ' days')::interval
       RETURNING id, name, username, level, balance, sub_expires`,
      [userId, name || null, username || null, email || null, level, duration.toString()]
    );

    await pool.query(
      "UPDATE keys SET used_by = $1, used_at = NOW() WHERE id = $2",
      [userId, keyData.id]
    );

    res.json({ ok: true, user: userRows[0], duration });
  } catch (err) {
    log("❌ Key activation error", err);
    res.status(500).json({ ok: false, error: "activation_failed" });
  }
});
