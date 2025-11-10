import express from "express";
import { pool } from "../utils/db.js";
import { ensureAdmin } from "../utils/auth.js";

export const tradesRouter = express.Router();

tradesRouter.get("/", ensureAdmin, async (_req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, user_id, pair, type, amount, profit, opened_at, closed_at FROM trades ORDER BY opened_at DESC LIMIT 200"
    );
    res.json({ ok: true, trades: result.rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

tradesRouter.get("/me", async (req, res) => {
  const userId = req.telegram?.id;
  if (!userId) return res.status(401).json({ ok: false, error: "telegram_only" });

  try {
    const result = await pool.query(
      "SELECT id, pair, type, amount, profit, opened_at, closed_at FROM trades WHERE user_id = $1 ORDER BY opened_at DESC LIMIT 50",
      [userId]
    );
    res.json({ ok: true, trades: result.rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});
