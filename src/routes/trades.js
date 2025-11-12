import express from "express";
import { pool } from "../utils/db.js";
import { marketsService } from "../services/markets.js";

export const tradesRouter = express.Router();

function mapTrade(row) {
  return {
    id: row.id,
    userId: row.user_id,
    symbol: row.symbol,
    side: row.side,
    amount: Number(row.amount),
    entryPrice: Number(row.entry_price),
    takeProfit: row.tp ? Number(row.tp) : null,
    stopLoss: row.sl ? Number(row.sl) : null,
    status: row.status,
    result: row.result != null ? Number(row.result) : null,
    profit: row.profit != null ? Number(row.profit) : null,
    openedAt: row.opened_at,
    closedAt: row.closed_at,
    closedPrice: row.closed_price ? Number(row.closed_price) : null
  };
}

async function findTrade(id, userId) {
  const result = await pool.query(
    "SELECT * FROM trades WHERE id = $1 AND user_id = $2",
    [id, userId]
  );
  return result.rows[0] || null;
}

tradesRouter.get("/", async (req, res, next) => {
  try {
    const result = await pool.query(
      "SELECT * FROM trades WHERE user_id = $1 ORDER BY opened_at DESC",
      [req.user.id]
    );

    res.json({ success: true, data: result.rows.map(mapTrade) });
  } catch (error) {
    next(error);
  }
});

tradesRouter.get("/open", async (req, res, next) => {
  try {
    const result = await pool.query(
      "SELECT * FROM trades WHERE user_id = $1 AND status = 'open' ORDER BY opened_at DESC",
      [req.user.id]
    );

    res.json({ success: true, data: result.rows.map(mapTrade) });
  } catch (error) {
    next(error);
  }
});

tradesRouter.post("/", async (req, res, next) => {
  try {
    const { symbol, side, amount, takeProfit, stopLoss } = req.body || {};

    if (!symbol || !side || !amount) {
      return res.status(400).json({ success: false, message: "missing_trade_data" });
    }

    if (!["buy", "sell"].includes(side.toLowerCase())) {
      return res.status(400).json({ success: false, message: "invalid_side" });
    }

    const normalizedSide = side.toLowerCase();
    const normalizedSymbol = symbol.toUpperCase();
    const currentPrice = marketsService.priceForSymbol(normalizedSymbol) ?? Number(req.body.entryPrice || 0);

    if (!currentPrice || Number.isNaN(currentPrice)) {
      return res.status(400).json({ success: false, message: "price_unavailable" });
    }

    const insert = await pool.query(
      `INSERT INTO trades (user_id, symbol, side, amount, entry_price, tp, sl, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'open')
       RETURNING *`,
      [req.user.id, normalizedSymbol, normalizedSide, amount, currentPrice, takeProfit, stopLoss]
    );

    res.status(201).json({ success: true, data: mapTrade(insert.rows[0]) });
  } catch (error) {
    next(error);
  }
});

tradesRouter.post("/:id/close", async (req, res, next) => {
  try {
    const tradeId = Number(req.params.id);
    const trade = await findTrade(tradeId, req.user.id);

    if (!trade) {
      return res.status(404).json({ success: false, message: "trade_not_found" });
    }

    if (trade.status !== "open") {
      return res.status(400).json({ success: false, message: "trade_already_closed" });
    }

    const marketPrice = marketsService.priceForSymbol(trade.symbol) ?? Number(req.body.closePrice || trade.entry_price);
    const closePrice = Number(marketPrice);

    if (!closePrice || Number.isNaN(closePrice)) {
      return res.status(400).json({ success: false, message: "price_unavailable" });
    }

    const direction = trade.side === "buy" ? 1 : -1;
    const priceDiff = closePrice - Number(trade.entry_price);
    const result = direction * priceDiff;
    const profit = Number((result * Number(trade.amount)).toFixed(2));

    const update = await pool.query(
      `UPDATE trades
          SET status = 'closed',
              closed_at = NOW(),
              result = $1,
              profit = $2,
              closed_price = $3
        WHERE id = $4
        RETURNING *`,
      [result, profit, closePrice, tradeId]
    );

    await pool.query(
      "UPDATE users SET balance = balance + $1 WHERE id = $2",
      [profit, req.user.id]
    );

    res.json({ success: true, data: mapTrade(update.rows[0]) });
  } catch (error) {
    next(error);
  }
});

export default tradesRouter;
