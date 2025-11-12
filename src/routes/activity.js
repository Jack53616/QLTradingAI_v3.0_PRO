import express from "express";
import { notificationService } from "../services/notifications.js";
import { authenticate, requireAdmin } from "../middleware/authenticate.js";

export const activityRouter = express.Router();

activityRouter.get("/feed", (req, res) => {
  const limit = Number(req.query.limit || 20);
  res.json({ success: true, data: { notifications: notificationService.all(limit) } });
});

activityRouter.post(
  "/broadcast",
  authenticate,
  requireAdmin,
  (req, res) => {
    const { name, asset, amount, type, message } = req.body || {};
    const notification = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: name || "Admin",
      asset: asset || "Broadcast",
      amount: amount != null ? Number(amount) : null,
      type: type || "info",
      message: message || "",
      createdAt: new Date().toISOString(),
      fake: false
    };

    notificationService.add(notification);
    res.status(201).json({ success: true, data: notification });
  }
);

activityRouter.get("/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const unsubscribe = notificationService.onBroadcast((payload) => {
    res.write(`data: ${payload}\n\n`);
  });

  req.on("close", () => {
    unsubscribe();
    res.end();
  });
});

export default activityRouter;
