import { useEffect, useMemo, useRef, useState } from 'react';

const ENDPOINT = 'wss://stream.binance.com:9443/ws';

const SYMBOL_MAP = {
  BTC: 'btcusdt',
  ETH: 'ethusdt',
  GOLD: 'xauusdt',
  SILVER: 'xagusdt'
};

function createSeedKlines() {
  const now = Date.now();
  return Array.from({ length: 60 }).map((_, index) => {
    const openTime = now - (60 - index) * 60 * 1000;
    const closeTime = openTime + 60 * 1000;
    const open = 50000 + Math.sin(index / 3) * 2000 + Math.random() * 200;
    const close = open + (Math.random() - 0.5) * 300;
    const high = Math.max(open, close) + Math.random() * 120;
    const low = Math.min(open, close) - Math.random() * 120;
    return {
      time: openTime / 1000,
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2))
    };
  });
}

export default function useBinanceFeed(symbolKey) {
  const symbol = SYMBOL_MAP[symbolKey] ?? SYMBOL_MAP.BTC;
  const socketRef = useRef(null);
  const [klines, setKlines] = useState(createSeedKlines);
  const [price, setPrice] = useState(null);
  const [status, setStatus] = useState('connecting');

  useEffect(() => {
    setStatus('connecting');
    const ws = new WebSocket(`${ENDPOINT}/${symbol}@kline_1m`);
    socketRef.current = ws;

    ws.onopen = () => setStatus('connected');
    ws.onclose = () => setStatus('disconnected');

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (!payload?.k) return;
        const candle = payload.k;
        const next = {
          time: candle.t / 1000,
          open: Number(candle.o),
          high: Number(candle.h),
          low: Number(candle.l),
          close: Number(candle.c)
        };
        setPrice(Number(candle.c));
        setKlines((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last && last.time === next.time) {
            updated[updated.length - 1] = next;
          } else {
            updated.push(next);
            if (updated.length > 120) updated.shift();
          }
          return updated;
        });
      } catch (error) {
        console.error('binance-stream-error', error);
      }
    };

    return () => {
      ws.close(1000, 'component-unmount');
    };
  }, [symbol]);

  const metrics = useMemo(() => {
    if (!klines.length) {
      return { change: 0, percent: 0 };
    }
    const first = klines[0];
    const last = klines[klines.length - 1];
    const change = last.close - first.open;
    const percent = (change / first.open) * 100;
    return { change, percent };
  }, [klines]);

  return { price, klines, metrics, status };
}
