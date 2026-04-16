import express from "express";
import { pool } from "../utils/db.js";
import { log, warn, error } from "../utils/logger.js";
import { isPositiveNumber } from "../utils/helpers.js";

export const withdrawRouter = express.Router();
export const transferRouter = express.Router();

withdrawRouter.post("/", async (req, res) => {
  const userId = req.telegram?.id;
  const { method, address, amount } = req.body || {};

  if (!userId) {
    return res.status(401).json({ ok: false, error: "unauthorized", message: "User authentication required" });
  }

  if (!method || !amount) {
    return res.status(400).json({ ok: false, error: "missing_data", message: "Method and amount are required" });
  }

  if (!isPositiveNumber(amount)) {
    return res.status(400).json({ ok: false, error: "invalid_amount", message: "Amount must be a positive number" });
  }

  const withdrawAmount = Number(amount);
  const FEE_RATE = Number(process.env.WITHDRAWAL_FEE_PERCENT || 5);
  const feeAmount = Number((withdrawAmount * FEE_RATE / 100).toFixed(2));
  const netAmount = Number((withdrawAmount - feeAmount).toFixed(2));

  const MIN_WITHDRAWAL = 10;
  if (withdrawAmount < MIN_WITHDRAWAL) {
    return res.status(400).json({ ok: false, error: "amount_too_low", message: `Minimum withdrawal amount is $${MIN_WITHDRAWAL}` });
  }

  const MAX_WITHDRAWAL = 10000;
  if (withdrawAmount > MAX_WITHDRAWAL) {
    return res.status(400).json({ ok: false, error: "amount_too_high", message: `Maximum withdrawal amount is $${MAX_WITHDRAWAL}` });
  }

  if (method === 'USDT-TRC20' && (!address || address.length !== 34)) {
    return res.status(400).json({ ok: false, error: "invalid_address", message: "USDT-TRC20 address must be 34 characters" });
  }

  try {
    await pool.query('BEGIN');

    const { rows: userRows } = await pool.query(
      "SELECT id, balance, sub_expires, is_banned, ban_expires FROM users WHERE id = $1 FOR UPDATE",
      [userId]
    );

    if (!userRows.length) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ ok: false, error: "user_not_found", message: "User account not found" });
    }

    const user = userRows[0];
    const currentBalance = Number(user.balance || 0);

    if (user.is_banned) {
      if (!user.ban_expires || new Date(user.ban_expires) > new Date()) {
        await pool.query('ROLLBACK');
        return res.status(403).json({ ok: false, error: "account_banned", message: "Account is banned" });
      }
    }

    if (!user.sub_expires || new Date(user.sub_expires) < new Date()) {
      await pool.query('ROLLBACK');
      return res.status(403).json({ ok: false, error: "subscription_expired", message: "Active subscription required for withdrawals" });
    }

    const { rows: pendingRows } = await pool.query(
      "SELECT COUNT(*) as count FROM requests WHERE user_id = $1 AND status = 'pending'",
      [userId]
    );

    const MAX_PENDING = 3;
    if (Number(pendingRows[0].count) >= MAX_PENDING) {
      await pool.query('ROLLBACK');
      return res.status(400).json({ ok: false, error: "too_many_pending", message: `You have ${MAX_PENDING} pending requests. Please wait for approval.` });
    }

    const { rows: updateRows } = await pool.query(
      `UPDATE users SET balance = balance - $1 WHERE id = $2 AND balance >= $1 RETURNING balance`,
      [withdrawAmount, userId]
    );

    if (!updateRows.length) {
      await pool.query('ROLLBACK');
      return res.status(400).json({ ok: false, error: "insufficient_balance", message: `Insufficient balance. Available: $${currentBalance.toFixed(2)}`, balance: currentBalance });
    }

    const { rows } = await pool.query(
      `INSERT INTO requests (user_id, method, address, amount, fee_rate, fee_amount, net_amount, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', NOW())
       RETURNING id, created_at`,
      [userId, method, address || null, withdrawAmount, FEE_RATE, feeAmount, netAmount]
    );

    await pool.query('COMMIT');

    log("Withdrawal request created", {
      requestId: rows[0].id, userId, amount: withdrawAmount,
      feeRate: FEE_RATE, feeAmount, netAmount, method,
      newBalance: updateRows[0].balance
    });

    res.json({
      ok: true,
      message: "withdraw_requested",
      request: {
        id: rows[0].id,
        amount: withdrawAmount,
        fee_rate: FEE_RATE,
        fee_amount: feeAmount,
        net_amount: netAmount,
        method,
        status: "pending",
        created_at: rows[0].created_at
      },
      new_balance: Number(updateRows[0].balance)
    });

  } catch (err) {
    await pool.query('ROLLBACK');
    error("Withdrawal request error:", err);
    res.status(500).json({ ok: false, error: "withdrawal_failed", message: "Could not process withdrawal request" });
  }
});

withdrawRouter.get("/history", async (req, res) => {
  const userId = req.telegram?.id;

  if (!userId) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }

  try {
    const { rows } = await pool.query(
      `SELECT id, method, amount, fee_rate, fee_amount, net_amount, status, admin_note, created_at, updated_at
       FROM requests
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [userId]
    );

    res.json({ ok: true, requests: rows });
  } catch (err) {
    error("Error fetching withdrawal history:", err);
    res.status(500).json({ ok: false, error: "fetch_failed" });
  }
});

transferRouter.post("/", async (req, res) => {
  const userId = req.telegram?.id;
  const { receiver_id, amount } = req.body || {};

  if (!userId) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }

  if (!receiver_id || !amount || !isPositiveNumber(amount)) {
    return res.status(400).json({ ok: false, error: "missing_data", message: "Receiver and valid amount required" });
  }

  const transferAmount = Number(amount);
  if (transferAmount < 1) {
    return res.status(400).json({ ok: false, error: "amount_too_low", message: "Minimum transfer is $1" });
  }

  try {
    await pool.query("BEGIN");

    const senderResult = await pool.query(
      "SELECT id, balance, is_banned, ban_expires FROM users WHERE id = $1 FOR UPDATE",
      [userId]
    );
    if (!senderResult.rows.length) {
      await pool.query("ROLLBACK");
      return res.status(404).json({ ok: false, error: "user_not_found" });
    }

    const sender = senderResult.rows[0];

    if (sender.is_banned) {
      if (!sender.ban_expires || new Date(sender.ban_expires) > new Date()) {
        await pool.query("ROLLBACK");
        return res.status(403).json({ ok: false, error: "account_banned" });
      }
    }

    if (Number(sender.balance) < transferAmount) {
      await pool.query("ROLLBACK");
      return res.status(400).json({ ok: false, error: "insufficient_balance" });
    }

    let receiverQuery;
    const isEmail = String(receiver_id).includes("@");
    if (isEmail) {
      receiverQuery = await pool.query("SELECT id FROM users WHERE email = $1", [receiver_id]);
    } else {
      receiverQuery = await pool.query("SELECT id FROM users WHERE id = $1 OR tg_id = $2", [
        isNaN(Number(receiver_id)) ? 0 : Number(receiver_id),
        isNaN(Number(receiver_id)) ? 0 : Number(receiver_id)
      ]);
    }

    if (!receiverQuery.rows.length) {
      await pool.query("ROLLBACK");
      return res.status(404).json({ ok: false, error: "receiver_not_found", message: "Receiver not found" });
    }

    const receiverDbId = receiverQuery.rows[0].id;

    if (receiverDbId === sender.id) {
      await pool.query("ROLLBACK");
      return res.status(400).json({ ok: false, error: "self_transfer", message: "Cannot transfer to yourself" });
    }

    await pool.query(
      "UPDATE users SET balance = balance - $1, updated_at = NOW() WHERE id = $2",
      [transferAmount, sender.id]
    );

    const insertResult = await pool.query(
      `INSERT INTO transfers (sender_id, receiver_id, amount, status, created_at)
       VALUES ($1, $2, $3, 'pending', NOW()) RETURNING id, created_at`,
      [sender.id, receiverDbId, transferAmount]
    );

    await pool.query("COMMIT");

    log("Transfer request created", {
      transferId: insertResult.rows[0].id,
      senderId: sender.id,
      receiverId: receiverDbId,
      amount: transferAmount,
    });

    res.json({
      ok: true,
      message: "transfer_requested",
      transfer: {
        id: insertResult.rows[0].id,
        amount: transferAmount,
        receiver_id: receiverDbId,
        status: "pending",
        created_at: insertResult.rows[0].created_at,
      },
    });
  } catch (err) {
    await pool.query("ROLLBACK");
    error("Transfer error:", err);
    res.status(500).json({ ok: false, error: "transfer_failed" });
  }
});

transferRouter.get("/", async (req, res) => {
  const userId = req.telegram?.id;

  if (!userId) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }

  try {
    const { rows } = await pool.query(
      `SELECT t.id, t.sender_id, t.receiver_id, t.amount, t.status, t.reason,
              t.created_at, t.processed_at,
              su.name AS sender_name, su.email AS sender_email,
              ru.name AS receiver_name, ru.email AS receiver_email
         FROM transfers t
         LEFT JOIN users su ON su.id = t.sender_id
         LEFT JOIN users ru ON ru.id = t.receiver_id
        WHERE t.sender_id = $1 OR t.receiver_id = $1
        ORDER BY t.created_at DESC
        LIMIT 50`,
      [userId]
    );

    res.json({ ok: true, transfers: rows });
  } catch (err) {
    error("Error fetching transfers:", err);
    res.status(500).json({ ok: false, error: "fetch_failed" });
  }
});
