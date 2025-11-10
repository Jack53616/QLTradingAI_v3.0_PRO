import express from "express";
import { log } from "../utils/logger.js";

export const bot = express.Router();

bot.post("/:token", (req, res) => {
  const { token } = req.params;
  if (token !== process.env.BOT_TOKEN) return res.status(401).send("invalid token");
  log("🤖 Telegram webhook received update");
  res.send("ok");
});
