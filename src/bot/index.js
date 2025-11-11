import express from "express";
import { pool } from "../utils/db.js";
import { log, warn, error } from "../utils/logger.js";
import { hashKey } from "../utils/hash.js";
import { isPositiveNumber, sleep } from "../utils/helpers.js";

export const bot = express.Router();

const admins = (process.env.TELEGRAM_ADMINS || "")
  .split(",")
  .map((id) => Number(id.trim()))
  .filter(Boolean);

bot.post("/:token", async (req, res) => {
  if (req.params.token !== process.env.BOT_TOKEN) {
    warn("⚠️ Webhook hit with invalid token");
    return res.status(403).json({ ok: false, error: "invalid_token" });
  }

  const update = req.body;
  try {
    if (update?.message?.text) {
      await handleCommand(update.message);
    }
  } catch (err) {
    error("❌ Bot error:", err);
  }

  res.json({ ok: true });
});

async function handleCommand(message) {
  const chatId = message.chat.id;
  const text = message.text.trim();
  const isAdmin = admins.includes(chatId);

  if (text === "/start") {
    return sendMessage(
      chatId,
      "🤖 *QL Trading AI Bot Ready!*\n\nWelcome to QL Trading AI. Use /help to explore available commands.",
      { parse_mode: "Markdown" }
    );
  }

  if (text === "/help") {
    const help = isAdmin
      ? `🛠 *Admin Commands:*
/create_key <days> [level] - Generate subscription key
/addbalance <user_id> <amount> - Add balance to user
/setdaily <user_id> <profit><m/h> - Add trade profit
/broadcast <message> - Send message to all users
/approve_withdraw <request_id> - Approve withdrawal
/reject_withdraw <request_id> - Reject withdrawal
/stats - View platform statistics`
      : "ℹ️ Use the QL Trading AI mini-app to manage your account and view your dashboard.";
    return sendMessage(chatId, help, { parse_mode: "Markdown" });
  }

  if (!isAdmin) {
    return sendMessage(chatId, "🚫 This command is for administrators only.");
  }

  // Admin commands
  if (text.startsWith("/create_key")) {
    return handleCreateKey(chatId, text);
  }

  if (text.startsWith("/addbalance")) {
    return handleAddBalance(chatId, text);
  }

  if (text.startsWith("/setdaily")) {
    return handleSetDaily(chatId, text);
  }

  if (text.startsWith("/broadcast")) {
    return handleBroadcast(chatId, text);
  }

  if (text.startsWith("/approve_withdraw")) {
    return handleApproveWithdraw(chatId, text);
  }

  if (text.startsWith("/reject_withdraw")) {
    return handleRejectWithdraw(chatId, text);
  }

  if (text === "/stats") {
    return handleStats(chatId);
  }

  return sendMessage(chatId, "ℹ️ Unknown command. Use /help for the list of commands.");
}

async function handleCreateKey(chatId, text) {
  const [, daysRaw, levelRaw] = text.split(/\s+/);
  const days = Number(daysRaw || 30);
  const level = levelRaw || "Bronze";

  if (!days || Number.isNaN(days) || days < 1) {
    return sendMessage(chatId, "❌ Usage: /create_key <days> [level]\nExample: /create_key 30 Gold");
  }

  try {
    const plainKey = Math.random().toString(36).slice(2, 10).toUpperCase();
    const hashed = hashKey(plainKey);

    await pool.query(
      `INSERT INTO keys (key_code, duration_days, level)
       VALUES ($1, $2, $3)
       ON CONFLICT (key_code) DO UPDATE SET duration_days = EXCLUDED.duration_days, level = EXCLUDED.level`,
      [hashed, days, level]
    );

    log("🔑 Key created", { days, level });

    return sendMessage(
      chatId,
      `✅ *Key Generated Successfully*\n\n` +
      `Duration: ${days} days\n` +
      `Level: ${level}\n\n` +
      `Key: <code>${plainKey}</code>\n\n` +
      `⚠️ Keep this key secure!`,
      { parse_mode: "HTML" }
    );
  } catch (err) {
    error("❌ Error creating key:", err);
    return sendMessage(chatId, "❌ Failed to create key. Please try again.");
  }
}

async function handleAddBalance(chatId, text) {
  const [, idRaw, amountRaw] = text.split(/\s+/);
  const userId = Number(idRaw);
  const amount = Number(amountRaw);

  if (!userId || !isPositiveNumber(amount)) {
    return sendMessage(chatId, "❌ Usage: /addbalance <user_id> <amount>\nExample: /addbalance 123456789 100");
  }

  try {
    const { rowCount } = await pool.query(
      "UPDATE users SET balance = balance + $1 WHERE id = $2",
      [amount, userId]
    );

    if (!rowCount) {
      return sendMessage(chatId, "❌ User not found.");
    }

    log("💰 Balance added", { userId, amount });

    await sendMessage(chatId, `✅ Added $${amount.toFixed(2)} to user ${userId}.`);
    await sendMessage(userId, `💵 تم إيداع $${amount.toFixed(2)} في حسابك ✅`);
  } catch (err) {
    error("❌ Error adding balance:", err);
    return sendMessage(chatId, "❌ Failed to add balance.");
  }
}

async function handleSetDaily(chatId, text) {
  const [, idRaw, profitRaw] = text.split(/\s+/);
  const userId = Number(idRaw);
  const profit = Number(profitRaw?.replace(/[mh]$/i, ""));

  if (!userId || !profitRaw || Number.isNaN(profit)) {
    return sendMessage(chatId, "❌ Usage: /setdaily <user_id> <profit><m/h>\nExample: /setdaily 123456789 50m");
  }

  const timeframe = profitRaw.toLowerCase().endsWith("h") ? "Hourly" : "Daily";

  try {
    await pool.query(
      `INSERT INTO trades (user_id, pair, type, amount, profit, opened_at, closed_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
      [userId, timeframe === "Hourly" ? "Gold" : "BTC", timeframe, Math.abs(profit) * 10, profit]
    );

    await pool.query("UPDATE users SET balance = balance + $1 WHERE id = $2", [profit, userId]);

    log("📈 Trade added", { userId, profit, timeframe });

    await sendMessage(chatId, `✅ Trade for user ${userId} closed with $${profit.toFixed(2)} profit.`);
    await sendMessage(userId, `✅ صفقة جديدة تمت إضافتها بربح $${profit.toFixed(2)}!`);
  } catch (err) {
    error("❌ Error setting daily:", err);
    return sendMessage(chatId, "❌ Failed to add trade.");
  }
}

async function handleBroadcast(chatId, text) {
  const message = text.replace("/broadcast", "").trim();
  if (!message) {
    return sendMessage(chatId, "❌ Usage: /broadcast <message>");
  }

  try {
    const { rows } = await pool.query("SELECT id FROM users");
    
    let sent = 0;
    let failed = 0;

    for (const row of rows) {
      try {
        await sendMessage(row.id, `📢 ${message}`);
        sent++;
        await sleep(100); // Prevent rate limiting
      } catch {
        failed++;
      }
    }

    log("📢 Broadcast completed", { sent, failed });
    return sendMessage(chatId, `✅ Broadcast sent to ${sent} users. Failed: ${failed}`);
  } catch (err) {
    error("❌ Broadcast error:", err);
    return sendMessage(chatId, "❌ Failed to send broadcast.");
  }
}

async function handleApproveWithdraw(chatId, text) {
  const [, requestIdRaw] = text.split(/\s+/);
  const requestId = Number(requestIdRaw);

  if (!requestId) {
    return sendMessage(chatId, "❌ Usage: /approve_withdraw <request_id>");
  }

  try {
    // Get request details
    const { rows: requestRows } = await pool.query(
      "SELECT user_id, amount FROM requests WHERE id = $1 AND status = 'pending'",
      [requestId]
    );

    if (!requestRows.length) {
      return sendMessage(chatId, "⚠️ Request not found or already processed.");
    }

    const { user_id, amount } = requestRows[0];

    // Balance already deducted when request was created
    // Just update status and add timestamp
    await pool.query(
      "UPDATE requests SET status = 'approved', processed_at = NOW() WHERE id = $1",
      [requestId]
    );

    log("✅ Withdrawal approved", { requestId, userId: user_id, amount });

    await sendMessage(user_id, `✅ تم قبول طلب السحب الخاص بك بمبلغ $${amount}`);
    return sendMessage(chatId, `✅ Withdrawal #${requestId} approved. Balance was already reserved.`);
  } catch (err) {
    error("❌ Error approving withdrawal:", err);
    return sendMessage(chatId, "❌ Failed to approve withdrawal.");
  }
}

async function handleRejectWithdraw(chatId, text) {
  const [, requestIdRaw] = text.split(/\s+/);
  const requestId = Number(requestIdRaw);

  if (!requestId) {
    return sendMessage(chatId, "❌ Usage: /reject_withdraw <request_id>");
  }

  try {
    await pool.query("BEGIN");

    // Get request details
    const { rows: requestRows } = await pool.query(
      "SELECT user_id, amount FROM requests WHERE id = $1 AND status = 'pending'",
      [requestId]
    );

    if (!requestRows.length) {
      await pool.query("ROLLBACK");
      return sendMessage(chatId, "⚠️ Request not found or already processed.");
    }

    const { user_id, amount } = requestRows[0];

    // Return reserved balance to user
    await pool.query(
      "UPDATE users SET balance = balance + $1 WHERE id = $2",
      [amount, user_id]
    );

    // Update request status
    await pool.query(
      "UPDATE requests SET status = 'rejected', processed_at = NOW() WHERE id = $1",
      [requestId]
    );

    await pool.query("COMMIT");

    log("🚫 Withdrawal rejected and balance returned", { requestId, userId: user_id, amount });

    await sendMessage(user_id, `❌ تم رفض طلب السحب الخاص بك. تم إرجاع $${amount} إلى رصيدك.`);
    return sendMessage(chatId, `🚫 Withdrawal #${requestId} rejected. $${amount} returned to user.`);
  } catch (err) {
    await pool.query("ROLLBACK");
    error("❌ Error rejecting withdrawal:", err);
    return sendMessage(chatId, "❌ Failed to reject withdrawal.");
  }
}

async function handleStats(chatId) {
  try {
    const stats = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM users) as total_users,
        (SELECT COUNT(*) FROM users WHERE sub_expires > NOW()) as active_subs,
        (SELECT COUNT(*) FROM trades) as total_trades,
        (SELECT COUNT(*) FROM requests WHERE status = 'pending') as pending_withdrawals,
        (SELECT SUM(balance) FROM users) as total_balance
    `);

    const data = stats.rows[0];

    const message = `📊 *Platform Statistics*\n\n` +
      `👥 Total Users: ${data.total_users}\n` +
      `✅ Active Subscriptions: ${data.active_subs}\n` +
      `📈 Total Trades: ${data.total_trades}\n` +
      `⏳ Pending Withdrawals: ${data.pending_withdrawals}\n` +
      `💰 Total Balance: $${Number(data.total_balance || 0).toFixed(2)}`;

    return sendMessage(chatId, message, { parse_mode: "Markdown" });
  } catch (err) {
    error("❌ Error fetching stats:", err);
    return sendMessage(chatId, "❌ Failed to fetch statistics.");
  }
}

async function sendMessage(chatId, text, options = {}) {
  try {
    const response = await fetch(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, ...options }),
    });

    if (!response.ok) {
      throw new Error(`Telegram API error: ${response.status}`);
    }
  } catch (err) {
    warn("⚠️ Failed to send Telegram message:", err);
  }
}
