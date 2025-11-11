# QL Trading AI v3.0 PRO 💎

**Advanced Telegram Trading Bot with Beautiful UI & Real-time Market Data**

## 🌟 Features

### Security ✅
- **Telegram WebApp Only Access** - Works exclusively through Telegram WebApp
- **Secure Authentication** - HMAC-SHA256 signature verification
- **Rate Limiting** - Protection against brute force attacks
- **Balance Reservation** - Prevents double withdrawal
- **Input Validation** - All user inputs are validated and sanitized
- **JWT Authentication** - Secure admin panel access
- **SQL Injection Protection** - Parameterized queries

### Trading Features 📊
- **Real-time Market Prices** - Live data from CoinGecko API
- **Live Balance Ticker** - Real-time balance updates every 2 seconds
- **Multiple Markets** - Gold, Silver, Bitcoin, Ethereum
- **Trade Management** - Open/close trades with SL/TP
- **Crypto Withdrawals** - USDT (TRC20/ERC20), BTC, ETH
- **Mobile-First Design** - Optimized for Telegram WebApp

### User Experience 🎨
- **Beautiful Glass Morphism UI** - Modern gradient design
- **Multi-language Support** - Arabic & English
- **Live Feed Notifications** - Real-time activity updates (every 20s)
- **Fake Notifications** - 30 Arabic names for realistic feed
- **Smooth Animations** - Polished user interface
- **Interactive Charts** - Visual balance tracking

### Admin Features 👥
- **User Management** - View and manage all users
- **Balance Control** - Add/remove user balance
- **Key Generation** - Create subscription keys
- **Withdrawal Approval** - Approve/reject requests
- **Statistics Dashboard** - Real-time analytics
- **Broadcast Messages** - Send announcements to all users

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Telegram Bot Token

### Installation

```bash
# Clone repository
git clone https://github.com/Jack53616/QLTradingAI_v3.0_PRO.git
cd QLTradingAI_v3.0_PRO

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env
# Edit .env with your configuration

# Initialize database
psql -U postgres -d your_database -f db.sql

# Start server
npm start
```

### Environment Variables

```env
# Server
PORT=10000
NODE_ENV=production

# Database
DATABASE_URL=postgresql://user:password@host:5432/database
DATABASE_SSL=true

# Telegram
BOT_TOKEN=your_bot_token_here
TELEGRAM_ADMINS=123456789,987654321

# Security
JWT_SECRET=your_very_long_random_secret_at_least_32_characters
ADMIN_TOKEN=your_admin_panel_password

# Optional
ALLOWED_ORIGINS=https://yourdomain.com
DEV_USER_ID=123456789  # Only for development
```

## 🛡️ Security Improvements (v3.0 PRO)

### Fixed Critical Vulnerabilities
1. ✅ **Authentication Bypass** - Now requires valid Telegram initData
2. ✅ **Double Withdrawal** - Balance reserved immediately on request
3. ✅ **Missing JWT Validation** - JWT_SECRET must be 32+ characters
4. ✅ **Rate Limiting** - Added strict limits on admin login
5. ✅ **CORS Misconfiguration** - Properly configured origins
6. ✅ **Database Health Check** - Health endpoint now checks DB connection

### Withdrawal Security Flow
```
1. User requests withdrawal
2. Balance RESERVED immediately (prevents double withdrawal)
3. Request created with 'pending' status
4. Admin reviews request
5. If APPROVED: Balance already deducted, just update status
6. If REJECTED: Balance RETURNED to user
```

## 📊 Real-time Market Data

### Supported Markets
- **XAUUSD** (Gold) - From metals.live API
- **XAGUSD** (Silver) - From metals.live API
- **BTCUSDT** (Bitcoin) - From CoinGecko API
- **ETHUSDT** (Ethereum) - From CoinGecko API

### Update Frequency
- Markets: Every 30 seconds
- Balance: Every 2 seconds
- Live Feed: Every 20 seconds

## 🎨 UI Features

### Beautiful Design Elements
- **Glass Morphism Cards** - Frosted glass effect with backdrop blur
- **Gradient Backgrounds** - Smooth purple/blue gradients
- **Neon Glow Effects** - Subtle glowing accents
- **Smooth Animations** - Fade-in, slide-up, scale effects
- **Responsive Layout** - Works perfectly on all devices

### Live Features
- **Balance Ticker** - Simulates real-time P&L changes
- **SVG Chart Animation** - Animated balance chart
- **Live Feed** - Fake notifications with Arabic names
- **Sparkline Charts** - Mini charts for each market

### Fake Notifications (30 Names)
```javascript
أحمد، محمد، خالد، سارة، رامي، نور، ليلى، وسيم، حسن، طارق،
فاطمة، علي، زينب، عمر، مريم، يوسف، هدى، كريم، دينا، ماجد،
ريم، سامي، لينا، فارس، منى، عادل، سلمى، بشار، رنا، جمال
```

## 📝 Admin Commands (Telegram Bot)

```
/start - Welcome message
/stats - View statistics
/users - List all users
/balance <user_id> <amount> - Update balance
/genkey <days> - Generate subscription key
/broadcast <message> - Send message to all users
/approve_withdraw <request_id> - Approve withdrawal
/reject_withdraw <request_id> - Reject withdrawal
/pending - View pending requests
```

## 🔧 API Endpoints

### Public
- `POST /api/keys/activate` - Activate subscription key
- `GET /api/markets` - Get market data
- `GET /healthz` - Health check

### Authenticated (Telegram WebApp)
- `GET /api/users/me` - Get current user
- `GET /api/trades/me` - Get user trades
- `POST /api/withdraw` - Create withdrawal request
- `GET /api/withdraw/history` - Get withdrawal history

### Admin
- `POST /api/admin/login` - Admin login
- `GET /api/admin/users` - List all users
- `POST /api/admin/balance` - Update user balance
- `POST /api/admin/keys/generate` - Generate keys

## 🚀 Deployment

### Render.com (Recommended)
1. Push to GitHub
2. Connect repository to Render
3. Render will use `render.yaml` automatically
4. Set environment variables in dashboard
5. Deploy!

### Manual Deployment
```bash
npm install --production
npm start
```

## 📞 Support

- **WhatsApp**: [Contact Support](https://wa.me/message/P6BBPSDL2CC4D1)
- **Telegram**: [@QL_Support](https://t.me/QL_Support)

## 🔄 Changelog

### v3.0 PRO (Current)
- ✅ Fixed all 32 security issues from audit
- ✅ Integrated beautiful old design
- ✅ Added real-time market prices
- ✅ Implemented balance ticker
- ✅ Added fake notifications (30 names)
- ✅ Enhanced Telegram authentication
- ✅ Improved withdrawal security
- ✅ Added rate limiting
- ✅ Fixed database configuration
- ✅ Enhanced error handling

## ⚠️ Security Notes

- Never commit `.env` to Git
- Use strong `JWT_SECRET` (32+ characters)
- Keep `ADMIN_TOKEN` secure
- Enable SSL in production
- Monitor logs regularly
- Update dependencies monthly

## 📄 License

Private - All rights reserved

---

**Developed with ❤️ for professional trading operations**
