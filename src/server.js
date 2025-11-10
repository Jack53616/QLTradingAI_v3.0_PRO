import express from "express";
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

const DEFAULT_ALLOW_HEADERS = [
  "Content-Type",
  "Authorization",
  "x-telegram-initdata",
];
const ALLOW_METHODS = "GET,POST,PUT,PATCH,DELETE,OPTIONS";

function appendVaryHeader(existing = "", values = []) {
  const current = new Set(
    existing
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
  );
  values.forEach((value) => {
    if (value) current.add(value);
  });
  return Array.from(current).join(", ");
}

function inferFallbackOrigin(req) {
  if (process.env.CORS_FALLBACK_ORIGIN) {
    return process.env.CORS_FALLBACK_ORIGIN;
  }

  const forwardedProto = req.get("x-forwarded-proto");
  const host = req.get("host");
  if (forwardedProto && host) {
    const proto = forwardedProto.split(",")[0].trim();
    if (proto) return `${proto}://${host}`;
  }
  if (req.protocol && host) {
    return `${req.protocol}://${host}`;
  }
  return "*";
}

function applyCorsHeaders(req, res) {
  const requestOrigin = req.get("origin");
  const referer = req.get("referer");

  let allowOrigin = null;
  if (requestOrigin && requestOrigin !== "null") {
    allowOrigin = requestOrigin;
  } else if (referer) {
    try {
      allowOrigin = new URL(referer).origin;
    } catch {
      allowOrigin = null;
    }
  }

  if (!allowOrigin) {
    allowOrigin = inferFallbackOrigin(req);
  }

  res.locals.allowOrigin = allowOrigin;
  res.header("Access-Control-Allow-Origin", allowOrigin);
  res.header("Access-Control-Allow-Methods", ALLOW_METHODS);
  res.header("Access-Control-Max-Age", String(60 * 60 * 12));
  res.header(
    "Access-Control-Allow-Headers",
    DEFAULT_ALLOW_HEADERS.join(", ")
  );
  res.header("Access-Control-Expose-Headers", "Content-Type, Content-Length");

  const requestedHeaders = req.get("access-control-request-headers");
  if (requestedHeaders) {
    res.header(
      "Access-Control-Allow-Headers",
      `${DEFAULT_ALLOW_HEADERS.join(", ")}, ${requestedHeaders}`
    );
  }

  if (allowOrigin !== "*") {
    res.header("Access-Control-Allow-Credentials", "true");
  }

  res.header(
    "Vary",
    appendVaryHeader(res.get("Vary"), [
      "Origin",
      "Referer",
      "Access-Control-Request-Headers",
    ])
  );

  return allowOrigin;
}

const saveRawBody = (req, _res, buf) => {
  if (!buf?.length) return;
  try {
    req.rawBody = buf.toString("utf8");
  } catch {
    req.rawBody = buf;
  }
};

app.use((req, res, next) => {
  const allowOrigin = applyCorsHeaders(req, res);

  if (req.method === "OPTIONS") {
    log("🛰️  Preflight", {
      url: req.originalUrl,
      origin: allowOrigin,
      requested: req.get("access-control-request-headers") || null,
    });
    return res.sendStatus(204);
  }

  log("➡️  Request", {
    method: req.method,
    url: req.originalUrl,
    origin: allowOrigin,
    referer: req.get("referer") || null,
    "x-telegram-initdata": req.get("x-telegram-initdata") ? "<present>" : null,
    contentType: req.get("content-type") || null,
  });

  next();
});

app.use(
  express.json({
    limit: "1mb",
    type: ["application/json", "application/*+json"],
    verify: saveRawBody,
  })
);
app.use(
  express.urlencoded({
    extended: true,
    limit: "1mb",
    verify: saveRawBody,
  })
);
app.use(
  express.text({
    type: ["text/plain", "text/*"],
    limit: "1mb",
    verify: saveRawBody,
  })
);

app.use(express.static(path.join(__dirname, "../public")));

app.use("/webhook", bot);
app.use("/api/keys", keysRouter);
app.use("/api/users", secureAccess, usersRouter);
app.use("/api/trades", secureAccess, tradesRouter);
app.use("/api/withdraw", secureAccess, withdrawRouter);
app.use("/api/admin", adminRouter);
app.use("/api/markets", marketsRouter);

app.all("/api/debug", (req, res) => {
  res.json({
    ok: true,
    method: req.method,
    url: req.originalUrl,
    origin: req.get("origin") || null,
    headers: req.headers,
    body: req.body,
    query: req.query,
  });
});

app.get("/healthz", (_req, res) => res.json({ ok: true }));

app.use((err, _req, res, _next) => {
  log("❌ Unhandled error", err);
  res.status(500).json({ ok: false, error: "internal_error" });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => log(`🚀 QL Trading AI running on port ${PORT}`));
