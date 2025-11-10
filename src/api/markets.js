import express from "express";
export const marketsRouter = express.Router();

marketsRouter.get("/", (req, res) => {
  res.json({
    ok: true,
    markets: [
      { pair: "BTC/USDT", price: 67350.12 },
      { pair: "ETH/USDT", price: 3421.88 },
      { pair: "XAU/USD", price: 2387.45 },
      { pair: "XAG/USD", price: 29.21 }
    ]
  });
});
