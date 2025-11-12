import { useEffect, useState } from 'react';
import { MegaphoneIcon } from '@heroicons/react/24/outline';
import { useAdmin } from '../AdminContext.jsx';

function NotificationsPage() {
  const { request } = useAdmin();
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState(null);

  const loadHistory = async () => {
    try {
      const response = await fetch('/api/activity/feed?limit=25', {
        headers: { Accept: 'application/json' }
      });
      const payload = await response.json();
      if (payload?.success) {
        setHistory(payload.data?.notifications || []);
      }
    } catch (err) {
      // ignore load errors
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!message.trim()) {
      setError('Message cannot be empty.');
      return;
    }
    setSubmitting(true);
    setError(null);
    const response = await request('/notifications/broadcast', {
      method: 'POST',
      body: { message: message.trim() }
    });
    if (!response?.success) {
      setError(response?.message || 'Failed to send notification');
    } else {
      const newNotification = {
        id: `${Date.now()}`,
        name: 'Admin Broadcast',
        message: message.trim(),
        createdAt: new Date().toISOString()
      };
      setHistory((prev) => [newNotification, ...prev].slice(0, 25));
      setMessage('');
    }
    setSubmitting(false);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-3xl border border-white/10 bg-black/60 p-6 shadow-glow">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/40 text-white">
            <MegaphoneIcon className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Broadcast Message</h2>
            <p className="text-sm text-white/50">Send instant alerts to the live activity feed.</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="message" className="block text-xs font-semibold uppercase tracking-wide text-white/60">
              Message
            </label>
            <textarea
              id="message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={6}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/60 px-4 py-3 text-sm text-white shadow-inner focus:border-accent focus:outline-none"
              placeholder="Announce system updates, news, or manual trade adjustments"
            />
          </div>
          {error ? <p className="text-sm text-rose-300">{error}</p> : null}
          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center rounded-xl bg-accent/60 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-white shadow-glow transition hover:bg-accent/80 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Broadcasting…' : 'Send Broadcast'}
          </button>
        </form>
      </div>

      <div className="rounded-3xl border border-white/10 bg-black/60 p-6 shadow-glow">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Recent Activity Feed</h2>
          <button
            type="button"
            onClick={loadHistory}
            className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/60 transition hover:border-accent hover:text-white"
          >
            Refresh
          </button>
        </div>
        <div className="mt-4 space-y-4">
          {history.length === 0 ? (
            <p className="text-sm text-white/60">No notifications yet.</p>
          ) : (
            history.map((item) => (
              <div key={item.id} className="rounded-2xl border border-white/5 bg-white/5/40 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-white">{item.name || 'Activity'}</span>
                  <span className="text-xs text-white/40">
                    {item.createdAt ? new Date(item.createdAt).toLocaleTimeString() : ''}
                  </span>
                </div>
                <p className="mt-2 text-sm text-white/70">{item.message || item.type || 'Update'}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default NotificationsPage;
