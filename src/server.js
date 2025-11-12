import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import { config } from "./config/env.js";
import { pool } from "./utils/db.js";
import authRouter from "./routes/auth.js";
import userRouter from "./routes/user.js";
import tradesRouter from "./routes/trades.js";
import marketsRouter from "./routes/markets.js";
import activityRouter from "./routes/activity.js";
import adminRouter from "./routes/admin.js";
import { authenticate } from "./middleware/authenticate.js";
import { notFoundHandler, errorHandler } from "./middleware/error-handler.js";
import { rateLimiter } from "./middleware/rate-limit.js";
import { startTelegramBot } from "./bot/index.js";

dotenv.config();

const app = express();

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(",") || "*",
  credentials: true
}));
app.use(express.json({ limit: "1mb" }));

app.use(rateLimiter({ windowMs: 15 * 60 * 1000, limit: 200 }));

// Serve static files from public directory
app.use(express.static("public"));

app.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ success: true, message: "ok" });
  } catch (error) {
    res.status(503).json({ success: false, message: "database_unreachable" });
  }
});

// Serve admin panel
app.get("/admin", (_req, res) => {
  res.sendFile("admin.html", { root: "public" });
});

app.use("/api/auth", authRouter);
app.use("/api/user", authenticate, userRouter);
app.use("/api/trades", authenticate, tradesRouter);
app.use("/api/activity", activityRouter);
app.use("/api/markets", marketsRouter);
app.use("/api/admin", adminRouter);

// Telegram webhook endpoint
app.post("/webhook/:token", async (req, res) => {
  const token = req.params.token;
  if (token !== process.env.BOT_TOKEN) {
    return res.status(403).json({ error: "invalid_token" });
  }
  
  try {
    const bot = await startTelegramBot();
    if (bot && req.body) {
      bot.processUpdate(req.body);
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("Webhook error:", err);
    res.status(500).json({ error: "internal_error" });
  }
});

app.use(notFoundHandler);
app.use(errorHandler);

const PORT = config.PORT || 4000;
app.listen(PORT, () => {
  console.log(JSON.stringify({ level: "info", message: "server_started", port: PORT }));
});

startTelegramBot().catch((err) => {
  console.error(
    JSON.stringify({
      level: "error",
      message: "telegram_bot_start_failed",
      error: err?.message || String(err)
    })
  );
});
