import express from "express";
import { pool } from "../utils/db.js";
import crypto from "crypto";

export const keysRouter = express.Router();

keysRouter.post("/activate", async (req, res) => {
  const { key, tg_id, name, email } = req.body || {};
  if (!key || !tg_id) return res.status(400).json({ ok: false, error: "missing_data" });

  const hashedKey = crypto.createHash("sha256").update(key).digest("hex");

  try {
    const keyRes = await pool.query("SELECT * FROM keys WHERE key_code = $1", [hashedKey]);
    if (keyRes.rowCount === 0) return res.status(400).json({ ok: false, error: "invalid_key" });
    const keyData = keyRes.rows[0];
    if (keyData.used_by) return res.status(400).json({ ok: false, error: "key_used" });

    const expires = new Date();
    expires.setDate(expires.getDate() + 30);

    await pool.query(
      "INSERT INTO users (id, name, email, level, sub_expires) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO UPDATE SET sub_expires=$5, level=$4",
      [tg_id, name, email, "Bronze", expires]
    );

    await pool.query("UPDATE keys SET used_by=$1, used_at=NOW() WHERE key_code=$2", [tg_id, hashedKey]);
    res.json({ ok: true, message: "activated" });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});
