import { useEffect, useState } from 'react';

const CONTACT_LINKS = [
  { label: 'WhatsApp', href: 'https://wa.me/message/P6BBPSDL2CC4D1' },
  { label: 'Telegram', href: 'https://t.me/qlsupport' }
];

function Withdraw() {
  const [requests, setRequests] = useState([]);
  const [form, setForm] = useState({ amount: '', method: 'USDT', note: '' });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const fetchWithdrawals = async () => {
    try {
      const response = await fetch('/api/withdrawals');
      if (!response.ok) {
        throw new Error('Failed to load withdrawals');
      }
      const data = await response.json();
      setRequests(Array.isArray(data?.items) ? data.items : []);
    } catch (err) {
      console.error('withdraw-fetch-error', err);
    }
  };

  useEffect(() => {
    fetchWithdrawals();
  }, []);

  const submitRequest = async (event) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch('/api/withdrawals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Number(form.amount),
          method: form.method,
          note: form.note
        })
      });
      if (!response.ok) {
        throw new Error('Failed to submit withdrawal');
      }
      setSuccess('Withdrawal request submitted successfully.');
      setForm({ amount: '', method: 'USDT', note: '' });
      fetchWithdrawals();
    } catch (err) {
      console.error('withdraw-submit-error', err);
      setError('Unable to submit withdrawal request. Please try again later.');
    }
  };

  return (
    <section className="space-y-8">
      <div className="rounded-3xl border border-white/5 bg-white/5 p-6 shadow-glow backdrop-blur">
        <h2 className="text-lg font-semibold text-white">Withdraw funds</h2>
        <p className="mt-2 text-sm text-white/60">
          To add funds, contact support. Our team will assist you with secure deposit instructions.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          {CONTACT_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="inline-flex items-center rounded-full border border-white/10 bg-accent/40 px-4 py-2 text-sm font-semibold text-white shadow-glow transition hover:bg-accent/60"
            >
              {link.label}
            </a>
          ))}
        </div>
      </div>

      <form onSubmit={submitRequest} className="rounded-3xl border border-white/5 bg-white/5 p-6 shadow-glow backdrop-blur">
        <h3 className="text-lg font-semibold text-white">Request withdrawal</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col text-sm text-white/70">
            Amount (USD)
            <input
              required
              min="0"
              step="0.01"
              type="number"
              value={form.amount}
              onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))}
              className="mt-2 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-white focus:border-accent focus:outline-none"
            />
          </label>
          <label className="flex flex-col text-sm text-white/70">
            Method
            <select
              value={form.method}
              onChange={(event) => setForm((prev) => ({ ...prev, method: event.target.value }))}
              className="mt-2 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-white focus:border-accent focus:outline-none"
            >
              <option value="USDT">USDT (TRC20)</option>
              <option value="Bank">Bank transfer</option>
            </select>
          </label>
        </div>
        <label className="mt-4 flex flex-col text-sm text-white/70">
          Notes for finance team (optional)
          <textarea
            value={form.note}
            onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))}
            rows={4}
            className="mt-2 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-white focus:border-accent focus:outline-none"
          />
        </label>
        <button
          type="submit"
          className="mt-6 inline-flex items-center justify-center rounded-full border border-white/10 bg-emerald-500/40 px-6 py-2 text-sm font-semibold text-white shadow-glow transition hover:bg-emerald-500/60"
        >
          Submit request
        </button>
        {error && <p className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</p>}
        {success && <p className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{success}</p>}
      </form>

      <div className="rounded-3xl border border-white/5 bg-white/5 p-6 shadow-glow backdrop-blur">
        <h3 className="text-lg font-semibold text-white">Withdrawal history</h3>
        <div className="mt-4 space-y-4">
          {requests.length === 0 ? (
            <p className="text-sm text-white/60">No withdrawal requests yet.</p>
          ) : (
            requests.map((item) => (
              <div key={item.id} className="rounded-2xl border border-white/5 bg-black/40 p-4 text-sm text-white/70">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-semibold text-white">${item.amount.toLocaleString()}</p>
                  <p>{item.method}</p>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      item.status === 'APPROVED'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : item.status === 'REJECTED'
                        ? 'bg-rose-500/20 text-rose-200'
                        : 'bg-amber-500/20 text-amber-200'
                    }`}
                  >
                    {item.status}
                  </span>
                </div>
                {item.reason && (
                  <p className="mt-2 text-xs text-rose-200">
                    Reason: {item.reason}
                  </p>
                )}
                <p className="mt-2 text-xs text-white/40">{new Date(item.createdAt).toLocaleString()}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

export default Withdraw;
