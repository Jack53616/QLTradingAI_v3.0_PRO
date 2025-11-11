import express from "express";
import { log, error } from "../utils/logger.js";

export const marketsRouter = express.Router();

// In-memory cache for market data
let marketCache = {
  data: [],
  lastUpdate: null
};

const CACHE_DURATION = 30 * 1000; // 30 seconds

/**
 * Mock market data generator
 * In production, this should fetch from a real API (Binance, CoinGecko, etc.)
 */
function generateMarketData() {
  const pairs = [
    { pair: "BTC/USDT", basePrice: 45000 },
    { pair: "ETH/USDT", basePrice: 2500 },
    { pair: "BNB/USDT", basePrice: 320 },
    { pair: "SOL/USDT", basePrice: 110 },
    { pair: "XRP/USDT", basePrice: 0.65 },
    { pair: "ADA/USDT", basePrice: 0.45 },
    { pair: "DOGE/USDT", basePrice: 0.08 },
    { pair: "MATIC/USDT", basePrice: 0.85 }
  ];

  return pairs.map(({ pair, basePrice }) => {
    // Add random variation (-2% to +2%)
    const variation = (Math.random() - 0.5) * 0.04;
    const price = basePrice * (1 + variation);
    const change24h = (Math.random() - 0.5) * 10; // -5% to +5%

    return {
      pair,
      price: price.toFixed(2),
      change24h: change24h.toFixed(2),
      volume24h: (Math.random() * 1000000000).toFixed(0),
      high24h: (price * 1.03).toFixed(2),
      low24h: (price * 0.97).toFixed(2),
      lastUpdate: new Date().toISOString()
    };
  });
}

/**
 * Get market data with caching
 */
function getMarketData() {
  const now = Date.now();
  
  if (!marketCache.lastUpdate || now - marketCache.lastUpdate > CACHE_DURATION) {
    marketCache.data = generateMarketData();
    marketCache.lastUpdate = now;
    log("📊 Market data refreshed");
  }

  return marketCache.data;
}

/**
 * GET /api/markets
 * Get all market data
 */
marketsRouter.get("/", async (req, res) => {
  try {
    const markets = getMarketData();
    res.json({ 
      ok: true, 
      markets,
      cached: Date.now() - marketCache.lastUpdate < CACHE_DURATION,
      nextUpdate: new Date(marketCache.lastUpdate + CACHE_DURATION).toISOString()
    });
  } catch (err) {
    error("❌ Error fetching markets:", err);
    res.status(500).json({ 
      ok: false, 
      error: "markets_fetch_failed",
      message: "Could not fetch market data"
    });
  }
});

/**
 * GET /api/markets/:pair
 * Get specific market pair data
 */
marketsRouter.get("/:pair", async (req, res) => {
  try {
    const { pair } = req.params;
    const markets = getMarketData();
    const market = markets.find(m => m.pair.toLowerCase() === pair.toLowerCase());

    if (!market) {
      return res.status(404).json({
        ok: false,
        error: "market_not_found",
        message: `Market pair ${pair} not found`
      });
    }

    res.json({ ok: true, market });
  } catch (err) {
    error("❌ Error fetching market:", err);
    res.status(500).json({ 
      ok: false, 
      error: "market_fetch_failed"
    });
  }
});
