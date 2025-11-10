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

dotenv.config();

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ✅ إعداد CORS متقدّم يسمح للـ Telegram Mini App
app.use(
  cors({
    origin: [
      "https://t.me", // Telegram Mini App
      "https://web.telegram.org",
      "https://qltrading-render.onrender.com",
      "http://localhost:10000",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  })
);

// ✅ لعرض كل الطلبات بالـ log أثناء الاختبار
app.use((req, _res, next) => {
  log(`➡️  ${req.method} ${req.url}`);
  next();
});

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// ✅ ملفات الواجهة
app.use(express.static(path.join(__dirname, "../public")));

// ✅ نقاط API
app.use("/webhook", bot);
app.use("/api/keys", keysRouter);
app.use("/api/users", secureAccess, usersRouter);
app.use("/api/trades", secureAccess, tradesRouter);
app.use("/api/withdraw", secureAccess, withdrawRouter);
app.use("/api/admin", adminRouter);
app.use("/api/markets", marketsRouter);

// ✅ فحص الصحة
app.get("/healthz", (_req, res) => res.json({ ok: true }));

// ✅ رد افتراضي لأي مسار غير موجود (Debug)
app.use((req, res) => {
  log(`❌ 404 Not Found: ${req.originalUrl}`);
  res.status(404).json({ ok: false, error: "not_found", path: req.originalUrl });
});

// ✅ التقاط أي أخطاء عامة
app.use((err, _req, res, _next) => {
  log("❌ Unhandled error", err);
  res.status(500).json({ ok: false, error: "internal_error" });
});

// ✅ تشغيل السيرفر
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => log(`🚀 QL Trading AI running on port ${PORT}`));
