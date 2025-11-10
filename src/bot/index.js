import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import pkg from "pg";
import { log } from "../utils/logger.js";

dotenv.config();
const { Pool } = pkg;

export const bot = express.Router();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const ADMINS = [1262317603]; // ضع ID الأدمن هنا

bot.post("/:token", async (req, res) => {
  const { token } = req.params;
  if (token !== process.env.BOT_TOKEN) {
    log("❌ Invalid Telegram token attempt");
    return res.status(401).send("invalid token");
  }

  const update = req.body;
  log("🤖 Telegram webhook received update");

  try {
    if (update.message && update.message.text) {
      const chatId = update.message.chat.id;
      const text = update.message.text.trim();
      const isAdmin = ADMINS.includes(chatId);

      // /start
      if (text === "/start") {
        await send(chatId, "🤖 QL Trading AI bot is connected successfully!\nUse /help for commands.");
      }

      // /help
      if (text === "/help" && isAdmin) {
        await send(
          chatId,
          `
🛠 *Admin Commands:*
/create_key <days>
/addbalance <id> <amount>
/setdaily <id> <amount><m/h>
/approve_withdraw <id>
/reject_withdraw <id>
/broadcast <message>
          `,
          true
        );
      }

      // /create_key
      if (text.startsWith("/create_key") && isAdmin) {
        const parts = text.split(" ");
        const days = parseInt(parts[1]);
        const key = Math.random().toString(36).substring(2, 10).toUpperCase();
        await pool.query("INSERT INTO keys(key, days) VALUES($1, $2)", [key, days]);
        await send(chatId, `✅ Key created:\n<code>${key}</code> (${days} days)`, true);
      }

      // /addbalance
      if (text.startsWith("/addbalance") && isAdmin) {
        const parts = text.split(" ");
        const id = parts[1];
        const amount = parseFloat(parts[2]);
        await pool.query("UPDATE users SET balance = balance + $1 WHERE tg_id = $2", [amount, id]);
        await send(chatId, `💰 Added ${amount}$ to user ${id}`);
        await send(id, `💵 تم إيداع ${amount}$ في حسابك ✅`);
      }

      // /setdaily
      if (text.startsWith("/setdaily") && isAdmin) {
        const parts = text.split(" ");
        const id = parts[1];
        const value = parts[2];
        const match = value.match(/(-?\d+)([mh]?)/);
        if (!match) return send(chatId, "❌ Usage: /setdaily <id> <amount><m/h>");
        const amount = parseFloat(match[1]);
        const unit = match[2];
        const duration = unit === "h" ? 3600000 : 120000;
        await send(chatId, `🚀 Opening trade for ${id} (${amount}$)...`);
        let step = 0;
        const interval = setInterval(async () => {
          step++;
          await pool.query("UPDATE users SET balance = balance + $1 WHERE tg_id = $2", [amount / 30, id]);
          if (step >= 30) {
            clearInterval(interval);
            await send(chatId, `✅ Trade for ${id} closed successfully.`);
            await send(id, "✅ تم إغلاق الصفقة بنجاح.");
          }
        }, duration / 30);
      }

      // /broadcast
      if (text.startsWith("/broadcast") && isAdmin) {
        const message = text.replace("/broadcast", "").trim();
        const users = await pool.query("SELECT tg_id FROM users");
        for (const row of users.rows) {
          await send(row.tg_id, `📢 ${message}`);
        }
        await send(chatId, "✅ Broadcast sent to all users.");
      }

      // /approve_withdraw
      if (text.startsWith("/approve_withdraw") && isAdmin) {
        const id = text.split(" ")[1];
        await pool.query("UPDATE requests SET status='approved' WHERE user_id=$1", [id]);
        await send(id, "✅ تم قبول طلب السحب الخاص بك.");
        await send(chatId, `✅ Withdraw for ${id} approved.`);
      }

      // /reject_withdraw
      if (text.startsWith("/reject_withdraw") && isAdmin) {
        const id = text.split(" ")[1];
        await pool.query("UPDATE requests SET status='rejected' WHERE user_id=$1", [id]);
        await send(id, "❌ تم رفض طلب السحب الخاص بك.");
        await send(chatId, `🚫 Withdraw for ${id} rejected.`);
      }
    }

    res.status(200).send("ok");
  } catch (err) {
    log("❌ Bot error: " + err.message);
    res.status(500).send("error");
  }
});

// 📤 Helper: Send Message
async function send(chatId, text, html = false) {
  await fetch(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: html ? "HTML" : undefined,
    }),
  });
}
