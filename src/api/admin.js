import express from "express";
import { verifyAdminJWT, signAdmin } from "../utils/jwt.js";
import { pool } from "../utils/db.js";
import { log } from "../utils/logger.js";
import { strictRateLimiter } from "../middleware/rateLimiter.js";

export const adminRouter = express.Router();

// Apply strict rate limiting to login endpoint
adminRouter.post("/login", strictRateLimiter(), (req, res) => {
  const { token } = req.body || {};
  if (!token || token !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ ok: false, error: "invalid_admin_token" });
  }
  const jwt = signAdmin("root");
  res.json({ ok: true, jwt });
});

adminRouter.use(verifyAdminJWT);

adminRouter.get("/users", async (_req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, username, level, balance, sub_expires FROM users ORDER BY id DESC"
    );
    res.json({ ok: true, users: result.rows });
  } catch (err) {
    log("❌ Error loading users:", err);
    res.json({ ok: false, error: "load_failed" });
  }
});

adminRouter.get("/user/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const result = await pool.query(
      `SELECT id, name, username, level, balance, sub_expires,
              (SELECT COUNT(*) FROM trades WHERE user_id = $1) AS trades_count
         FROM users WHERE id = $1`,
      [id]
    );
    if (!result.rows.length) {
      return res.json({ ok: false, error: "user_not_found" });
    }
    res.json({ ok: true, user: result.rows[0] });
  } catch (err) {
    log("❌ Error fetching user details:", err);
    res.json({ ok: false, error: "load_failed" });
  }
});

adminRouter.post("/extend/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const days = Number(req.body?.days || 0);
    if (!days || Number.isNaN(days)) {
      return res.status(400).json({ ok: false, error: "invalid_days" });
    }

    await pool.query(
      `UPDATE users
         SET sub_expires = COALESCE(sub_expires, NOW()) + ($1 || ' days')::interval
       WHERE id = $2`,
      [days.toString(), id]
    );
    log(`🕒 Extended subscription for user ${id} by ${days} days`);
    res.json({ ok: true });
  } catch (err) {
    log("❌ Error extending subscription:", err);
    res.json({ ok: false, error: "extend_failed" });
  }
});

adminRouter.delete("/delete/:id", async (req, res) => {
  try {
    const id = req.params.id;
    await pool.query("DELETE FROM users WHERE id = $1", [id]);
    log(`🗑️ Deleted user ${id}`);
    res.json({ ok: true });
  } catch (err) {
    log("❌ Error deleting user:", err);
    res.json({ ok: false, error: "delete_failed" });
  }
});

adminRouter.get("/requests", async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT r.id, r.user_id, r.method, r.address, r.amount, r.status, r.created_at, u.name
         FROM requests r
         LEFT JOIN users u ON u.id = r.user_id
         ORDER BY r.created_at DESC LIMIT 100`
    );
    res.json({ ok: true, requests: rows });
  } catch (err) {
    log("❌ Error loading requests:", err);
    res.json({ ok: false, error: "requests_failed" });
  }
});
