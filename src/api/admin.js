import express from "express";
import { verifyAdminJWT, signAdmin } from "../utils/jwt.js";
import { pool } from "../utils/db.js";
import { log } from "../utils/logger.js";

export const adminRouter = express.Router();

// ✅ تسجيل دخول الأدمن
adminRouter.post("/login", (req, res) => {
  const { token } = req.body;
  if (token !== process.env.ADMIN_TOKEN)
    return res.status(401).json({ ok: false, error: "invalid_admin_token" });
  const jwt = signAdmin("root");
  res.json({ ok: true, jwt });
});

// ✅ جلب جميع المستخدمين
adminRouter.get("/users", verifyAdminJWT, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM users ORDER BY id DESC");
    res.json({ ok: true, users: result.rows });
  } catch (err) {
    log("❌ Error loading users: " + err.message);
    res.json({ ok: false });
  }
});

// ✅ عرض تفاصيل مستخدم محدد
adminRouter.get("/user/:id", verifyAdminJWT, async (req, res) => {
  try {
    const id = req.params.id;
    const result = await pool.query(
      `SELECT id, name, level, balance, sub_expires,
       (SELECT COUNT(*) FROM trades WHERE user_id = $1) AS trades_count
       FROM users WHERE id = $1`,
      [id]
    );
    if (!result.rows.length)
      return res.json({ ok: false, error: "user_not_found" });
    res.json({ ok: true, user: result.rows[0] });
  } catch (err) {
    log("❌ Error fetching user details: " + err.message);
    res.json({ ok: false });
  }
});

// ✅ تمديد الاشتراك
adminRouter.post("/extend/:id", verifyAdminJWT, async (req, res) => {
  try {
    const id = req.params.id;
    const { days } = req.body;
    await pool.query(
      `UPDATE users
       SET sub_expires = COALESCE(sub_expires, NOW()) + ($1 || ' days')::interval
       WHERE id = $2`,
      [days, id]
    );
    log(`🕒 Extended subscription for user ${id} by ${days} days`);
    res.json({ ok: true });
  } catch (err) {
    log("❌ Error extending subscription: " + err.message);
    res.json({ ok: false });
  }
});

// ✅ حذف المستخدم
adminRouter.delete("/delete/:id", verifyAdminJWT, async (req, res) => {
  try {
    const id = req.params.id;
    await pool.query("DELETE FROM users WHERE id = $1", [id]);
    log(`🗑️ Deleted user ${id}`);
    res.json({ ok: true });
  } catch (err) {
    log("❌ Error deleting user: " + err.message);
    res.json({ ok: false });
  }
});
