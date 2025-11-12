import { useEffect, useState } from 'react';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { useAdmin } from '../AdminContext.jsx';

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value || 0));
}

function TradesPage() {
  const { request } = useAdmin();
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadTrades = async () => {
    setLoading(true);
    setError(null);
    const response = await request('/trades');
    if (!response?.success) {
      setError(response?.message || 'Failed to load trades');
    } else {
      setTrades(response.data?.trades || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadTrades();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="rounded-3xl border border-white/10 bg-black/60 p-6 shadow-glow">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Trades Monitor</h2>
          <p className="text-sm text-white/50">Track open and closed positions across the desk.</p>
        </div>
        <button
          type="button"
          onClick={loadTrades}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white/70 transition hover:border-accent hover:text-white"
        >
          <ArrowPathIcon className="h-4 w-4" /> Refresh
        </button>
      </div>
      {loading ? (
        <p className="mt-6 text-sm text-white/60">Loading trades…</p>
      ) : error ? (
        <p className="mt-6 text-sm text-red-400">{error}</p>
      ) : trades.length === 0 ? (
        <p className="mt-6 text-sm text-white/60">No trades recorded yet.</p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-white/60">
                <th className="px-4 py-3 font-medium">ID</th>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Symbol</th>
                <th className="px-4 py-3 font-medium">Side</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Entry</th>
                <th className="px-4 py-3 font-medium">TP / SL</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Result</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((trade) => (
                <tr key={trade.id} className="border-t border-white/5 text-white/80">
                  <td className="px-4 py-3 text-white/50">{trade.id}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-white">{trade.user_name || 'User'}</div>
                    <div className="text-xs text-white/40">ID: {trade.user_id}</div>
                  </td>
                  <td className="px-4 py-3">{trade.symbol}</td>
                  <td className="px-4 py-3 capitalize">{trade.side}</td>
                  <td className="px-4 py-3 font-semibold text-accent">{formatCurrency(trade.amount)}</td>
                  <td className="px-4 py-3">{Number(trade.entry_price).toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <div className="text-xs text-white/60">TP: {trade.tp ? Number(trade.tp).toFixed(2) : '—'}</div>
                    <div className="text-xs text-white/40">SL: {trade.sl ? Number(trade.sl).toFixed(2) : '—'}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-3 py-1 text-xs uppercase tracking-wide ${
                        trade.status === 'open'
                          ? 'bg-amber-500/30 text-amber-100'
                          : trade.status === 'closed'
                          ? 'bg-emerald-500/30 text-emerald-100'
                          : 'bg-slate-500/30 text-slate-100'
                      }`}
                    >
                      {trade.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {trade.status === 'open' ? (
                      <span className="text-xs text-white/50">Open</span>
                    ) : (
                      <div>
                        <div className="text-sm font-semibold text-white">
                          {trade.profit != null ? formatCurrency(trade.profit) : '—'}
                        </div>
                        <div className="text-xs text-white/40">
                          Closed at {trade.closed_price ? Number(trade.closed_price).toFixed(2) : '—'}
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default TradesPage;
