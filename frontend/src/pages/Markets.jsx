import { useMemo, useState } from 'react';
import { ArrowPathIcon, SignalIcon } from '@heroicons/react/24/outline';
import CandlestickChart from '../components/CandlestickChart.jsx';
import useBinanceFeed from '../hooks/useBinanceFeed.js';
import { useLanguage } from '../lib/i18n.js';

const ASSETS = [
  { key: 'BTC', name: 'Bitcoin', description: 'BTC / USDT' },
  { key: 'ETH', name: 'Ethereum', description: 'ETH / USDT' },
  { key: 'GOLD', name: 'Gold', description: 'Gold / USD' },
  { key: 'SILVER', name: 'Silver', description: 'Silver / USD' }
];

function Markets() {
  const [selected, setSelected] = useState(ASSETS[0]);
  const [manualTrading, setManualTrading] = useState(true);
  const { price, klines, metrics, status } = useBinanceFeed(selected.key);
  const { t } = useLanguage();

  const statusLabel = useMemo(() => {
    switch (status) {
      case 'connected':
        return 'Live';
      case 'connecting':
        return 'Connecting...';
      default:
        return 'Offline';
    }
  }, [status]);

  return (
    <section className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {ASSETS.map((asset) => (
          <button
            key={asset.key}
            type="button"
            onClick={() => setSelected(asset)}
            className={`rounded-2xl border px-4 py-5 text-left transition focus:outline-none ${
              selected.key === asset.key
                ? 'border-accent/70 bg-accent/40 shadow-glow'
                : 'border-white/5 bg-white/5 hover:border-accent/40'
            }`}
          >
            <p className="text-sm uppercase tracking-wide text-white/60">{asset.description}</p>
            <p className="mt-2 text-xl font-semibold text-white">{asset.name}</p>
            {selected.key === asset.key && price && (
              <p className="mt-3 text-sm text-white/70">
                <span className="text-white">${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
              </p>
            )}
          </button>
        ))}
      </div>

      <div className="rounded-3xl border border-white/5 bg-white/5 p-6 shadow-glow backdrop-blur">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">{selected.name} market</h2>
            <p className="text-sm text-white/60">Streaming from Binance • {statusLabel}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-white/60">Manual trading</span>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                className="peer sr-only"
                checked={manualTrading}
                onChange={(event) => setManualTrading(event.target.checked)}
              />
              <div className="h-6 w-12 rounded-full bg-white/10 transition peer-checked:bg-accent/60"></div>
              <span className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition peer-checked:translate-x-6 peer-checked:bg-white"></span>
            </label>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-xs text-white/60 transition hover:text-white"
            >
              <ArrowPathIcon className="h-4 w-4" /> Refresh
            </button>
          </div>
        </div>

        {!manualTrading && (
          <p className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            {t.manualTradingUnavailable}
          </p>
        )}

        <div className="mt-6 rounded-2xl border border-white/5 bg-black/40 p-4">
          <CandlestickChart data={klines} />
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/5 bg-white/5 px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-white/40">Last price</p>
            <p className="mt-1 text-lg font-semibold text-white">{price ? `$${price.toLocaleString()}` : '---'}</p>
          </div>
          <div className="rounded-2xl border border-white/5 bg-white/5 px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-white/40">Change</p>
            <p className={`mt-1 text-lg font-semibold ${metrics.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {metrics.change >= 0 ? '+' : ''}{metrics.change.toFixed(2)}
            </p>
          </div>
          <div className="rounded-2xl border border-white/5 bg-white/5 px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-white/40">% 24h</p>
            <p className={`mt-1 text-lg font-semibold ${metrics.percent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {metrics.percent >= 0 ? '+' : ''}{metrics.percent.toFixed(2)}%
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-white/5 bg-white/5 p-6 shadow-glow backdrop-blur">
        <h3 className="text-lg font-semibold text-white">Market health</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {['Latency', 'Connection', 'Signal strength'].map((label) => (
            <div key={label} className="rounded-2xl border border-white/5 bg-black/40 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-white/60">{label}</p>
                <SignalIcon className="h-4 w-4 text-accent" />
              </div>
              <p className="mt-2 text-xl font-semibold text-white">{statusLabel}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default Markets;
