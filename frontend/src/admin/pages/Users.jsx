import { useEffect, useMemo, useState } from 'react';
import { ArrowUpCircleIcon, ArrowDownCircleIcon, ClockIcon } from '@heroicons/react/24/outline';
import ActionModal from '../components/ActionModal.jsx';
import { useAdmin } from '../AdminContext.jsx';

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value || 0));
}

function UsersPage() {
  const { request } = useAdmin();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const totals = useMemo(() => {
    const active = users.filter((user) => user.status === 'active').length;
    const frozen = users.filter((user) => user.status === 'frozen').length;
    const banned = users.filter((user) => user.status === 'banned').length;
    const balance = users.reduce((sum, user) => sum + Number(user.balance || 0), 0);
    return { active, frozen, banned, balance };
  }, [users]);

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    const response = await request('/users');
    if (!response?.success) {
      setError(response?.message || 'Failed to load users');
    } else {
      setUsers(response.data?.users || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadUsers();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleBalanceSubmit = async (event) => {
    event.preventDefault();
    if (!modal?.user) return;
    const amountValue = Number(event.target.amount.value);
    const reasonValue = event.target.reason.value.trim();
    if (!amountValue) {
      return;
    }
    setSubmitting(true);
    const body = {
      amount: modal.mode === 'remove' ? -Math.abs(amountValue) : Math.abs(amountValue),
      reason: reasonValue || undefined
    };
    const response = await request(`/users/${modal.user.id}/balance`, { method: 'POST', body });
    if (response?.success) {
      setUsers((prev) =>
        prev.map((user) =>
          user.id === modal.user.id ? { ...user, balance: response.data.balance } : user
        )
      );
      setModal(null);
    }
    setSubmitting(false);
  };

  const handleExtendSubmit = async (event) => {
    event.preventDefault();
    if (!modal?.user) return;
    const daysValue = Number(event.target.days.value);
    if (!daysValue) {
      return;
    }
    setSubmitting(true);
    const response = await request(`/users/${modal.user.id}/subscription`, {
      method: 'POST',
      body: { days: daysValue }
    });
    if (response?.success) {
      setUsers((prev) =>
        prev.map((user) =>
          user.id === modal.user.id
            ? {
                ...user,
                sub_days: response.data.subDays,
                subscription_expires: response.data.subscriptionExpires
              }
            : user
        )
      );
      setModal(null);
    }
    setSubmitting(false);
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-glow">
          <p className="text-sm text-white/50">Active Users</p>
          <p className="mt-2 text-2xl font-semibold">{totals.active}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-glow">
          <p className="text-sm text-white/50">Frozen</p>
          <p className="mt-2 text-2xl font-semibold">{totals.frozen}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-glow">
          <p className="text-sm text-white/50">Banned</p>
          <p className="mt-2 text-2xl font-semibold">{totals.banned}</p>
        </div>
        <div className="rounded-2xl border border-accent/40 bg-accent/20 p-5 shadow-glow">
          <p className="text-sm text-white/80">Total Balance</p>
          <p className="mt-2 text-2xl font-semibold">{formatCurrency(totals.balance)}</p>
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-black/60 p-6 shadow-glow">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Users</h2>
            <p className="text-sm text-white/50">Manage balances, subscription, and status.</p>
          </div>
          <button
            type="button"
            onClick={loadUsers}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white/70 transition hover:border-accent hover:text-white"
          >
            <ClockIcon className="h-4 w-4" /> Refresh
          </button>
        </div>
        {loading ? (
          <p className="mt-6 text-sm text-white/60">Loading users…</p>
        ) : error ? (
          <p className="mt-6 text-sm text-red-400">{error}</p>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-white/60">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Balance</th>
                  <th className="px-4 py-3 font-medium">Subscription</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-t border-white/5 text-white/80">
                    <td className="px-4 py-3">
                      <div className="font-medium text-white">{user.name || 'Unnamed User'}</div>
                      <div className="text-xs text-white/40">ID: {user.id}</div>
                    </td>
                    <td className="px-4 py-3 text-white/70">{user.email || '—'}</td>
                    <td className="px-4 py-3 font-semibold text-accent">{formatCurrency(user.balance)}</td>
                    <td className="px-4 py-3">
                      <div>{user.sub_days} days</div>
                      <div className="text-xs text-white/40">
                        {user.subscription_expires ? new Date(user.subscription_expires).toLocaleDateString() : 'No expiry'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-wide text-white/70">
                        {user.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setModal({ type: 'balance', user, mode: 'add' })}
                          className="inline-flex items-center gap-1 rounded-full bg-emerald-500/30 px-3 py-1 text-xs font-semibold text-emerald-100 shadow-glow transition hover:bg-emerald-500/50"
                        >
                          <ArrowUpCircleIcon className="h-4 w-4" /> Add
                        </button>
                        <button
                          type="button"
                          onClick={() => setModal({ type: 'balance', user, mode: 'remove' })}
                          className="inline-flex items-center gap-1 rounded-full bg-rose-500/30 px-3 py-1 text-xs font-semibold text-rose-100 shadow-glow transition hover:bg-rose-500/50"
                        >
                          <ArrowDownCircleIcon className="h-4 w-4" /> Remove
                        </button>
                        <button
                          type="button"
                          onClick={() => setModal({ type: 'extend', user })}
                          className="inline-flex items-center gap-1 rounded-full bg-accent/40 px-3 py-1 text-xs font-semibold text-white shadow-glow transition hover:bg-accent/60"
                        >
                          Extend
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ActionModal
        open={modal?.type === 'balance'}
        onClose={() => (!submitting ? setModal(null) : null)}
        title={modal?.mode === 'remove' ? 'Remove Balance' : 'Add Balance'}
        description={modal?.user ? `Adjust balance for ${modal.user.name || 'user'} (ID ${modal.user.id}).` : ''}
      >
        <form onSubmit={handleBalanceSubmit} className="space-y-4">
          <div>
            <label htmlFor="amount" className="block text-xs font-semibold uppercase tracking-wide text-white/60">
              Amount (USD)
            </label>
            <input
              id="amount"
              name="amount"
              type="number"
              step="0.01"
              min="0"
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/60 px-4 py-3 text-white shadow-inner focus:border-accent focus:outline-none"
              required
              autoFocus
            />
          </div>
          <div>
            <label htmlFor="reason" className="block text-xs font-semibold uppercase tracking-wide text-white/60">
              Reason (optional)
            </label>
            <textarea
              id="reason"
              name="reason"
              rows={3}
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/60 px-4 py-3 text-white shadow-inner focus:border-accent focus:outline-none"
              placeholder="Internal note for audit trail"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center rounded-xl bg-accent/60 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-white shadow-glow transition hover:bg-accent/80 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Applying…' : 'Confirm'}
          </button>
        </form>
      </ActionModal>

      <ActionModal
        open={modal?.type === 'extend'}
        onClose={() => (!submitting ? setModal(null) : null)}
        title="Extend Subscription"
        description={modal?.user ? `Grant extra access days to ${modal.user.name || 'user'} (ID ${modal.user.id}).` : ''}
      >
        <form onSubmit={handleExtendSubmit} className="space-y-4">
          <div>
            <label htmlFor="days" className="block text-xs font-semibold uppercase tracking-wide text-white/60">
              Days to extend
            </label>
            <input
              id="days"
              name="days"
              type="number"
              min="1"
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/60 px-4 py-3 text-white shadow-inner focus:border-accent focus:outline-none"
              required
              autoFocus
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center rounded-xl bg-accent/60 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-white shadow-glow transition hover:bg-accent/80 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Extending…' : 'Extend Subscription'}
          </button>
        </form>
      </ActionModal>
    </div>
  );
}

export default UsersPage;
