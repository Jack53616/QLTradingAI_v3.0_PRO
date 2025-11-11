import express from "express";
import { pool } from "../utils/db.js";
import { log, warn, error } from "../utils/logger.js";
import { isPositiveNumber } from "../utils/helpers.js";

export const withdrawRouter = express.Router();

/**
 * POST /api/withdraw
 * Create a withdrawal request and reserve balance immediately
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

  // Maximum withdrawal amount
  const MAX_WITHDRAWAL = 10000;
  if (withdrawAmount > MAX_WITHDRAWAL) {
    return res.status(400).json({
      ok: false,
      error: "amount_too_high",
      message: `Maximum withdrawal amount is $${MAX_WITHDRAWAL}`
    });
  }

  // Validate address format for crypto methods
  if (method === 'USDT-TRC20' && (!address || address.length !== 34)) {
    return res.status(400).json({
      ok: false,
      error: "invalid_address",
      message: "USDT-TRC20 address must be 34 characters"
    });
  }

  try {
    // Start transaction
    await pool.query('BEGIN');

    // Check user subscription
    const { rows: userRows } = await pool.query(
      "SELECT balance, sub_expires FROM users WHERE id = $1 FOR UPDATE",
      [userId]
    );

    if (!userRows.length) {
      await pool.query('ROLLBACK');
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
      await pool.query('ROLLBACK');
      return res.status(403).json({
        ok: false,
        error: "subscription_expired",
        message: "Active subscription required for withdrawals"
      });
    }

    // Check pending requests limit
    const { rows: pendingRows } = await pool.query(
      "SELECT COUNT(*) as count FROM requests WHERE user_id = $1 AND status = 'pending'",
      [userId]
    );

    const MAX_PENDING = 3;
    if (Number(pendingRows[0].count) >= MAX_PENDING) {
      await pool.query('ROLLBACK');
      return res.status(400).json({
        ok: false,
        error: "too_many_pending",
        message: `You have ${MAX_PENDING} pending requests. Please wait for approval.`
      });
    }

    // Reserve balance immediately - this prevents double withdrawal
    const { rows: updateRows } = await pool.query(
      `UPDATE users 
       SET balance = balance - $1 
       WHERE id = $2 AND balance >= $1
       RETURNING balance`,
      [withdrawAmount, userId]
    );

    if (!updateRows.length) {
      await pool.query('ROLLBACK');
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

    // Commit transaction
    await pool.query('COMMIT');

    log("💰 Withdrawal request created and balance reserved", {
      requestId: rows[0].id,
      userId,
      amount: withdrawAmount,
      method,
      newBalance: updateRows[0].balance
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
      },
      new_balance: Number(updateRows[0].balance)
    });

  } catch (err) {
    await pool.query('ROLLBACK');
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
      `SELECT id, method, address, amount, status, created_at, processed_at
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
