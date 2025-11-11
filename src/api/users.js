// 📁 routes/users.js
import express from "express";
import { pool } from "../utils/db.js";
import { ensureAdmin } from "../utils/auth.js";

export const usersRouter = express.Router();

/**
 * 🧩 [GET] /api/users
 * إرجاع جميع المستخدمين (لـ admin فقط)
 */
usersRouter.get("/", ensureAdmin, async (_req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, username, level, balance, sub_expires FROM users ORDER BY id DESC"
    );
    res.json({ ok: true, users: result.rows });
  } catch (err) {
    console.error("❌ Database error (users list):", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * 🧠 [GET] /api/users/me
 * يرجع بيانات المستخدم الحالية (سواء من تيليجرام أو وضع التطوير)
 */
usersRouter.get("/me", async (req, res) => {
  try {
    // 🔹 تحديد معرف المستخدم
    const userId = req.telegram?.id || process.env.DEV_USER_ID || 999999;

    if (!userId) {
      return res.status(401).json({ ok: false, error: "no_user" });
    }

    // 🔹 البحث عن المستخدم في قاعدة البيانات
    const { rows } = await pool.query(
      "SELECT id, name, username, level, balance, sub_expires FROM users WHERE id = $1",
      [userId]
    );

    // 🔹 إذا المستخدم غير موجود
    if (!rows.length) {
      // 🧩 في وضع التطوير، ننشئ مستخدم تجريبي تلقائياً
      if (process.env.NODE_ENV !== "production") {
        console.warn("⚠️ Dev user not found — creating fallback user...");
        const insert = await pool.query(
          `INSERT INTO users (id, name, username, level, balance, sub_expires)
           VALUES ($1, $2, $3, $4, $5, NOW() + interval '30 days')
           RETURNING id, name, username, level, balance, sub_expires`,
          [userId, "DevUser", "dev_user", "Bronze", 0]
        );
        return res.json({ ok: true, user: insert.rows[0], dev: true });
      }

      // 🛑 في الإنتاج: يرجع خطأ بدون إنشاء حساب
      return res.json({ ok: false, error: "not_found" });
    }

    // ✅ المستخدم موجود
    res.json({ ok: true, user: rows[0] });
  } catch (err) {
    console.error("❌ Error in /api/users/me:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});
