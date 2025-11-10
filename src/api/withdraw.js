import express from "express";
import { pool } from "../utils/db.js";

export const withdrawRouter = express.Router();

withdrawRouter.post("/", async (req, res) => {
  const { user_id, method, address, amount } = req.body || {};
  if (!user_id || !method || !amount) return res.status(400).json({ ok: false, error: "missing_data" });

  try {
    await pool.query(
      "INSERT INTO requests (user_id, method, address, amount, status) VALUES ($1,$2,$3,$4,'pending')",
      [user_id, method, address, amount]
    );
    res.json({ ok: true, message: "withdraw_requested" });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});
