import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

import { secureAccess } from "./middleware/secure.js";
import { usersRouter } from "./api/users.js";
import { keysRouter } from "./api/keys.js";
import { tradesRouter } from "./api/trades.js";
import { withdrawRouter } from "./api/withdraw.js";
import { adminRouter } from "./api/admin.js";
import { marketsRouter } from "./api/markets.js";
import { bot } from "./bot/index.js";
import { log } from "./utils/logger.js";
import { pool } from "./utils/db.js";

dotenv.config();

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// CORS configuration
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-telegram-initdata']
};
app.use(cors(corsOptions));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, "../public")));

app.use("/webhook", bot);
app.use("/api/keys", keysRouter);
app.use("/api/users", secureAccess, usersRouter);
app.use("/api/trades", secureAccess, tradesRouter);
app.use("/api/withdraw", secureAccess, withdrawRouter);
app.use("/api/admin", adminRouter);
app.use("/api/markets", marketsRouter);

app.get("/healthz", async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, database: "connected", timestamp: new Date().toISOString() });
  } catch (err) {
    log("❌ Health check failed:", err);
    res.status(503).json({ ok: false, database: "disconnected", error: "database_unavailable" });
  }
});

app.use((err, _req, res, _next) => {
  log("❌ Unhandled error", err);
  res.status(500).json({ ok: false, error: "internal_error" });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => log(`🚀 QL Trading AI running on port ${PORT}`));
