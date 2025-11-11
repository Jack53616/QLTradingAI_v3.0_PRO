import express from "express";
import { pool } from "../utils/db.js";

export const activityRouter = express.Router();

// 📊 Get user operations/activity
activityRouter.get("/ops/:tg", async (req, res) => {
  try {
    const tgId = Number(req.params.tg);
    if (!tgId) return res.status(400).json({ ok: false, error: "invalid_tg_id" });

    // Get user ID first
    const userResult = await pool.query(
      "SELECT id FROM users WHERE tg_id = $1",
      [tgId]
    );

    if (!userResult.rows.length) {
      return res.json({ ok: true, ops: [] });
    }

    const userId = userResult.rows[0].id;

    // Get operations (trades, deposits, withdrawals)
    const ops = [];

    // Get trades
    const trades = await pool.query(
      `SELECT 
        'trade' as type,
        pair as label,
        profit as amount,
        closed_at as created_at
      FROM trades 
      WHERE user_id = $1 AND closed_at IS NOT NULL
      ORDER BY closed_at DESC
      LIMIT 20`,
      [userId]
    );
    ops.push(...trades.rows);

    // Get withdrawals
    const withdrawals = await pool.query(
      `SELECT 
        'withdrawal' as type,
        method as label,
        amount,
        created_at
      FROM withdraw_requests 
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 20`,
      [userId]
    );
    ops.push(...withdrawals.rows);

    // Sort by date
    ops.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    res.json({ ok: true, ops: ops.slice(0, 20) });
  } catch (err) {
    console.error("Ops error:", err);
    res.json({ ok: true, ops: [] });
  }
});

// 📋 Get user withdrawal requests
activityRouter.get("/requests/:tg", async (req, res) => {
  try {
    const tgId = Number(req.params.tg);
    if (!tgId) return res.status(400).json({ ok: false, error: "invalid_tg_id" });

    // Get user ID first
    const userResult = await pool.query(
      "SELECT id FROM users WHERE tg_id = $1",
      [tgId]
    );

    if (!userResult.rows.length) {
      return res.json({ ok: true, requests: [] });
    }

    const userId = userResult.rows[0].id;

    const result = await pool.query(
      `SELECT 
        id,
        method,
        address,
        amount,
        status,
        created_at
      FROM withdraw_requests 
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 50`,
      [userId]
    );

    res.json({ ok: true, requests: result.rows });
  } catch (err) {
    console.error("Requests error:", err);
    res.json({ ok: true, requests: [] });
  }
});
