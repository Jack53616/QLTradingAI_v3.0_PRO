import { useEffect, useState } from 'react';
import { ArrowPathIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import ActionModal from '../components/ActionModal.jsx';
import { useAdmin } from '../AdminContext.jsx';

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value || 0));
}

function WithdrawalsPage() {
  const { request } = useAdmin();
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const loadWithdrawals = async () => {
    setLoading(true);
    setError(null);
    const response = await request('/withdrawals');
    if (!response?.success) {
      setError(response?.message || 'Failed to load withdrawals');
    } else {
      setWithdrawals(response.data?.withdrawals || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadWithdrawals();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const updateStatus = (id, status, reason) => {
    setWithdrawals((prev) =>
      prev.map((request) =>
        request.id === id ? { ...request, status, reason: reason || request.reason, processed_at: new Date().toISOString() } : request
      )
    );
  };

  const approveWithdrawal = async (withdrawal) => {
    setSubmitting(true);
    const response = await request(`/withdrawals/${withdrawal.id}/decision`, {
      method: 'POST',
      body: { status: 'approved' }
    });
    if (response?.success) {
      updateStatus(withdrawal.id, 'approved');
    }
    setSubmitting(false);
  };

  const rejectWithdrawal = async (event) => {
    event.preventDefault();
    if (!modal?.withdrawal) return;
    const reason = event.target.reason.value.trim();
    if (!reason) {
      return;
    }
    setSubmitting(true);
    const response = await request(`/withdrawals/${modal.withdrawal.id}/decision`, {
      method: 'POST',
      body: { status: 'rejected', reason }
    });
    if (response?.success) {
      updateStatus(modal.withdrawal.id, 'rejected', reason);
      setModal(null);
    }
    setSubmitting(false);
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-black/60 p-6 shadow-glow">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Withdrawal Requests</h2>
          <p className="text-sm text-white/50">Approve or reject requests with transparent reasoning.</p>
        </div>
        <button
          type="button"
          onClick={loadWithdrawals}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white/70 transition hover:border-accent hover:text-white"
        >
          <ArrowPathIcon className="h-4 w-4" /> Refresh
        </button>
      </div>
      {loading ? (
        <p className="mt-6 text-sm text-white/60">Loading withdrawals…</p>
      ) : error ? (
        <p className="mt-6 text-sm text-red-400">{error}</p>
      ) : withdrawals.length === 0 ? (
        <p className="mt-6 text-sm text-white/60">No withdrawal requests right now.</p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-white/60">
                <th className="px-4 py-3 font-medium">ID</th>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Method</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Requested</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {withdrawals.map((withdrawal) => (
                <tr key={withdrawal.id} className="border-t border-white/5 text-white/80">
                  <td className="px-4 py-3 text-white/50">{withdrawal.id}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-white">{withdrawal.user_name || 'User'}</div>
                    <div className="text-xs text-white/40">ID: {withdrawal.user_id}</div>
                  </td>
                  <td className="px-4 py-3 font-semibold text-accent">{formatCurrency(withdrawal.amount)}</td>
                  <td className="px-4 py-3 text-white/70">{withdrawal.method}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-3 py-1 text-xs uppercase tracking-wide ${
                        withdrawal.status === 'pending'
                          ? 'bg-amber-500/30 text-amber-100'
                          : withdrawal.status === 'approved'
                          ? 'bg-emerald-500/30 text-emerald-100'
                          : 'bg-rose-500/30 text-rose-100'
                      }`}
                    >
                      {withdrawal.status}
                    </span>
                    {withdrawal.reason ? (
                      <p className="mt-1 text-xs text-white/50">Reason: {withdrawal.reason}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-white/60">
                    {withdrawal.created_at ? new Date(withdrawal.created_at).toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {withdrawal.status === 'pending' ? (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={() => approveWithdrawal(withdrawal)}
                          className="inline-flex items-center gap-1 rounded-full bg-emerald-500/30 px-3 py-1 text-xs font-semibold text-emerald-100 shadow-glow transition hover:bg-emerald-500/50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <CheckCircleIcon className="h-4 w-4" /> Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => setModal({ type: 'reject', withdrawal })}
                          className="inline-flex items-center gap-1 rounded-full bg-rose-500/30 px-3 py-1 text-xs font-semibold text-rose-100 shadow-glow transition hover:bg-rose-500/50"
                        >
                          <XCircleIcon className="h-4 w-4" /> Reject
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-white/50">Processed</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ActionModal
        open={modal?.type === 'reject'}
        onClose={() => (!submitting ? setModal(null) : null)}
        title="Reject Withdrawal"
        description={modal?.withdrawal ? `Provide a reason to reject request #${modal.withdrawal.id}.` : ''}
      >
        <form onSubmit={rejectWithdrawal} className="space-y-4">
          <div>
            <label htmlFor="reason" className="block text-xs font-semibold uppercase tracking-wide text-white/60">
              Reason (required)
            </label>
            <textarea
              id="reason"
              name="reason"
              rows={4}
              required
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/60 px-4 py-3 text-white shadow-inner focus:border-accent focus:outline-none"
              placeholder="Explain why this request is rejected"
              autoFocus
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center rounded-xl bg-rose-500/60 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-white shadow-glow transition hover:bg-rose-500/80 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Rejecting…' : 'Reject Withdrawal'}
          </button>
        </form>
      </ActionModal>
    </div>
  );
}

export default WithdrawalsPage;
