import { useState } from 'react';
import { LockClosedIcon } from '@heroicons/react/24/outline';
import { useAdmin } from './AdminContext.jsx';

function AdminLogin() {
  const { setSession } = useAdmin();
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!password) {
      setError('Password is required');
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({ password })
      });

      const payload = await response.json().catch(() => ({ success: false, message: 'invalid_response' }));
      if (!response.ok || !payload?.success) {
        setError(payload?.message || 'Login failed');
      } else {
        setSession(payload.data?.token, payload.data?.admin || { name: 'QL Admin' });
      }
    } catch (err) {
      setError('Unable to reach admin server');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-black via-base to-black p-6">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 text-white shadow-glow backdrop-blur">
        <div className="mb-6 flex items-center justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-accent/40 bg-accent/30">
            <LockClosedIcon className="h-6 w-6 text-white" />
          </div>
        </div>
        <h1 className="text-center text-2xl font-semibold text-white">Admin Panel</h1>
        <p className="mt-2 text-center text-sm text-white/60">Enter the secure password to continue.</p>
        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div>
            <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wide text-white/60">
              Password
            </label>
            <input
              id="password"
              type="password"
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/60 px-4 py-3 text-white shadow-inner focus:border-accent focus:outline-none"
              placeholder="jack53616"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
            />
          </div>
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center rounded-xl bg-accent/60 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-white shadow-glow transition hover:bg-accent/80 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Authenticating…' : 'Enter Admin Panel'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default AdminLogin;
