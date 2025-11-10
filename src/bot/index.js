import express from "express";
import { log } from "../utils/logger.js";

export const bot = express.Router();

bot.post("/:token", async (req, res) => {
  const { token } = req.params;
  if (token !== process.env.BOT_TOKEN) {
    log("❌ Invalid Telegram token attempt");
    return res.status(401).send("invalid token");
  }

  const update = req.body;
  log("🤖 Telegram webhook received update");

  // ✅ إذا الرسالة فيها نص
  if (update.message && update.message.text) {
    const chatId = update.message.chat.id;
    const text = update.message.text.trim();

    // 🔹 رد بسيط لتأكيد الاتصال
    if (text === "/start") {
      await fetch(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: "🤖 QL Trading AI bot is connected successfully!",
        }),
      });
    }

    // 🔹 مثال: أمر /create_key للتجربة
    if (text.startsWith("/create_key")) {
      await fetch(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: "🧩 Key creation command received (test mode)",
        }),
      });
    }
  }

  res.status(200).send("ok");
});
