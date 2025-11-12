import express from "express";
import { pool } from "../utils/db.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import { signToken } from "../middleware/authenticate.js";

export const authRouter = express.Router();

function normalizeUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    telegramId: row.tg_id,
    email: row.email,
    name: row.name,
    balance: Number(row.balance || 0),
    subscriptionExpires: row.subscription_expires,
    subscriptionDays: row.sub_days,
    language: row.lang,
    verified: row.verified,
    status: row.status,
    role: row.role,
    lastLogin: row.last_login,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

authRouter.post("/register", async (req, res, next) => {
  try {
    const { email, password, name, telegramId, language } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "missing_credentials" });
    }

    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
    if (existing.rows.length) {
      return res.status(409).json({ success: false, message: "email_exists" });
    }

    let passwordHash;
    try {
      passwordHash = await hashPassword(password);
    } catch (error) {
      if (error.message === "password_too_short") {
        return res.status(400).json({ success: false, message: "password_too_short" });
      }
      throw error;
    }

    const insert = await pool.query(
      `INSERT INTO users (tg_id, email, password_hash, name, lang, role, status)
       VALUES ($1, $2, $3, $4, COALESCE($5, 'en'), 'user', 'active')
       RETURNING *`,
      [telegramId || null, email, passwordHash, name || null, language]
    );

    const user = normalizeUser(insert.rows[0]);
    const token = signToken({ id: user.id, role: user.role, email: user.email });

    res.status(201).json({ success: true, data: { token, user } });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "missing_credentials" });
    }

    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (!result.rows.length) {
      return res.status(401).json({ success: false, message: "invalid_credentials" });
    }

    const row = result.rows[0];
    let passwordOk = false;
    try {
      passwordOk = await verifyPassword(password, row.password_hash);
    } catch (error) {
      if (error.message === "bcrypt_module_missing") {
        return res.status(500).json({ success: false, message: "bcrypt_dependency_missing" });
      }
      throw error;
    }

    if (!passwordOk) {
      return res.status(401).json({ success: false, message: "invalid_credentials" });
    }

    await pool.query("UPDATE users SET last_login = NOW() WHERE id = $1", [row.id]);

    const user = normalizeUser(row);
    const token = signToken({ id: user.id, role: user.role, email: user.email });

    res.json({ success: true, data: { token, user } });
  } catch (error) {
    next(error);
  }
});

export default authRouter;
