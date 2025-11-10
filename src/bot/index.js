import express from "express";
import { pool } from "../utils/db.js";
import { log } from "../utils/logger.js";
import { hashKey } from "../utils/hash.js";

export const bot = express.Router();

const admins = (process.env.TELEGRAM_ADMINS || "")
  .split(",")
  .map((id) => Number(id.trim()))
  .filter(Boolean);

// ✅ استقبال التحديثات من Webhook
bot.post("/:token", async (req, res) => {
  if (req.params.token !== process.env.BOT_TOKEN) {
    log("⚠️ Invalid webhook token attempt");
    return res.json({ ok: true });
  }

  const update = req.body;
  try {
    if (update?.message?.text) await handleCommand(update.message);
  } catch (err) {
    log("❌ Telegram bot error", err);
  }

  res.json({ ok: true });
});

// ✅ معالجة الأوامر
async function handleCommand(message) {
  const chatId = message.chat.id;
  const text = message.text.trim();
  const isAdmin = admins.includes(chatId);

  // /start
  if (text === "/start") {
    return sendMessage(
      chatId,
      "🤖 *QL Trading AI bot ready!*\nUse /help to explore commands.",
      { parse_mode: "Markdown" }
    );
  }

  // /help
  if (text === "/help") {
    const help = isAdmin
      ? `🛠 *Admin Commands:*
/create_key <days> [level]
/addbalance <user_id> <amount>
/setdaily <user_id> <profit><m/h>
/broadcast <message>
/approve_withdraw <request_id>
/reject_withdraw <request_id>`
      : "ℹ️ Use the QL Trading AI mini-app to manage your account.";
    return sendMessage(chatId, help, { parse_mode: "Markdown" });
  }

  // التحقق من صلاحية الأدمن
  if (!isAdmin)
    return sendMessage(chatId, "🚫 This command is for administrators only.");

  // ✅ /create_key <days> [level]
  if (text.startsWith("/create_key")) {
    const [, daysRaw, levelRaw] = text.split(/\s+/);
    const days = Number(daysRaw || 30);
    const level = levelRaw || "Bronze";
    if (!days || Number.isNaN(days))
      return sendMessage(chatId, "❌ Usage: /create_key <days> [level]");

    const plainKey = Math.random().toString(36).slice(2, 10).toUpperCase();
    const hashed = hashKey(plainKey);

    await pool.query(
      `INSERT INTO keys (key_code, duration_days, level)
       VALUES ($1, $2, $3)
       ON CONFLICT (key_code) DO UPDATE SET duration_days = EXCLUDED.duration_days, level = EXCLUDED.level`,
      [hashed, days, level]
    );

    return sendMessage(
      chatId,
      `✅ Key generated for ${days} days (level: ${level}).\n<code>${plainKey}</code>`,
      { parse_mode: "HTML" }
    );
  }

  // ✅ /addbalance <user_id> <amount>
  if (text.startsWith("/addbalance")) {
    const [, idRaw, amountRaw] = text.split(/\s+/);
    const userId = Number(idRaw);
    const amount = Number(amountRaw);
    if (!userId || !amount)
      return sendMessage(chatId, "❌ Usage: /addbalance <user_id> <amount>");

    await pool.query(
      "UPDATE users SET balance = balance + $1 WHERE id = $2",
      [amount, userId]
    );
    await sendMessage(
      chatId,
      `💰 Added ${amount.toFixed(2)}$ to user ${userId}.`
    );
    return sendMessage(
      userId,
      `💵 تم إيداع ${amount.toFixed(2)}$ في حسابك ✅`
    );
  }

  // ✅ /setdaily <user_id> <profit><m/h>
  if (text.startsWith("/setdaily")) {
    const [, idRaw, profitRaw] = text.split(/\s+/);
    const userId = Number(idRaw);
    const profit = Number(profitRaw?.replace(/[mh]$/i, ""));
    if (!userId || !profitRaw || Number.isNaN(profit))
      return sendMessage(
        chatId,
        "❌ Usage: /setdaily <user_id> <profit><m/h>"
      );

    const isHourly = profitRaw.toLowerCase().endsWith("h");
    const timeframe = isHourly ? "Hourly" : "Daily";
    const durationMs = isHourly ? 60 * 60 * 1000 : 2 * 60 * 1000;
    const step = profit / (durationMs / 2000);

    let current = 0;
    const interval = setInterval(async () => {
      current += step;
      await pool.query("UPDATE users SET balance = balance + $1 WHERE id = $2", [
        step,
        userId,
      ]);
    }, 2000);

    setTimeout(async () => {
      clearInterval(interval);
      await pool.query(
        `INSERT INTO trades (user_id, pair, type, amount, profit, opened_at, closed_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
        [userId, "BTC/USD", timeframe, Math.abs(profit) * 10, profit]
      );
      await sendMessage(
        chatId,
        `🚀 Trade for ${userId} closed with ${profit.toFixed(2)}$ profit.`
      );
      await sendMessage(
        userId,
        `✅ صفقة جديدة تمت إضافتها بربح ${profit.toFixed(2)}$!`
      );
    }, durationMs);

    return sendMessage(
      chatId,
      `📊 Trade started for ${userId} (${timeframe}) target ${profit.toFixed(
        2
      )}$`
    );
  }

  // ✅ /broadcast
  if (text.startsWith("/broadcast")) {
    const message = text.replace("/broadcast", "").trim();
    if (!message)
      return sendMessage(chatId, "❌ Usage: /broadcast <message>");

    const { rows } = await pool.query("SELECT id FROM users");
    for (const row of rows) {
      await sendMessage(row.id, `📢 ${message}`);
    }
    return sendMessage(chatId, "✅ Broadcast sent to all users.");
  }

  // ✅ /approve_withdraw <id>
  if (text.startsWith("/approve_withdraw")) {
    const [, reqId] = text.split(/\s+/);
    const requestId = Number(reqId);
    if (!requestId)
      return sendMessage(chatId, "❌ Usage: /approve_withdraw <request_id>");

    const { rows } = await pool.query(
      "UPDATE requests SET status = 'approved' WHERE id = $1 RETURNING user_id",
      [requestId]
    );
    if (!rows.length) return sendMessage(chatId, "⚠️ Request not found.");
    await sendMessage(rows[0].user_id, "✅ تم قبول طلب السحب الخاص بك.");
    return sendMessage(chatId, "✅ Withdrawal approved.");
  }

  // ✅ /reject_withdraw <id>
  if (text.startsWith("/reject_withdraw")) {
    const [, reqId] = text.split(/\s+/);
    const requestId = Number(reqId);
    if (!requestId)
      return sendMessage(chatId, "❌ Usage: /reject_withdraw <request_id>");

    const { rows } = await pool.query(
      "UPDATE requests SET status = 'rejected' WHERE id = $1 RETURNING user_id",
      [requestId]
    );
    if (!rows.length) return sendMessage(chatId, "⚠️ Request not found.");
    await sendMessage(rows[0].user_id, "❌ تم رفض طلب السحب الخاص بك.");
    return sendMessage(chatId, "🚫 Withdrawal rejected.");
  }

  return sendMessage(chatId, "ℹ️ Unknown command. Use /help for the list of commands.");
}

// ✅ إرسال الرسائل
async function sendMessage(chatId, text, options = {}) {
  try {
    await fetch(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, ...options }),
    });
  } catch (err) {
    log("⚠️ Failed to send Telegram message", err);
  }
}
