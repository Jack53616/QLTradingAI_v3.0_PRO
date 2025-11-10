import express from "express";
import { log } from "../utils/logger.js";

export const marketsRouter = express.Router();

const cache = { data: null, updated: 0 };

async function fetchMarkets() {
  const now = Date.now();
  if (cache.data && now - cache.updated < 60_000) {
    return cache.data;
  }

  try {
    const [btc, eth, metals] = await Promise.all([
      fetch("https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT").then((r) => r.json()),
      fetch("https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT").then((r) => r.json()),
      fetch(
        "https://query1.finance.yahoo.com/v7/finance/quote?symbols=GC=F,SI=F",
        { headers: { "User-Agent": "QLTradingAI/1.0" } }
      ).then((r) => r.json()),
    ]);

    const metalsMap = new Map();
    if (metals?.quoteResponse?.result) {
      for (const item of metals.quoteResponse.result) {
        if (item.symbol === "GC=F") metalsMap.set("XAU/USD", Number(item.regularMarketPrice));
        if (item.symbol === "SI=F") metalsMap.set("XAG/USD", Number(item.regularMarketPrice));
      }
    }

    const data = [
      { pair: "BTC/USDT", price: Number(btc?.price) || null },
      { pair: "ETH/USDT", price: Number(eth?.price) || null },
      { pair: "XAU/USD", price: metalsMap.get("XAU/USD") || null },
      { pair: "XAG/USD", price: metalsMap.get("XAG/USD") || null },
    ];

    cache.data = data;
    cache.updated = now;
    return data;
  } catch (err) {
    log("❌ Markets fetch failed", err);
    return cache.data || [];
  }
}

marketsRouter.get("/", async (_req, res) => {
  const markets = await fetchMarkets();
  res.json({ ok: true, markets });
});
