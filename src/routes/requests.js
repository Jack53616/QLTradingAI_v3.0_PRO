import express from "express";
import { pool } from "../utils/db.js";

const router = express.Router();

router.get("/", async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }

  try {
    const { rows } = await pool.query(
      `SELECT id, method, amount, fee_rate, fee_amount, net_amount, status, admin_note, created_at, updated_at
       FROM requests
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [userId]
    );

    res.json({ ok: true, list: rows });
  } catch (err) {
    console.error("Requests fetch error:", err);
    res.status(500).json({ ok: false, error: "server_error" });
  }
});

export default router;
