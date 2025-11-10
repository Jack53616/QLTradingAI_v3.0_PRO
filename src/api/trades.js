import express from "express";
import { pool } from "../utils/db.js";

export const tradesRouter = express.Router();

tradesRouter.get("/:user_id", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM trades WHERE user_id = $1", [req.params.user_id]);
    res.json({ ok: true, trades: result.rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});
