import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';

const POLL_MS = 20_000;

function TradeRow({ trade, onClose }) {
  const canClose = trade.status === 'OPEN';
  return (
    <div className="rounded-2xl border border-white/5 bg-white/5 p-4 text-sm text-white/80 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">{trade.symbol}</p>
          <p className="text-xs text-white/50">{trade.type}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-white/60">Amount</p>
          <p className="text-base font-semibold text-white">${trade.amount?.toLocaleString()}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-white/60">TP / SL</p>
          <p className="text-base font-semibold text-white">{trade.tp} / {trade.sl}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-white/60">Opened</p>
          <p className="text-base font-semibold text-white">{dayjs(trade.openedAt).format('MMM D • HH:mm')}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-white/60">Result</p>
          <p className={`text-base font-semibold ${trade.result >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {trade.result >= 0 ? '+' : ''}{trade.result?.toFixed(2)}%
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
            trade.status === 'OPEN'
              ? 'bg-emerald-500/20 text-emerald-300'
              : trade.status === 'CLOSED'
              ? 'bg-slate-500/20 text-slate-200'
              : 'bg-rose-500/20 text-rose-200'
          }`}
          >
            {trade.status}
          </span>
          <button
            type="button"
            disabled={!canClose}
            onClick={() => onClose(trade.id)}
            className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
              canClose
                ? 'border-accent/50 bg-accent/40 text-white shadow-glow hover:bg-accent/60'
                : 'cursor-not-allowed border-white/10 bg-white/10 text-white/40'
            }`}
          >
            Close trade
          </button>
        </div>
      </div>
    </div>
  );
}

function Trades() {
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchTrades = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/trades');
      if (!response.ok) {
        throw new Error('Failed to load trades');
      }
      const data = await response.json();
      setTrades(Array.isArray(data?.items) ? data.items : []);
      setError(null);
      setLoading(false);
    } catch (err) {
      console.error('trades-fetch-error', err);
      setError('Unable to refresh trades. Showing cached data.');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrades();
    const interval = setInterval(fetchTrades, POLL_MS);
    return () => clearInterval(interval);
  }, []);

  const totals = useMemo(() => {
    return trades.reduce(
      (acc, trade) => {
        acc.volume += trade.amount ?? 0;
        acc.profit += trade.profit ?? 0;
        acc.open += trade.status === 'OPEN' ? 1 : 0;
        return acc;
      },
      { volume: 0, profit: 0, open: 0 }
    );
  }, [trades]);

  const handleCloseTrade = async (id) => {
    try {
      const response = await fetch(`/api/trades/${id}/close`, { method: 'PATCH' });
      if (!response.ok) {
        throw new Error('Unable to close trade');
      }
      await fetchTrades();
    } catch (err) {
      console.error('trade-close-error', err);
      setError('Trade close request failed. Try again later.');
    }
  };

  return (
    <section className="space-y-8">
      <div className="rounded-3xl border border-white/5 bg-white/5 p-6 shadow-glow backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Active exposure</h2>
            <p className="text-sm text-white/60">No withdrawals while trades are open</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-white/5 bg-black/40 px-4 py-3 text-sm text-white">
              <p className="text-xs uppercase tracking-wide text-white/40">Total volume</p>
              <p className="mt-1 text-lg font-semibold text-white">${totals.volume.toLocaleString()}</p>
            </div>
            <div className="rounded-2xl border border-white/5 bg-black/40 px-4 py-3 text-sm text-white">
              <p className="text-xs uppercase tracking-wide text-white/40">Realized P&amp;L</p>
              <p className={`mt-1 text-lg font-semibold ${totals.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {totals.profit >= 0 ? '+' : ''}{totals.profit.toFixed(2)}
              </p>
            </div>
            <div className="rounded-2xl border border-white/5 bg-black/40 px-4 py-3 text-sm text-white">
              <p className="text-xs uppercase tracking-wide text-white/40">Open trades</p>
              <p className="mt-1 text-lg font-semibold text-white">{totals.open}</p>
            </div>
          </div>
        </div>
      </div>

      {error && <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</p>}

      <div className="space-y-4">
        {loading && <p className="text-sm text-white/60">Loading latest trades…</p>}
        {trades.length === 0 && !loading ? (
          <div className="rounded-2xl border border-white/5 bg-white/5 px-6 py-10 text-center text-sm text-white/60">
            No trades yet. When trades are opened by the admin, they will appear here with real-time TP &amp; SL tracking.
          </div>
        ) : (
          trades.map((trade) => <TradeRow key={trade.id} trade={trade} onClose={handleCloseTrade} />)
        )}
      </div>
    </section>
  );
}

export default Trades;
