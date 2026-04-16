import express from "express";
import { pool } from "../utils/db.js";

const router = express.Router();

router.get("/", async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, message: "unauthorized" });
  }

  try {
    const { rows } = await pool.query(
      `SELECT id, name, email, balance, sub_expires, is_banned, lang, created_at
       FROM users WHERE id = $1`,
      [userId]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: "user_not_found" });
    }

    const user = rows[0];
    res.json({
      success: true,
      wallet: {
        balance: Number(user.balance || 0),
        pnl_day: 0,
        pnl_month: 0,
        sub_expires: user.sub_expires,
        is_banned: user.is_banned,
      },
    });
  } catch (err) {
    console.error("Wallet fetch error:", err);
    res.status(500).json({ success: false, message: "server_error" });
  }
});

export default router;
