import express from "express";
import { pool } from "../utils/db.js";
import { log, warn, error } from "../utils/logger.js";
import { isPositiveNumber } from "../utils/helpers.js";

export const withdrawRouter = express.Router();

/**
 * POST /api/withdraw
 * Create a withdrawal request
 */
withdrawRouter.post("/", async (req, res) => {
  const userId = req.telegram?.id;
  const { method, address, amount } = req.body || {};

  // Validate input
  if (!userId) {
    return res.status(401).json({ 
      ok: false, 
      error: "unauthorized",
      message: "User authentication required"
    });
  }

  if (!method || !amount) {
    return res.status(400).json({ 
      ok: false, 
      error: "missing_data",
      message: "Method and amount are required"
    });
  }

  if (!isPositiveNumber(amount)) {
    return res.status(400).json({
      ok: false,
      error: "invalid_amount",
      message: "Amount must be a positive number"
    });
  }

  const withdrawAmount = Number(amount);

  // Minimum withdrawal amount
  const MIN_WITHDRAWAL = 10;
  if (withdrawAmount < MIN_WITHDRAWAL) {
    return res.status(400).json({
      ok: false,
      error: "amount_too_low",
      message: `Minimum withdrawal amount is $${MIN_WITHDRAWAL}`
    });
  }

  try {
    // Check user balance
    const { rows: userRows } = await pool.query(
      "SELECT balance, sub_expires FROM users WHERE id = $1",
      [userId]
    );

    if (!userRows.length) {
      return res.status(404).json({
        ok: false,
        error: "user_not_found",
        message: "User account not found"
      });
    }

    const user = userRows[0];
    const currentBalance = Number(user.balance || 0);

    // Check if user has active subscription
    if (!user.sub_expires || new Date(user.sub_expires) < new Date()) {
      return res.status(403).json({
        ok: false,
        error: "subscription_expired",
        message: "Active subscription required for withdrawals"
      });
    }

    // Check if balance is sufficient
    if (currentBalance < withdrawAmount) {
      warn("⚠️ Insufficient balance for withdrawal", {
        userId,
        balance: currentBalance,
        requested: withdrawAmount
      });

      return res.status(400).json({
        ok: false,
        error: "insufficient_balance",
        message: `Insufficient balance. Available: $${currentBalance.toFixed(2)}`,
        balance: currentBalance
      });
    }

    // Create withdrawal request
    const { rows } = await pool.query(
      `INSERT INTO requests (user_id, method, address, amount, status, created_at)
       VALUES ($1, $2, $3, $4, 'pending', NOW())
       RETURNING id, created_at`,
      [userId, method, address || null, withdrawAmount]
    );

    log("💰 Withdrawal request created", {
      requestId: rows[0].id,
      userId,
      amount: withdrawAmount,
      method
    });

    res.json({ 
      ok: true, 
      message: "withdraw_requested",
      request: {
        id: rows[0].id,
        amount: withdrawAmount,
        method,
        status: "pending",
        created_at: rows[0].created_at
      }
    });

  } catch (err) {
    error("❌ Withdrawal request error:", err);
    res.status(500).json({ 
      ok: false, 
      error: "withdrawal_failed",
      message: "Could not process withdrawal request"
    });
  }
});

/**
 * GET /api/withdraw/history
 * Get user's withdrawal history
 */
withdrawRouter.get("/history", async (req, res) => {
  const userId = req.telegram?.id;

  if (!userId) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }

  try {
    const { rows } = await pool.query(
      `SELECT id, method, address, amount, status, created_at
       FROM requests
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [userId]
    );

    res.json({ ok: true, requests: rows });
  } catch (err) {
    error("❌ Error fetching withdrawal history:", err);
    res.status(500).json({ ok: false, error: "fetch_failed" });
  }
});
