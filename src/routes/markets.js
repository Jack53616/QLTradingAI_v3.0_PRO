import express from "express";
import { marketsService } from "../services/markets.js";

export const marketsRouter = express.Router();

marketsRouter.get("/", (_req, res) => {
  const snapshot = marketsService.snapshot();
  res.json({ success: true, data: snapshot });
});

export default marketsRouter;
