import express from "express";
import { pool } from "../utils/db.js";
import { verifyPassword } from "../utils/password.js";
import { signToken, authenticate, requireAdmin } from "../middleware/authenticate.js";
import { notificationService } from "../services/notifications.js";
import { marketsService } from "../services/markets.js";

const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_PANEL_PASSWORD || "jack53616";

export const adminRouter = express.Router();

adminRouter.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body || {};

    if (!password) {
      return res.status(400).json({ success: false, message: "missing_credentials" });
    }

    // Support database-backed admins while also allowing the default panel password fallback.
    if (email) {
      const result = await pool.query("SELECT * FROM users WHERE email = $1 AND role = 'admin'", [email]);
      if (!result.rows.length) {
        return res.status(401).json({ success: false, message: "invalid_credentials" });
      }

      const admin = result.rows[0];
      let passwordOk = false;
      try {
        passwordOk = await verifyPassword(password, admin.password_hash);
      } catch (error) {
        if (error.message === "bcrypt_module_missing") {
          return res.status(500).json({ success: false, message: "bcrypt_dependency_missing" });
        }
        throw error;
      }

      if (!passwordOk) {
        return res.status(401).json({ success: false, message: "invalid_credentials" });
      }

      const token = signToken({ id: admin.id, role: admin.role, email: admin.email }, { expiresIn: "8h" });
      return res.json({ success: true, data: { token, admin: { id: admin.id, email: admin.email, name: admin.name } } });
    }

    if (password !== DEFAULT_ADMIN_PASSWORD) {
      return res.status(401).json({ success: false, message: "invalid_credentials" });
    }

    const token = signToken(
      { id: 0, role: "admin", email: "admin@qlwallet.local", name: "QL Admin" },
      { expiresIn: "8h" }
    );

    res.json({
      success: true,
      data: {
        token,
        admin: { id: 0, email: "admin@qlwallet.local", name: "QL Admin" }
      }
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.use(authenticate, requireAdmin);

adminRouter.get("/users", async (_req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, tg_id, email, name, balance, lang, is_banned, ban_expires,
              sub_expires, last_activity_at, role, rank, tg_username,
              total_deposited, total_withdrawn, level
         FROM users
        ORDER BY created_at DESC`
    );
    res.json({ success: true, data: { users: result.rows } });
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/users/:id/balance", async (req, res, next) => {
  try {
    const userId = Number(req.params.id);
    const { amount, reason } = req.body || {};

    if (amount === undefined || Number.isNaN(Number(amount)) || Number(amount) === 0) {
      return res.status(400).json({ success: false, message: "invalid_amount" });
    }

    const numericAmount = Number(amount);

    const result = await pool.query(
      `UPDATE users
          SET balance = balance + $1,
              updated_at = NOW()
        WHERE id = $2
        RETURNING id, balance`,
      [numericAmount, userId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: "user_not_found" });
    }

    await pool.query(
      `INSERT INTO admin_logs (admin_id, target_user_id, action, details)
       VALUES ($1, $2, $3, $4)`,
      [req.user.id, userId, "balance_adjust", { amount: numericAmount, reason }]
    ).catch(() => {});

    res.json({ success: true, data: { userId, balance: Number(result.rows[0].balance) } });
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/users/:id/subscription", async (req, res, next) => {
  try {
    const userId = Number(req.params.id);
    const days = Number(req.body?.days ?? 0);

    if (!userId || Number.isNaN(userId)) {
      return res.status(400).json({ success: false, message: "invalid_user" });
    }

    if (!days || Number.isNaN(days) || days <= 0) {
      return res.status(400).json({ success: false, message: "invalid_days" });
    }

    const result = await pool.query(
      `UPDATE users
          SET sub_expires = COALESCE(sub_expires, NOW()) + ($1 || ' days')::interval,
              updated_at = NOW()
        WHERE id = $2
        RETURNING id, sub_expires`,
      [days, userId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: "user_not_found" });
    }

    await pool
      .query(
        `INSERT INTO admin_logs (admin_id, target_user_id, action, details)
         VALUES ($1, $2, $3, $4)`,
        [req.user.id, userId, "subscription_extend", { days }]
      )
      .catch(() => {});

    res.json({
      success: true,
      data: {
        userId,
        subExpires: result.rows[0].sub_expires
      }
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/trades", async (_req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT t.id, t.user_id, u.name AS user_name, t.symbol, t.side, t.amount, t.entry_price,
              t.tp, t.sl, t.status, t.result, t.profit, t.closed_price, t.opened_at, t.closed_at
         FROM trades t
         LEFT JOIN users u ON u.id = t.user_id
        ORDER BY t.opened_at DESC
        LIMIT 200`
    );

    res.json({ success: true, data: { trades: result.rows } });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/withdrawals", async (_req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT r.id, r.user_id, u.name AS user_name, u.email AS user_email,
              r.amount, r.fee_rate, r.fee_amount, r.net_amount, r.method,
              r.status, r.admin_note, r.created_at, r.updated_at
         FROM requests r
         LEFT JOIN users u ON u.id = r.user_id
        ORDER BY r.created_at DESC
        LIMIT 200`
    );

    res.json({ success: true, data: { withdrawals: result.rows } });
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/withdrawals/:id/decision", async (req, res, next) => {
  try {
    const withdrawalId = Number(req.params.id);
    const { status, reason } = req.body || {};

    if (!withdrawalId || Number.isNaN(withdrawalId)) {
      return res.status(400).json({ success: false, message: "invalid_withdrawal" });
    }

    if (!status || !["approved", "rejected"].includes(status)) {
      return res.status(400).json({ success: false, message: "invalid_status" });
    }

    if (status === "rejected" && !reason) {
      return res.status(400).json({ success: false, message: "reason_required" });
    }

    const existing = await pool.query("SELECT id, user_id, amount FROM requests WHERE id = $1", [withdrawalId]);
    if (!existing.rows.length) {
      return res.status(404).json({ success: false, message: "withdrawal_not_found" });
    }

    if (status === "rejected") {
      await pool.query(
        `UPDATE users SET balance = balance + $1, updated_at = NOW() WHERE id = $2`,
        [existing.rows[0].amount, existing.rows[0].user_id]
      );
    }

    await pool.query(
      `UPDATE requests
          SET status = $1,
              admin_note = CASE WHEN $1 = 'rejected' THEN $2 ELSE admin_note END,
              updated_at = NOW()
        WHERE id = $3`,
      [status, reason || null, withdrawalId]
    );

    await pool
      .query(
        `INSERT INTO admin_logs (admin_id, target_user_id, action, details)
         VALUES ($1, (SELECT user_id FROM requests WHERE id = $2), $3, $4)`,
        [req.user.id, withdrawalId, `withdrawal_${status}`, { reason }]
      )
      .catch(() => {});

    res.json({ success: true, data: { id: withdrawalId, status, reason: reason || null } });
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/trades/simulate", async (req, res, next) => {
  try {
    const { userId, symbol, side, amount, takeProfit, stopLoss } = req.body || {};

    if (!userId || !symbol || !side || !amount) {
      return res.status(400).json({ success: false, message: "missing_trade_data" });
    }

    const entryPrice = req.body.entryPrice ?? marketsService.priceForSymbol(symbol) ?? null;
    const price = entryPrice != null ? Number(entryPrice) : null;

    if (!price || Number.isNaN(price)) {
      return res.status(400).json({ success: false, message: "price_unavailable" });
    }

    const insert = await pool.query(
      `INSERT INTO trades (user_id, symbol, side, amount, entry_price, tp, sl, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'open')
       RETURNING *`,
      [userId, symbol, side.toLowerCase(), amount, price || 0, takeProfit, stopLoss]
    );

    res.status(201).json({ success: true, data: insert.rows[0] });
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/notifications", (req, res) => {
  const { message, name } = req.body || {};
  notificationService.add({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: name || "Admin",
    type: "admin",
    message: message || "",
    createdAt: new Date().toISOString(),
    fake: false
  });

  res.status(201).json({ success: true, message: "notification_sent" });
});

adminRouter.post("/notifications/broadcast", (req, res) => {
  const { message } = req.body || {};
  if (!message) {
    return res.status(400).json({ success: false, message: "message_required" });
  }

  notificationService.add({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: "Admin Broadcast",
    type: "broadcast",
    message,
    createdAt: new Date().toISOString(),
    fake: false
  });

  res.status(201).json({ success: true, message: "broadcast_sent" });
});

adminRouter.get("/transfers", async (_req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT t.id, t.sender_id, t.receiver_id, t.amount, t.status, t.reason,
              t.created_at, t.processed_at,
              su.name AS sender_name, su.email AS sender_email,
              ru.name AS receiver_name, ru.email AS receiver_email
         FROM transfers t
         LEFT JOIN users su ON su.id = t.sender_id
         LEFT JOIN users ru ON ru.id = t.receiver_id
        ORDER BY t.created_at DESC
        LIMIT 200`
    );

    res.json({ success: true, data: { transfers: result.rows } });
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/transfers/:id/decision", async (req, res, next) => {
  try {
    const transferId = Number(req.params.id);
    const { status, reason } = req.body || {};

    if (!transferId || Number.isNaN(transferId)) {
      return res.status(400).json({ success: false, message: "invalid_transfer" });
    }

    if (!status || !["approved", "rejected"].includes(status)) {
      return res.status(400).json({ success: false, message: "invalid_status" });
    }

    const existing = await pool.query(
      "SELECT * FROM transfers WHERE id = $1 AND status = 'pending'",
      [transferId]
    );
    if (!existing.rows.length) {
      return res.status(404).json({ success: false, message: "transfer_not_found_or_processed" });
    }

    const transfer = existing.rows[0];

    if (status === "approved") {
      await pool.query("BEGIN");
      try {
        await pool.query(
          `UPDATE users SET balance = balance + $1, updated_at = NOW() WHERE id = $2`,
          [transfer.amount, transfer.receiver_id]
        );
        await pool.query(
          `UPDATE transfers SET status = 'approved', processed_at = NOW() WHERE id = $1`,
          [transferId]
        );
        await pool.query("COMMIT");
      } catch (err) {
        await pool.query("ROLLBACK");
        throw err;
      }
    } else {
      await pool.query(
        `UPDATE transfers SET status = 'rejected', reason = $1, processed_at = NOW() WHERE id = $2`,
        [reason || "Admin rejected", transferId]
      );
      await pool.query(
        `UPDATE users SET balance = balance + $1, updated_at = NOW() WHERE id = $2`,
        [transfer.amount, transfer.sender_id]
      );
    }

    await pool
      .query(
        `INSERT INTO admin_logs (admin_id, target_user_id, action, details)
         VALUES ($1, $2, $3, $4)`,
        [req.user.id, transfer.sender_id, `transfer_${status}`, { transferId, reason, amount: Number(transfer.amount) }]
      )
      .catch(() => {});

    res.json({ success: true, data: { id: transferId, status, reason: reason || null } });
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/users/:id/ban", async (req, res, next) => {
  try {
    const userId = Number(req.params.id);
    const { duration } = req.body || {};

    if (!userId || Number.isNaN(userId)) {
      return res.status(400).json({ success: false, message: "invalid_user" });
    }

    let banExpires = null;
    let durationLabel = "permanent";

    if (duration) {
      const match = duration.match(/^(\d+)([hdwm])$/i);
      if (match) {
        const value = Number(match[1]);
        const unit = match[2].toLowerCase();
        const now = new Date();
        switch (unit) {
          case "h": banExpires = new Date(now.getTime() + value * 3600000); durationLabel = `${value}h`; break;
          case "d": banExpires = new Date(now.getTime() + value * 86400000); durationLabel = `${value}d`; break;
          case "w": banExpires = new Date(now.getTime() + value * 604800000); durationLabel = `${value}w`; break;
          case "m": banExpires = new Date(now.getTime() + value * 2592000000); durationLabel = `${value}m`; break;
        }
      }
    }

    const result = await pool.query(
      `UPDATE users SET is_banned = true, ban_expires = $1, ban_reason = $2, banned_at = NOW(), updated_at = NOW()
       WHERE id = $3 RETURNING id, is_banned, ban_expires`,
      [banExpires, `Banned (${durationLabel})`, userId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: "user_not_found" });
    }

    await pool.query(
      `INSERT INTO admin_logs (admin_id, target_user_id, action, details) VALUES ($1, $2, $3, $4)`,
      [req.user.id, userId, "user_banned", { duration: durationLabel, banExpires }]
    ).catch(() => {});

    res.json({ success: true, data: { userId, is_banned: true, banExpires, duration: durationLabel } });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/analytics", async (_req, res, next) => {
  try {
    const [{ rows: userRows }, { rows: tradeRows }, { rows: withdrawalRows }, { rows: balanceRows }] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS count FROM users WHERE role = 'user'`),
      pool.query(
        `SELECT COUNT(*)::int AS total_trades,
                COALESCE(SUM(CASE WHEN status = 'closed' THEN profit ELSE 0 END), 0)::numeric AS realized_profit
           FROM trades`
      ),
      pool.query(
        `SELECT COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
                COUNT(*) FILTER (WHERE status = 'approved')::int AS approved,
                COUNT(*) FILTER (WHERE status = 'rejected')::int AS rejected
           FROM requests`
      ),
      pool.query(`SELECT COALESCE(SUM(balance),0)::numeric AS total_balance FROM users`)
    ]);

    const activitySeries = await pool.query(
      `SELECT TO_CHAR(day, 'YYYY-MM-DD') AS label, trades, profit
         FROM (
                SELECT date_trunc('day', opened_at) AS day,
                       COUNT(*)::int AS trades,
                       COALESCE(SUM(CASE WHEN status = 'closed' THEN profit ELSE 0 END),0)::numeric AS profit
                  FROM trades
                 WHERE opened_at >= NOW() - INTERVAL '14 days'
              GROUP BY day
              ORDER BY day ASC
              ) AS daily`
    );

    res.json({
      success: true,
      data: {
        users: userRows[0]?.count ?? 0,
        totalTrades: tradeRows[0]?.total_trades ?? 0,
        realizedProfit: tradeRows[0]?.realized_profit ?? 0,
        withdrawals: withdrawalRows[0] ?? { pending: 0, approved: 0, rejected: 0 },
        totalBalance: balanceRows[0]?.total_balance ?? 0,
        activity: activitySeries.rows
      }
    });
  } catch (error) {
    next(error);
  }
});

export default adminRouter;
