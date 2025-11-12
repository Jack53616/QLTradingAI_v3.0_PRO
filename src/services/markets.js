let websocketModule = null;
let websocketFailed = false;

async function loadWebSocket() {
  if (websocketFailed) return null;
  if (websocketModule) return websocketModule;
  try {
    const mod = await import("ws");
    websocketModule = mod.default || mod;
    return websocketModule;
  } catch (error) {
    websocketFailed = true;
    return null;
  }
}

const STREAM_DEFINITIONS = [
  { asset: "BTC", symbol: "BTCUSDT" },
  { asset: "ETH", symbol: "ETHUSDT" },
  { asset: "Gold", symbol: "XAUUSDT" },
  { asset: "Silver", symbol: "XAGUSDT" }
];

const STREAM_URL = `wss://stream.binance.com:9443/stream?streams=${STREAM_DEFINITIONS.map((s) => `${s.symbol.toLowerCase()}@miniTicker`).join("/")}`;

function initialAssetState() {
  const now = new Date().toISOString();
  return Object.fromEntries(
    STREAM_DEFINITIONS.map(({ asset, symbol }, index) => [
      asset,
      {
        symbol,
        price: Number((100 + index * 50).toFixed(2)),
        changePercent: 0,
        high: null,
        low: null,
        volume: null,
        updatedAt: now,
        source: "simulated"
      }
    ])
  );
}

class MarketsService {
  constructor() {
    this.state = initialAssetState();
    this.status = "connecting";
    this.errors = [];
    this.ws = null;
    this.retryTimer = null;
    this.connect();
    this.startSimulation();
  }

  async connect() {
    try {
      const WebSocketImpl = await loadWebSocket();
      if (!WebSocketImpl) {
        this.status = "simulation";
        return;
      }

      this.ws = new WebSocketImpl(STREAM_URL);
      this.ws.on("open", () => {
        this.status = "online";
        this.stateMeta("source", "binance");
      });

      this.ws.on("message", (message) => {
        try {
          const payload = JSON.parse(message);
          const ticker = payload?.data;
          if (!ticker?.s || !ticker?.c) return;
          const stream = STREAM_DEFINITIONS.find((item) => item.symbol === ticker.s);
          if (!stream) return;

          this.state[stream.asset] = {
            symbol: stream.symbol,
            price: Number(ticker.c),
            changePercent: Number(ticker.P ?? 0),
            high: ticker.h ? Number(ticker.h) : null,
            low: ticker.l ? Number(ticker.l) : null,
            volume: ticker.v ? Number(ticker.v) : null,
            updatedAt: new Date().toISOString(),
            source: "binance"
          };
        } catch (err) {
          this.registerError(err);
        }
      });

      this.ws.on("close", () => {
        this.status = "disconnected";
        this.scheduleReconnect();
      });

      this.ws.on("error", (err) => {
        this.registerError(err);
        this.status = "error";
      });
    } catch (err) {
      this.registerError(err);
      this.scheduleReconnect();
    }
  }

  startSimulation() {
    setInterval(() => {
      const now = new Date().toISOString();
      for (const asset of Object.keys(this.state)) {
        const entry = this.state[asset];
        const drift = (Math.random() - 0.5) * 2;
        const nextPrice = Math.max(1, Number((entry.price + drift).toFixed(2)));
        this.state[asset] = {
          ...entry,
          price: nextPrice,
          changePercent: Number((drift / entry.price * 100).toFixed(2)),
          updatedAt: now,
          source: entry.source === "binance" ? entry.source : "simulated"
        };
      }
    }, 30_000);
  }

  scheduleReconnect() {
    if (this.retryTimer) return;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.connect();
    }, 10_000);
  }

  registerError(err) {
    this.errors.push({
      message: err?.message || "unknown_error",
      at: new Date().toISOString()
    });
    if (this.errors.length > 10) {
      this.errors = this.errors.slice(-10);
    }
  }

  forceReload() {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }

    if (this.ws) {
      try {
        this.ws.removeAllListeners?.();
        if (typeof this.ws.close === "function") {
          this.ws.close();
        } else if (typeof this.ws.terminate === "function") {
          this.ws.terminate();
        }
      } catch (err) {
        this.registerError(err);
      }
      this.ws = null;
    }

    this.status = "reloading";
    this.connect();
    return this.status;
  }

  stateMeta(key, value) {
    this.state = Object.fromEntries(
      Object.entries(this.state).map(([asset, entry]) => [
        asset,
        { ...entry, [key]: value, updatedAt: new Date().toISOString() }
      ])
    );
  }

  snapshot() {
    return {
      status: this.status,
      assets: this.state,
      errors: this.errors
    };
  }

  priceForSymbol(symbol) {
    if (!symbol) return null;
    const upper = symbol.toUpperCase();
    const entry = Object.values(this.state).find((item) => item.symbol?.toUpperCase() === upper);
    return entry?.price ?? null;
  }
}

export const marketsService = new MarketsService();
