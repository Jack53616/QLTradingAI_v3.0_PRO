import express from "express";
import { pool } from "../utils/db.js";

export const usersRouter = express.Router();

usersRouter.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT id, name, level, sub_expires FROM users");
    res.json({ ok: true, users: result.rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});
