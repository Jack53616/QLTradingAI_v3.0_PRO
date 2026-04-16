import { pool } from "../utils/db.js";
import { log, warn, error } from "../utils/logger.js";
import { isPositiveNumber, sleep } from "../utils/helpers.js";
import { marketsService } from "../services/markets.js";
import { notificationService } from "../services/notifications.js";

const adminIds = new Set(
  (process.env.TELEGRAM_ADMINS || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .map((id) => Number(id))
    .filter((id) => !Number.isNaN(id))
);

const WITHDRAWAL_FEE_PERCENT = Number(process.env.WITHDRAWAL_FEE_PERCENT || 5);

let botInstance = null;
let startPromise = null;
const adminCache = new Map();

let banCheckInterval = null;

export async function startTelegramBot() {
  if (botInstance) {
    return botInstance;
  }

  if (startPromise) {
    return startPromise;
  }

  const token = process.env.BOT_TOKEN;
  if (!token) {
    warn("BOT_TOKEN missing. Telegram bot will not start.");
    return null;
  }

  startPromise = (async () => {
    let BotConstructor;
    try {
      const imported = await import("node-telegram-bot-api");
      BotConstructor = imported.default || imported.TelegramBot || imported;
    } catch (err) {
      warn("node-telegram-bot-api dependency unavailable. Telegram bot disabled.", {
        error: err?.message || err,
      });
      startPromise = null;
      return null;
    }

    const instance = new BotConstructor(token, { polling: false, filepath: false });
    
    instance.on("message", (message) => {
      if (!message?.text) return;
      handleMessage(message).catch((err) => {
        error("Telegram command failure", {
          command: message.text,
          chatId: message.chat?.id,
          error: err?.message || err,
        });
        sendMessage(message.chat.id, "Failed to process your command.");
      });
    });

    instance.on("callback_query", (query) => {
      handleCallbackQuery(query).catch((err) => {
        error("Callback query failure", {
          data: query.data,
          chatId: query.message?.chat?.id,
          error: err?.message || err,
        });
      });
    });

    botInstance = instance;
    log("Telegram bot initialized (webhook mode)");

    startBanExpiryChecker();

    return instance;
  })();

  return startPromise;
}

function startBanExpiryChecker() {
  if (banCheckInterval) return;
  banCheckInterval = setInterval(async () => {
    try {
      const { rows } = await pool.query(
        `UPDATE users
            SET is_banned = false, ban_expires = NULL, ban_reason = NULL, updated_at = NOW()
          WHERE is_banned = true
            AND ban_expires IS NOT NULL
            AND ban_expires <= NOW()
          RETURNING id, tg_id, name`
      );
      for (const user of rows) {
        log("Auto-unban expired", { userId: user.id, name: user.name });
        await notifyUser(user, "Your account ban has expired. Your account is now active again.");
      }
    } catch (err) {
      error("Ban expiry check failed", { error: err?.message });
    }
  }, 60_000);
}

function isAdmin(chatId) {
  return adminIds.has(Number(chatId));
}

function extractArgs(text) {
  return text.trim().split(/\s+/).filter(Boolean);
}

async function handleCallbackQuery(query) {
  const chatId = query.message?.chat?.id;
  const data = query.data;
  if (!chatId || !data) return;

  if (botInstance) {
    try { await botInstance.answerCallbackQuery(query.id); } catch {}
  }

  if (data.startsWith("approve_transfer_")) {
    if (!isAdmin(chatId)) return;
    const transferId = Number(data.replace("approve_transfer_", ""));
    await processTransferDecision(chatId, transferId, "approved");
  } else if (data.startsWith("reject_transfer_")) {
    if (!isAdmin(chatId)) return;
    const transferId = Number(data.replace("reject_transfer_", ""));
    await processTransferDecision(chatId, transferId, "rejected");
  }
}

async function processTransferDecision(chatId, transferId, decision) {
  const { rows } = await pool.query(
    `SELECT t.*, su.name AS sender_name, su.tg_id AS sender_tg, ru.name AS receiver_name, ru.tg_id AS receiver_tg
       FROM transfers t
       JOIN users su ON su.id = t.sender_id
       JOIN users ru ON ru.id = t.receiver_id
      WHERE t.id = $1 AND t.status = 'pending'`,
    [transferId]
  );

  if (!rows.length) {
    await sendMessage(chatId, "This transfer request was already processed or not found.");
    return;
  }

  const transfer = rows[0];

  if (decision === "approved") {
    try {
      await pool.query("BEGIN");
      await pool.query(
        `UPDATE users SET balance = balance + $1, updated_at = NOW() WHERE id = $2`,
        [transfer.amount, transfer.receiver_id]
      );
      await pool.query(
        `UPDATE transfers SET status = 'approved', processed_at = NOW() WHERE id = $1`,
        [transferId]
      );
      await pool.query("COMMIT");

      await logAdminAction(chatId, transfer.sender_id, "transfer_approved", {
        transferId, amount: Number(transfer.amount), receiverId: transfer.receiver_id,
      });

      await sendMessage(chatId,
        `Transfer #${transferId} approved.\n` +
        `$${Number(transfer.amount).toFixed(2)} transferred from ${transfer.sender_name || transfer.sender_id} to ${transfer.receiver_name || transfer.receiver_id}.`
      );

      if (transfer.sender_tg) {
        await notifyUser({ tg_id: transfer.sender_tg },
          `Your transfer of $${Number(transfer.amount).toFixed(2)} to ${transfer.receiver_name || "user"} has been approved.`
        );
      }
      if (transfer.receiver_tg) {
        await notifyUser({ tg_id: transfer.receiver_tg },
          `You received $${Number(transfer.amount).toFixed(2)} from ${transfer.sender_name || "a user"}.`
        );
      }
    } catch (err) {
      await pool.query("ROLLBACK");
      await sendMessage(chatId, `Failed to approve transfer: ${err.message}`);
    }
  } else {
    await pool.query(
      `UPDATE transfers SET status = 'rejected', reason = 'Admin rejected', processed_at = NOW() WHERE id = $1`,
      [transferId]
    );
    await pool.query(
      `UPDATE users SET balance = balance + $1, updated_at = NOW() WHERE id = $2`,
      [transfer.amount, transfer.sender_id]
    );

    await logAdminAction(chatId, transfer.sender_id, "transfer_rejected", {
      transferId, amount: Number(transfer.amount), receiverId: transfer.receiver_id,
    });

    await sendMessage(chatId,
      `Transfer #${transferId} rejected. $${Number(transfer.amount).toFixed(2)} returned to ${transfer.sender_name || transfer.sender_id}.`
    );

    if (transfer.sender_tg) {
      await notifyUser({ tg_id: transfer.sender_tg },
        `Your transfer of $${Number(transfer.amount).toFixed(2)} has been rejected. The amount has been returned to your balance.`
      );
    }
  }
}

async function handleMessage(message) {
  const chatId = message.chat.id;
  const text = message.text.trim();

  if (!text.startsWith("/")) {
    return;
  }

  const lower = text.toLowerCase();

  if (lower === "/start") {
    const keyboard = {
      reply_markup: {
        inline_keyboard: [
          [{ text: "Open QL Wallet", url: `https://t.me/${process.env.BOT_USERNAME || "QLWalletBot"}?startapp` }],
          [{ text: "Support / WhatsApp", url: "https://wa.me/message/P6BBPSDL2CC4D1" }],
        ],
      },
      parse_mode: "Markdown",
    };

    await sendMessage(
      chatId,
      `*Welcome to QL Trading AI*\n\n` +
      `Automated trading assistance for your account.\n\n` +
      `*What you can do:*\n` +
      `  Monitor your balance & trades\n` +
      `  Request withdrawals\n` +
      `  Transfer funds to other users\n` +
      `  24/7 support\n\n` +
      `Use the button below to open your wallet:`,
      keyboard
    );
    return;
  }

  if (lower === "/help") {
    if (!isAdmin(chatId)) {
      await sendMessage(chatId,
        "*Available Commands*\n\n" +
        "/start - Open your wallet\n" +
        "/balance - Check your balance\n" +
        "/transfer <user_id> <amount> - Transfer funds\n" +
        "/mytransfers - View transfer history\n" +
        "/status - Check account status\n" +
        "/support - Contact support",
        { parse_mode: "Markdown" }
      );
      return;
    }

    const adminHelp =
      "*Admin Commands*\n\n" +
      "*User Management:*\n" +
      "/add <id> <amount> - Add balance to user\n" +
      "/take <id> <amount> - Remove balance silently\n" +
      "/sub <id> <days> - Extend subscription\n" +
      "/verify <id> - Mark user verified\n" +
      "/lock <id> / /unlock <id> - Freeze or restore wallet\n" +
      "/ban <id> [duration] - Ban user (1h/1d/1w/1m or permanent)\n" +
      "/unban <id> - Restore account\n\n" +
      "*Trading:*\n" +
      "/trade <id> <amount> <tp> <sl> [symbol] [buy/sell]\n" +
      "/daily <amount> <duration> - Daily profit for all users\n\n" +
      "*Communication:*\n" +
      "/msg <id> <text> - Direct message user\n" +
      "/msgall <text> - Broadcast to all active users\n\n" +
      "*Transfers:*\n" +
      "/transfers - View pending transfer requests\n" +
      "/approvetransfer <id> - Approve transfer\n" +
      "/rejecttransfer <id> - Reject transfer\n\n" +
      "*System:*\n" +
      "/report - Platform summary\n" +
      "/genkey <days> - Generate activation key\n" +
      "/audit - Show last admin actions\n" +
      "/reload - Reload market streams\n" +
      "/cleanlogs - Remove old logs\n" +
      "/fakepush - Trigger fake notification";

    await sendMessage(chatId, adminHelp, { parse_mode: "Markdown" });
    return;
  }

  if (lower === "/balance") {
    await handleUserBalance(chatId);
    return;
  }

  if (lower.startsWith("/transfer ")) {
    await handleUserTransfer(chatId, text);
    return;
  }

  if (lower === "/mytransfers") {
    await handleMyTransfers(chatId);
    return;
  }

  if (lower === "/status") {
    await handleUserStatus(chatId);
    return;
  }

  if (lower === "/support") {
    await sendMessage(chatId,
      "*Support Center*\n\n" +
      "WhatsApp: [Open Chat](https://wa.me/message/P6BBPSDL2CC4D1)\n" +
      "Telegram: @QL\\_Support",
      { parse_mode: "Markdown", disable_web_page_preview: true }
    );
    return;
  }

  if (!isAdmin(chatId)) {
    await sendMessage(chatId, "Use /help to see available commands.");
    return;
  }

  const [command] = extractArgs(lower);

  switch (command) {
    case "/add":
      await handleAddBalance(chatId, text);
      break;
    case "/take":
      await handleTakeBalance(chatId, text);
      break;
    case "/trade":
      await handleTrade(chatId, text);
      break;
    case "/daily":
      await handleDaily(chatId, text);
      break;
    case "/sub":
      await handleSubscription(chatId, text);
      break;
    case "/lock":
      await handleStatusUpdate(chatId, text, "frozen", "Wallet locked.", "/lock");
      break;
    case "/unlock":
      await handleStatusUpdate(chatId, text, "active", "Wallet unlocked.", "/unlock");
      break;
    case "/ban":
      await handleBan(chatId, text);
      break;
    case "/unban":
      await handleUnban(chatId, text);
      break;
    case "/msg":
      await handleDirectMessage(chatId, text);
      break;
    case "/msgall":
      await handleBroadcast(chatId, text);
      break;
    case "/report":
      await handleReport(chatId);
      break;
    case "/reload":
      await handleReload(chatId);
      break;
    case "/fakepush":
      await handleFakeNotification(chatId);
      break;
    case "/cleanlogs":
      await handleCleanLogs(chatId);
      break;
    case "/audit":
      await handleAudit(chatId);
      break;
    case "/verify":
      await handleVerify(chatId, text);
      break;
    case "/genkey":
      await handleGenKey(chatId, text);
      break;
    case "/transfers":
      await handleAdminTransfers(chatId);
      break;
    case "/approvetransfer":
      await handleApproveTransfer(chatId, text);
      break;
    case "/rejecttransfer":
      await handleRejectTransfer(chatId, text);
      break;
    default:
      await sendMessage(chatId, "Unknown command. Use /help for the list of commands.");
  }
}

async function handleUserBalance(chatId) {
  const user = await findUserByTgId(chatId);
  if (!user) {
    await sendMessage(chatId, "You don't have an account yet. Please activate your key first.");
    return;
  }
  const balance = Number(user.balance || 0);
  const subExpires = user.sub_expires ? new Date(user.sub_expires).toLocaleDateString() : "N/A";
  const statusLabel = user.is_banned ? "Banned" : "Active";
  await sendMessage(chatId,
    `*Your Account*\n\n` +
    `Balance: *$${balance.toFixed(2)}*\n` +
    `Subscription Expires: ${subExpires}\n` +
    `Status: ${statusLabel}`,
    { parse_mode: "Markdown" }
  );
}

async function handleUserTransfer(chatId, text) {
  const args = extractArgs(text);
  if (args.length < 3) {
    await sendMessage(chatId, "*Transfer Funds*\n\nUsage: /transfer <user\\_id> <amount>\n\nExample: /transfer 12345 100", { parse_mode: "Markdown" });
    return;
  }

  const sender = await findUserByTgId(chatId);
  if (!sender) {
    await sendMessage(chatId, "You don't have an account yet.");
    return;
  }

  if (sender.is_banned) {
    await sendMessage(chatId, "Your account is restricted. You cannot make transfers.");
    return;
  }

  const receiverIdentifier = args[1];
  const amount = Number(args[2]);

  if (!Number.isFinite(amount) || amount <= 0) {
    await sendMessage(chatId, "Amount must be a positive number.");
    return;
  }

  if (amount < 1) {
    await sendMessage(chatId, "Minimum transfer amount is $1.00.");
    return;
  }

  const receiver = await findUser(receiverIdentifier);
  if (!receiver) {
    await sendMessage(chatId, "Recipient user not found. Please check the ID.");
    return;
  }

  if (receiver.id === sender.id) {
    await sendMessage(chatId, "You cannot transfer to yourself.");
    return;
  }

  if (receiver.is_banned) {
    await sendMessage(chatId, "Cannot transfer to a banned user.");
    return;
  }

  const senderBalance = Number(sender.balance || 0);
  if (senderBalance < amount) {
    await sendMessage(chatId, `Insufficient balance. Your balance: $${senderBalance.toFixed(2)}`);
    return;
  }

  try {
    await pool.query("BEGIN");

    const { rows: updateRows } = await pool.query(
      `UPDATE users SET balance = balance - $1, updated_at = NOW()
       WHERE id = $2 AND balance >= $1
       RETURNING balance`,
      [amount, sender.id]
    );

    if (!updateRows.length) {
      await pool.query("ROLLBACK");
      await sendMessage(chatId, "Insufficient balance for this transfer.");
      return;
    }

    const { rows: transferRows } = await pool.query(
      `INSERT INTO transfers (sender_id, receiver_id, amount, status)
       VALUES ($1, $2, $3, 'pending')
       RETURNING id, created_at`,
      [sender.id, receiver.id, amount]
    );

    await pool.query("COMMIT");

    const transferId = transferRows[0].id;

    await sendMessage(chatId,
      `*Transfer Request Submitted*\n\n` +
      `Transfer ID: #${transferId}\n` +
      `To: ${receiver.name || receiver.email || receiver.id}\n` +
      `Amount: $${amount.toFixed(2)}\n` +
      `Status: Pending review\n\n` +
      `The amount has been reserved from your balance. You will be notified once the admin reviews your request.`,
      { parse_mode: "Markdown" }
    );

    for (const adminId of adminIds) {
      await sendMessage(adminId,
        `*New Transfer Request #${transferId}*\n\n` +
        `From: ${sender.name || sender.tg_id} (ID: ${sender.id})\n` +
        `To: ${receiver.name || receiver.tg_id} (ID: ${receiver.id})\n` +
        `Amount: $${amount.toFixed(2)}\n\n` +
        `Use the buttons below or commands:\n` +
        `/approvetransfer ${transferId}\n` +
        `/rejecttransfer ${transferId}`,
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [
                { text: "Approve", callback_data: `approve_transfer_${transferId}` },
                { text: "Reject", callback_data: `reject_transfer_${transferId}` },
              ],
            ],
          },
        }
      );
    }
  } catch (err) {
    await pool.query("ROLLBACK");
    await sendMessage(chatId, "Failed to process transfer. Please try again.");
    error("Transfer error", { error: err?.message });
  }
}

async function handleMyTransfers(chatId) {
  const user = await findUserByTgId(chatId);
  if (!user) {
    await sendMessage(chatId, "You don't have an account yet.");
    return;
  }

  const { rows } = await pool.query(
    `SELECT t.id, t.amount, t.status, t.created_at,
            CASE WHEN t.sender_id = $1 THEN 'sent' ELSE 'received' END AS direction,
            CASE WHEN t.sender_id = $1 THEN ru.name ELSE su.name END AS other_name
       FROM transfers t
       JOIN users su ON su.id = t.sender_id
       JOIN users ru ON ru.id = t.receiver_id
      WHERE t.sender_id = $1 OR t.receiver_id = $1
      ORDER BY t.created_at DESC
      LIMIT 10`,
    [user.id]
  );

  if (!rows.length) {
    await sendMessage(chatId, "No transfers found.");
    return;
  }

  const statusIcons = { pending: "Pending", approved: "Approved", rejected: "Rejected" };
  const lines = rows.map((t) => {
    const dir = t.direction === "sent" ? "Sent to" : "Received from";
    const date = new Date(t.created_at).toLocaleDateString();
    return `#${t.id} | ${dir} ${t.other_name || "N/A"} | $${Number(t.amount).toFixed(2)} | ${statusIcons[t.status] || t.status} | ${date}`;
  });

  await sendMessage(chatId,
    `*Your Transfers*\n\n${lines.join("\n")}`,
    { parse_mode: "Markdown" }
  );
}

async function handleUserStatus(chatId) {
  const user = await findUserByTgId(chatId);
  if (!user) {
    await sendMessage(chatId, "You don't have an account yet.");
    return;
  }
  const statusLabel = user.is_banned ? "Banned" : "Active";
  let banInfo = "";
  if (user.is_banned && user.ban_expires) {
    banInfo = `\nBan expires: ${new Date(user.ban_expires).toLocaleString()}`;
  }
  await sendMessage(chatId,
    `*Account Status*\n\n` +
    `Name: ${user.name || "N/A"}\n` +
    `Status: ${statusLabel}${banInfo}\n` +
    `Balance: $${Number(user.balance || 0).toFixed(2)}`,
    { parse_mode: "Markdown" }
  );
}

async function handleAddBalance(chatId, text) {
  const args = extractArgs(text);
  if (args.length < 3) {
    await sendMessage(chatId, "*Usage:* /add <user\\_id> <amount>", { parse_mode: "Markdown" });
    return;
  }

  const identifier = args[1];
  const amount = Number(args[2]);

  if (!Number.isFinite(amount)) {
    await sendMessage(chatId, "Amount must be a number.");
    return;
  }

  const user = await findUser(identifier);
  if (!user) {
    await sendMessage(chatId, "User not found.");
    return;
  }

  const result = await pool.query(
    `UPDATE users
        SET balance = balance + $1,
            updated_at = NOW()
      WHERE id = $2
      RETURNING balance`,
    [amount, user.id]
  );

  await logAdminAction(chatId, user.id, "balance_add", { amount });

  const newBalance = Number(result.rows[0].balance);
  await sendMessage(chatId,
    `*Balance Updated*\n\n` +
    `User: ${formatUserLabel(user)} (ID: ${user.id})\n` +
    `Added: +$${amount.toFixed(2)}\n` +
    `New Balance: $${newBalance.toFixed(2)}`,
    { parse_mode: "Markdown" }
  );
  await notifyUser(user, `A balance adjustment of $${amount.toFixed(2)} was added to your wallet.\n\nNew balance: $${newBalance.toFixed(2)}`);
}

async function handleTakeBalance(chatId, text) {
  const args = extractArgs(text);
  if (args.length < 3) {
    await sendMessage(chatId, "*Usage:* /take <user\\_id> <amount>", { parse_mode: "Markdown" });
    return;
  }

  const identifier = args[1];
  const amount = Number(args[2]);

  if (!Number.isFinite(amount)) {
    await sendMessage(chatId, "Amount must be a number.");
    return;
  }

  const user = await findUser(identifier);
  if (!user) {
    await sendMessage(chatId, "User not found.");
    return;
  }

  const result = await pool.query(
    `UPDATE users
        SET balance = balance - $1,
            updated_at = NOW()
      WHERE id = $2
      RETURNING balance`,
    [amount, user.id]
  );

  await logAdminAction(chatId, user.id, "balance_remove", { amount });
  const newBalance = Number(result.rows[0].balance);
  await sendMessage(chatId,
    `*Balance Deducted*\n\n` +
    `User: ${formatUserLabel(user)} (ID: ${user.id})\n` +
    `Removed: -$${amount.toFixed(2)}\n` +
    `New Balance: $${newBalance.toFixed(2)}`,
    { parse_mode: "Markdown" }
  );
}

async function handleTrade(chatId, text) {
  const args = extractArgs(text);
  if (args.length < 5) {
    await sendMessage(chatId, "*Usage:* /trade <user\\_id> <amount> <tp> <sl> [symbol] [buy|sell]", { parse_mode: "Markdown" });
    return;
  }

  const identifier = args[1];
  const amount = Number(args[2]);
  const tp = Number(args[3]);
  const sl = Number(args[4]);
  const symbol = (args[5] || "BTCUSDT").toUpperCase();
  const side = (args[6] || "buy").toLowerCase() === "sell" ? "sell" : "buy";

  if (!isPositiveNumber(amount)) {
    await sendMessage(chatId, "Amount must be a positive number.");
    return;
  }

  if (!Number.isFinite(tp) || !Number.isFinite(sl)) {
    await sendMessage(chatId, "Take profit and stop loss must be numeric values.");
    return;
  }

  const user = await findUser(identifier);
  if (!user) {
    await sendMessage(chatId, "User not found.");
    return;
  }

  const marketPrice = marketsService.priceForSymbol(symbol);
  const entryPrice = Number(
    Number.isFinite(marketPrice)
      ? marketPrice
      : Number.isFinite(tp) && Number.isFinite(sl)
      ? (tp + sl) / 2
      : amount
  );

  const result = await pool.query(
    `INSERT INTO trades (user_id, symbol, side, amount, entry_price, tp, sl, status, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'open', $8)
     RETURNING id`,
    [user.id, symbol, side, amount, entryPrice, tp, sl, { source: "telegram_bot", adminChatId: chatId }]
  );

  const tradeId = result.rows[0]?.id;

  await logAdminAction(chatId, user.id, "trade_open", {
    tradeId, amount, tp, sl, symbol, side,
  });

  await sendMessage(chatId,
    `*Trade Opened*\n\n` +
    `Trade ID: #${tradeId}\n` +
    `User: ${formatUserLabel(user)}\n` +
    `Symbol: ${symbol} | Side: ${side.toUpperCase()}\n` +
    `Amount: $${amount.toFixed(2)}\n` +
    `Entry: ${entryPrice}\n` +
    `TP: ${tp} | SL: ${sl}`,
    { parse_mode: "Markdown" }
  );
  await notifyUser(
    user,
    `A new ${symbol} trade has been opened for you.\n\nAmount: $${amount.toFixed(2)}\nSide: ${side.toUpperCase()}\nTP: ${tp} | SL: ${sl}`
  );
}

async function handleDaily(chatId, text) {
  const args = extractArgs(text);
  if (args.length < 3) {
    await sendMessage(chatId, "*Usage:* /daily <amount> <duration>", { parse_mode: "Markdown" });
    return;
  }

  const profit = Number(args[1]);
  const duration = args[2];

  if (!isPositiveNumber(profit)) {
    await sendMessage(chatId, "Profit amount must be positive.");
    return;
  }

  const { rows: users } = await pool.query(
    "SELECT id, tg_id, name, email FROM users WHERE is_banned = false"
  );

  if (!users.length) {
    await sendMessage(chatId, "No active users to update.");
    return;
  }

  const entryPrice = marketsService.priceForSymbol("BTCUSDT") || 1;

  try {
    await pool.query("BEGIN");

    for (const user of users) {
      await pool.query(
        `UPDATE users
            SET balance = balance + $1,
                updated_at = NOW()
          WHERE id = $2`,
        [profit, user.id]
      );

      await pool.query(
        `INSERT INTO trades (user_id, symbol, side, amount, entry_price, tp, sl, status, profit, closed_price, opened_at, closed_at, metadata)
         VALUES ($1, $2, 'buy', $3, $4, NULL, NULL, 'closed', $5, $4, NOW(), NOW(), $6)`,
        [
          user.id, "BTCUSDT", profit, entryPrice, profit,
          { source: "telegram_bot", type: "daily", duration, adminChatId: chatId },
        ]
      );
    }

    await pool.query("COMMIT");
  } catch (err) {
    await pool.query("ROLLBACK");
    throw err;
  }

  await logAdminAction(chatId, null, "daily_trade", {
    amount: profit, duration, affectedUsers: users.length,
  });

  await sendMessage(chatId,
    `*Daily Profit Applied*\n\n` +
    `Amount: $${profit.toFixed(2)}\n` +
    `Duration: ${duration}\n` +
    `Users affected: ${users.length}`,
    { parse_mode: "Markdown" }
  );

  for (const user of users) {
    await notifyUser(
      user,
      `Daily session completed: $${profit.toFixed(2)} added to your wallet (${duration}).`
    );
    await sleep(75);
  }
}

async function handleSubscription(chatId, text) {
  const args = extractArgs(text);
  if (args.length < 3) {
    await sendMessage(chatId, "*Usage:* /sub <user\\_id> <days>", { parse_mode: "Markdown" });
    return;
  }

  const identifier = args[1];
  const days = Number(args[2]);

  if (!Number.isFinite(days) || days <= 0) {
    await sendMessage(chatId, "Days must be a positive number.");
    return;
  }

  const user = await findUser(identifier);
  if (!user) {
    await sendMessage(chatId, "User not found.");
    return;
  }

  const result = await pool.query(
    `UPDATE users
        SET sub_expires = COALESCE(sub_expires, NOW()) + ($1 || ' days')::interval,
            updated_at = NOW()
      WHERE id = $2
      RETURNING sub_expires`,
    [days, user.id]
  );

  await logAdminAction(chatId, user.id, "subscription_extend", { days });

  const updated = result.rows[0];
  await sendMessage(chatId,
    `*Subscription Extended*\n\n` +
    `User: ${formatUserLabel(user)} (ID: ${user.id})\n` +
    `Added: ${days} days\n` +
    `Expires: ${new Date(updated.sub_expires).toLocaleString()}`,
    { parse_mode: "Markdown" }
  );

  await notifyUser(
    user,
    `Your subscription has been extended by ${days} days.\n\nNew expiry: ${new Date(updated.sub_expires).toLocaleString()}.`
  );
}

async function handleStatusUpdate(chatId, text, status, confirmation, commandLabel) {
  const args = extractArgs(text);
  if (args.length < 2) {
    const label = commandLabel || args[0] || "/command";
    await sendMessage(chatId, `*Usage:* ${label} <user\\_id>`, { parse_mode: "Markdown" });
    return;
  }

  const identifier = args[1];
  const user = await findUser(identifier);
  if (!user) {
    await sendMessage(chatId, "User not found.");
    return;
  }

  const isBanned = status === "banned";
  await pool.query(
    `UPDATE users SET is_banned = $1, ban_expires = NULL, ban_reason = NULL, updated_at = NOW() WHERE id = $2`,
    [isBanned, user.id]
  );

  await logAdminAction(chatId, user.id, `status_${status}`, {});

  await sendMessage(chatId,
    `*Status Updated*\n\n` +
    `User: ${formatUserLabel(user)} (ID: ${user.id})\n` +
    `New Status: ${status}\n` +
    `${confirmation}`,
    { parse_mode: "Markdown" }
  );

  if (status === "active") {
    await notifyUser(user, "Your account access has been restored.");
  } else if (status === "frozen") {
    await notifyUser(user, "Your wallet has been temporarily frozen. Contact support for details.");
  }
}

async function handleBan(chatId, text) {
  const args = extractArgs(text);
  if (args.length < 2) {
    await sendMessage(chatId,
      "*Usage:* /ban <user\\_id> [duration]\n\n" +
      "*Duration examples:*\n" +
      "  1h = 1 hour\n" +
      "  1d = 1 day\n" +
      "  1w = 1 week\n" +
      "  1m = 1 month\n" +
      "  (no duration = permanent ban)",
      { parse_mode: "Markdown" }
    );
    return;
  }

  const identifier = args[1];
  const durationStr = args[2] || null;

  const user = await findUser(identifier);
  if (!user) {
    await sendMessage(chatId, "User not found.");
    return;
  }

  let banExpires = null;
  let durationLabel = "Permanent";

  if (durationStr) {
    const match = durationStr.match(/^(\d+)([hdwm])$/i);
    if (!match) {
      await sendMessage(chatId, "Invalid duration format. Use: 1h, 2d, 1w, 1m");
      return;
    }

    const value = Number(match[1]);
    const unit = match[2].toLowerCase();
    const now = new Date();

    switch (unit) {
      case "h":
        banExpires = new Date(now.getTime() + value * 60 * 60 * 1000);
        durationLabel = `${value} hour${value > 1 ? "s" : ""}`;
        break;
      case "d":
        banExpires = new Date(now.getTime() + value * 24 * 60 * 60 * 1000);
        durationLabel = `${value} day${value > 1 ? "s" : ""}`;
        break;
      case "w":
        banExpires = new Date(now.getTime() + value * 7 * 24 * 60 * 60 * 1000);
        durationLabel = `${value} week${value > 1 ? "s" : ""}`;
        break;
      case "m":
        banExpires = new Date(now.getTime() + value * 30 * 24 * 60 * 60 * 1000);
        durationLabel = `${value} month${value > 1 ? "s" : ""}`;
        break;
    }
  }

  await pool.query(
    `UPDATE users SET is_banned = true, ban_expires = $1, ban_reason = $2, banned_at = NOW(), updated_at = NOW() WHERE id = $3`,
    [banExpires, `Banned (${durationLabel})`, user.id]
  );

  await logAdminAction(chatId, user.id, "user_banned", { duration: durationLabel, banExpires });

  let expiryInfo = "";
  if (banExpires) {
    expiryInfo = `\nExpires: ${banExpires.toLocaleString()}\n\n_Account will be automatically restored when the ban expires._`;
  }

  await sendMessage(chatId,
    `*User Banned*\n\n` +
    `User: ${formatUserLabel(user)} (ID: ${user.id})\n` +
    `Duration: ${durationLabel}${expiryInfo}`,
    { parse_mode: "Markdown" }
  );

  let userMsg = "Your account has been restricted.";
  if (banExpires) {
    userMsg += `\n\nDuration: ${durationLabel}\nExpires: ${banExpires.toLocaleString()}`;
  }
  userMsg += "\n\nContact support for assistance.";
  await notifyUser(user, userMsg);
}

async function handleUnban(chatId, text) {
  const args = extractArgs(text);
  if (args.length < 2) {
    await sendMessage(chatId, "*Usage:* /unban <user\\_id>", { parse_mode: "Markdown" });
    return;
  }

  const identifier = args[1];
  const user = await findUser(identifier);
  if (!user) {
    await sendMessage(chatId, "User not found.");
    return;
  }

  await pool.query(
    `UPDATE users SET is_banned = false, ban_expires = NULL, ban_reason = NULL, updated_at = NOW() WHERE id = $1`,
    [user.id]
  );

  await logAdminAction(chatId, user.id, "user_unbanned", { from: "unban" });

  await sendMessage(chatId,
    `*User Unbanned*\n\n` +
    `User: ${formatUserLabel(user)} (ID: ${user.id})\n` +
    `Status: Active`,
    { parse_mode: "Markdown" }
  );

  await notifyUser(user, "Your account has been restored. You can now use all features.");
}

async function handleDirectMessage(chatId, text) {
  const match = text.match(/^\/msg\s+(\S+)\s+([\s\S]+)/i);
  if (!match) {
    await sendMessage(chatId, "*Usage:* /msg <user\\_id> <message>", { parse_mode: "Markdown" });
    return;
  }

  const [, identifier, body] = match;
  const user = await findUser(identifier);
  if (!user) {
    await sendMessage(chatId, "User not found.");
    return;
  }

  await notifyUser(user, body.trim());
  await logAdminAction(chatId, user.id, "direct_message", { message: body.trim().slice(0, 200) });
  await sendMessage(chatId, `Message delivered to ${formatUserLabel(user)}.`);
}

async function handleBroadcast(chatId, text) {
  const message = text.replace(/^\/msgall\s+/i, "").trim();
  if (!message) {
    await sendMessage(chatId, "*Usage:* /msgall <message>", { parse_mode: "Markdown" });
    return;
  }

  const { rows } = await pool.query(
    `SELECT COALESCE(tg_id, id) AS chat_id FROM users WHERE is_banned = false`
  );

  if (!rows.length) {
    await sendMessage(chatId, "No active users to broadcast.");
    return;
  }

  let sent = 0;
  let failed = 0;
  for (const row of rows) {
    const id = row.chat_id;
    if (!id) {
      failed++;
      continue;
    }
    try {
      await sendMessage(id, `${message}`);
      sent++;
      await sleep(75);
    } catch {
      failed++;
    }
  }

  await logAdminAction(chatId, null, "broadcast", { message: message.slice(0, 200), sent, failed });
  await sendMessage(chatId,
    `*Broadcast Complete*\n\nSent: ${sent}\nFailed: ${failed}`,
    { parse_mode: "Markdown" }
  );
}

async function handleReport(chatId) {
  const { rows } = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM users) AS total_users,
      (SELECT COUNT(*) FROM users WHERE is_banned = false) AS active_users,
      (SELECT COUNT(*) FROM users WHERE is_banned = true) AS banned_users,
      (SELECT COUNT(*) FROM trades) AS total_trades,
      (SELECT COUNT(*) FROM trades WHERE status = 'open') AS open_trades,
      (SELECT COALESCE(SUM(balance), 0) FROM users) AS total_balance,
      (SELECT COUNT(*) FROM requests WHERE status = 'pending') AS pending_withdrawals,
      (SELECT COALESCE(SUM(amount), 0) FROM requests WHERE status = 'pending') AS pending_withdraw_amount,
      (SELECT COUNT(*) FROM transfers WHERE status = 'pending') AS pending_transfers
  `);

  const stats = rows[0];
  const profitResult = await pool.query(
    `SELECT COALESCE(SUM(profit), 0) AS total_profit FROM trades WHERE status = 'closed'`
  );

  const totalProfit = Number(profitResult.rows[0]?.total_profit || 0);

  await sendMessage(
    chatId,
    `*Platform Report*\n\n` +
      `*Users:*\n` +
      `  Total: ${stats.total_users}\n` +
      `  Active: ${stats.active_users}\n` +
      `  Banned: ${stats.banned_users}\n\n` +
      `*Trading:*\n` +
      `  Total Trades: ${stats.total_trades}\n` +
      `  Open: ${stats.open_trades}\n` +
      `  Closed Profit: $${totalProfit.toFixed(2)}\n\n` +
      `*Finance:*\n` +
      `  Total Balance: $${Number(stats.total_balance || 0).toFixed(2)}\n` +
      `  Pending Withdrawals: ${stats.pending_withdrawals} ($${Number(stats.pending_withdraw_amount || 0).toFixed(2)})\n` +
      `  Pending Transfers: ${stats.pending_transfers}`,
    { parse_mode: "Markdown" }
  );
}

async function handleReload(chatId) {
  const status = marketsService.forceReload();
  await logAdminAction(chatId, null, "markets_reload", { status });
  await sendMessage(chatId, `Market streams reload scheduled (${status}).`);
}

async function handleFakeNotification(chatId) {
  const notification = notificationService.generateFake();
  await logAdminAction(chatId, null, "fake_notification", { notification });
  await sendMessage(chatId,
    `Fake notification pushed: ${notification.name} ${notification.type} $${notification.amount} on ${notification.asset}.`
  );
}

async function handleCleanLogs(chatId) {
  const result = await pool.query(
    "DELETE FROM admin_logs WHERE created_at < NOW() - INTERVAL '30 days' RETURNING id"
  );
  await logAdminAction(chatId, null, "clean_logs", { removed: result.rows.length });
  await sendMessage(chatId, `Removed ${result.rows.length} historical log entries.`);
}

async function handleAudit(chatId) {
  const { rows } = await pool.query(
    `SELECT action, target_user_id, details, created_at
       FROM admin_logs
      ORDER BY created_at DESC
      LIMIT 10`
  );

  if (!rows.length) {
    await sendMessage(chatId, "No admin actions recorded yet.");
    return;
  }

  const lines = rows
    .map((row) => {
      const date = new Date(row.created_at).toLocaleString();
      const target = row.target_user_id ? ` > user ${row.target_user_id}` : "";
      return `${date}: ${row.action}${target}`;
    })
    .join("\n");

  await sendMessage(chatId, `*Recent Admin Actions*\n\n${lines}`, { parse_mode: "Markdown" });
}

async function handleGenKey(chatId, text) {
  const args = extractArgs(text);
  if (args.length < 2) {
    await sendMessage(chatId, "*Usage:* /genkey <days>", { parse_mode: "Markdown" });
    return;
  }

  const days = Number(args[1]);
  if (!Number.isFinite(days) || days <= 0) {
    await sendMessage(chatId, "Days must be a positive number.");
    return;
  }

  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let key = '';
  for (let i = 0; i < 16; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  const formattedKey = key.match(/.{1,4}/g).join('-');

  try {
    await pool.query(
      `INSERT INTO keys (key_code, days, created_by)
       VALUES ($1, $2, $3)`,
      [formattedKey, days, chatId]
    );
    
    await logAdminAction(chatId, null, "generate_key", { key: formattedKey, days });
    
    await sendMessage(chatId,
      `*New Activation Key*\n\n` +
      `Key: \`${formattedKey}\`\n` +
      `Duration: ${days} days\n\n` +
      `Key saved and ready to use.`,
      { parse_mode: "Markdown" }
    );
  } catch (err) {
    console.error('[GENKEY] Error saving key:', err);
    await sendMessage(chatId, `Failed to generate key: ${err.message}`);
  }
}

async function handleVerify(chatId, text) {
  const args = extractArgs(text);
  if (args.length < 2) {
    await sendMessage(chatId, "*Usage:* /verify <user\\_id>", { parse_mode: "Markdown" });
    return;
  }

  const identifier = args[1];
  const user = await findUser(identifier);
  if (!user) {
    await sendMessage(chatId, "User not found.");
    return;
  }

  await pool.query(
    `UPDATE users SET verified = TRUE, updated_at = NOW() WHERE id = $1`,
    [user.id]
  );

  await logAdminAction(chatId, user.id, "verify_user", {});
  await sendMessage(chatId,
    `*User Verified*\n\nUser: ${formatUserLabel(user)} (ID: ${user.id})`,
    { parse_mode: "Markdown" }
  );
  await notifyUser(user, "Your account has been verified. Enjoy full access!");
}

async function handleAdminTransfers(chatId) {
  const { rows } = await pool.query(
    `SELECT t.id, t.amount, t.status, t.created_at,
            su.name AS sender_name, su.id AS sender_uid,
            ru.name AS receiver_name, ru.id AS receiver_uid
       FROM transfers t
       JOIN users su ON su.id = t.sender_id
       JOIN users ru ON ru.id = t.receiver_id
      WHERE t.status = 'pending'
      ORDER BY t.created_at ASC
      LIMIT 20`
  );

  if (!rows.length) {
    await sendMessage(chatId, "No pending transfer requests.");
    return;
  }

  for (const t of rows) {
    await sendMessage(chatId,
      `*Transfer #${t.id}*\n\n` +
      `From: ${t.sender_name || t.sender_uid} (ID: ${t.sender_uid})\n` +
      `To: ${t.receiver_name || t.receiver_uid} (ID: ${t.receiver_uid})\n` +
      `Amount: $${Number(t.amount).toFixed(2)}\n` +
      `Date: ${new Date(t.created_at).toLocaleString()}`,
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "Approve", callback_data: `approve_transfer_${t.id}` },
              { text: "Reject", callback_data: `reject_transfer_${t.id}` },
            ],
          ],
        },
      }
    );
    await sleep(100);
  }
}

async function handleApproveTransfer(chatId, text) {
  const args = extractArgs(text);
  if (args.length < 2) {
    await sendMessage(chatId, "*Usage:* /approvetransfer <transfer\\_id>", { parse_mode: "Markdown" });
    return;
  }
  const transferId = Number(args[1]);
  if (!Number.isFinite(transferId)) {
    await sendMessage(chatId, "Invalid transfer ID.");
    return;
  }
  await processTransferDecision(chatId, transferId, "approved");
}

async function handleRejectTransfer(chatId, text) {
  const args = extractArgs(text);
  if (args.length < 2) {
    await sendMessage(chatId, "*Usage:* /rejecttransfer <transfer\\_id>", { parse_mode: "Markdown" });
    return;
  }
  const transferId = Number(args[1]);
  if (!Number.isFinite(transferId)) {
    await sendMessage(chatId, "Invalid transfer ID.");
    return;
  }
  await processTransferDecision(chatId, transferId, "rejected");
}

async function findUser(identifier) {
  if (!identifier) return null;
  const value = String(identifier).trim();
  if (!value) return null;

  const result = await pool.query(
    `SELECT * FROM users WHERE CAST(id AS TEXT) = $1 OR CAST(tg_id AS TEXT) = $1 LIMIT 1`,
    [value]
  );

  return result.rows[0] || null;
}

async function findUserByTgId(tgId) {
  if (!tgId) return null;
  const result = await pool.query(
    `SELECT * FROM users WHERE tg_id = $1 LIMIT 1`,
    [Number(tgId)]
  );
  return result.rows[0] || null;
}

function formatUserLabel(user) {
  return user.name || user.email || user.tg_id || user.id;
}

async function notifyUser(user, message) {
  const chatId = user?.tg_id || user?.id;
  if (!chatId || !botInstance) return;
  try {
    await botInstance.sendMessage(chatId, message);
  } catch (err) {
    warn("Failed to deliver Telegram notification", {
      chatId,
      error: err?.message || err,
    });
  }
}

async function logAdminAction(chatId, targetUserId, action, details) {
  const adminId = await resolveAdminId(chatId);
  const payload = {
    ...(details || {}),
    adminChatId: chatId,
  };
  await pool
    .query(
      `INSERT INTO admin_logs (admin_id, target_user_id, action, details)
       VALUES ($1, $2, $3, $4)`,
      [adminId, targetUserId ?? null, action, payload]
    )
    .catch(() => {});
}

async function resolveAdminId(chatId) {
  if (adminCache.has(chatId)) {
    return adminCache.get(chatId);
  }
  const result = await pool.query(
    "SELECT id FROM users WHERE tg_id = $1 LIMIT 1",
    [chatId]
  );
  const adminId = result.rows[0]?.id ?? null;
  adminCache.set(chatId, adminId);
  return adminId;
}

async function sendMessage(chatId, text, options = {}) {
  if (!botInstance) return;
  try {
    await botInstance.sendMessage(chatId, text, options);
  } catch (err) {
    warn("Telegram sendMessage failed", {
      chatId,
      error: err?.message || err,
    });
  }
}

export default { startTelegramBot };
