import { useEffect, useMemo, useState } from 'react';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { useAdmin } from '../AdminContext.jsx';

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value || 0));
}

function AnalyticsPage() {
  const { request } = useAdmin();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadAnalytics = async () => {
    setLoading(true);
    setError(null);
    const response = await request('/analytics');
    if (!response?.success) {
      setError(response?.message || 'Failed to load analytics');
    } else {
      setAnalytics(response.data || {});
    }
    setLoading(false);
  };

  useEffect(() => {
    loadAnalytics();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const activitySeries = useMemo(() => {
    const data = analytics?.activity || [];
    const maxTrades = Math.max(...data.map((entry) => entry.trades || 0), 1);
    const maxProfit = Math.max(...data.map((entry) => Number(entry.profit) || 0), 1);
    return data.map((entry) => ({
      label: entry.label,
      trades: entry.trades,
      tradesPercent: Math.round(((entry.trades || 0) / maxTrades) * 100),
      profit: Number(entry.profit) || 0,
      profitPercent: Math.round(((Number(entry.profit) || 0) / maxProfit) * 100)
    }));
  }, [analytics]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Performance Analytics</h2>
          <p className="text-sm text-white/50">High-level overview for growth, balance, and risk.</p>
        </div>
        <button
          type="button"
          onClick={loadAnalytics}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white/70 transition hover:border-accent hover:text-white"
        >
          <ArrowPathIcon className="h-4 w-4" /> Refresh
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-white/60">Loading analytics…</p>
      ) : error ? (
        <p className="text-sm text-red-400">{error}</p>
      ) : !analytics ? (
        <p className="text-sm text-white/60">No analytics to display.</p>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-glow">
              <p className="text-sm text-white/50">Total Users</p>
              <p className="mt-2 text-2xl font-semibold">{analytics.users ?? 0}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-glow">
              <p className="text-sm text-white/50">Total Trades</p>
              <p className="mt-2 text-2xl font-semibold">{analytics.totalTrades ?? 0}</p>
            </div>
            <div className="rounded-2xl border border-accent/40 bg-accent/20 p-5 shadow-glow">
              <p className="text-sm text-white/80">Realized Profit</p>
              <p className="mt-2 text-2xl font-semibold">{formatCurrency(analytics.realizedProfit ?? 0)}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-glow">
              <p className="text-sm text-white/50">Total Balance</p>
              <p className="mt-2 text-2xl font-semibold">{formatCurrency(analytics.totalBalance ?? 0)}</p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-black/60 p-6 shadow-glow">
              <h3 className="text-base font-semibold text-white">Withdrawals Overview</h3>
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3">
                  <span className="text-sm font-semibold text-amber-100">Pending</span>
                  <span className="text-lg font-semibold text-white">{analytics.withdrawals?.pending ?? 0}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
                  <span className="text-sm font-semibold text-emerald-100">Approved</span>
                  <span className="text-lg font-semibold text-white">{analytics.withdrawals?.approved ?? 0}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3">
                  <span className="text-sm font-semibold text-rose-100">Rejected</span>
                  <span className="text-lg font-semibold text-white">{analytics.withdrawals?.rejected ?? 0}</span>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-black/60 p-6 shadow-glow">
              <h3 className="text-base font-semibold text-white">14-Day Activity</h3>
              <div className="mt-4 space-y-4">
                {activitySeries.length === 0 ? (
                  <p className="text-sm text-white/60">No activity recorded yet.</p>
                ) : (
                  activitySeries.map((entry) => (
                    <div key={entry.label} className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-white/50">
                        <span>{entry.label}</span>
                        <span>{entry.trades} trades</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                        <div className="h-full rounded-full bg-accent/60" style={{ width: `${entry.tradesPercent}%` }} />
                      </div>
                      <div className="flex items-center justify-between text-xs text-white/40">
                        <span>Profit</span>
                        <span>{formatCurrency(entry.profit)}</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                        <div className="h-full rounded-full bg-emerald-500/60" style={{ width: `${entry.profitPercent}%` }} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default AnalyticsPage;
