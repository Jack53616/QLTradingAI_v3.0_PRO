import express from "express";
import { pool } from "../utils/db.js";

export const userRouter = express.Router();

function mapUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    telegramId: row.tg_id,
    email: row.email,
    name: row.name,
    balance: Number(row.balance || 0),
    language: row.lang,
    status: row.status,
    role: row.role,
    verified: row.verified,
    subscriptionDays: row.sub_days,
    subscriptionExpires: row.subscription_expires,
    lastLogin: row.last_login,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

userRouter.get("/", async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, tg_id, email, name, balance, lang, status, role, verified,
              sub_days, subscription_expires, last_login, created_at, updated_at
         FROM users WHERE id = $1`,
      [req.user.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: "user_not_found" });
    }

    res.json({ success: true, data: mapUser(result.rows[0]) });
  } catch (error) {
    next(error);
  }
});

userRouter.put("/preferences", async (req, res, next) => {
  try {
    const { language } = req.body || {};
    const allowed = ["en", "ar", "tr", "de"];

    if (language && !allowed.includes(language)) {
      return res.status(400).json({ success: false, message: "unsupported_language" });
    }

    const update = await pool.query(
      `UPDATE users
          SET lang = COALESCE($1, lang),
              updated_at = NOW()
        WHERE id = $2
        RETURNING id, tg_id, email, name, balance, lang, status, role, verified,
                  sub_days, subscription_expires, last_login, created_at, updated_at`,
      [language, req.user.id]
    );

    res.json({ success: true, data: mapUser(update.rows[0]) });
  } catch (error) {
    next(error);
  }
});

userRouter.get("/subscription", async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT sub_days, subscription_expires
         FROM users WHERE id = $1`,
      [req.user.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: "user_not_found" });
    }

    const row = result.rows[0];
    res.json({
      success: true,
      data: {
        subscriptionDays: row.sub_days,
        subscriptionExpires: row.subscription_expires
      }
    });
  } catch (error) {
    next(error);
  }
});

userRouter.get("/balance", async (req, res, next) => {
  try {
    const result = await pool.query("SELECT balance FROM users WHERE id = $1", [req.user.id]);
    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: "user_not_found" });
    }

    res.json({ success: true, data: { balance: Number(result.rows[0].balance || 0) } });
  } catch (error) {
    next(error);
  }
});

export default userRouter;
