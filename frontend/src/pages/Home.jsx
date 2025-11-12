import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useLanguage } from '../lib/i18n.js';

dayjs.extend(relativeTime);

const ARABIC_NAMES = [
  'أحمد', 'محمد', 'عبدالله', 'خالد', 'علي', 'سلمان', 'ياسر', 'عبدالعزيز', 'فهد', 'إبراهيم', 'عثمان', 'طارق', 'حسين', 'مازن',
  'راشد', 'فيصل', 'صالح', 'بدر', 'فواز', 'ياسين', 'جمال', 'سامي', 'ظافر', 'مروان', 'هاشم', 'صادق', 'قاسم', 'منير', 'أمين',
  'سعيد', 'رامي', 'عبدالرحمن', 'نادر', 'فراس', 'ماهر', 'هيثم', 'فادي', 'لؤي', 'جابر', 'غسان', 'وليد', 'رائد', 'سلطان', 'عباس',
  'عدنان', 'صهيب', 'حمزة', 'تامر', 'شادي', 'نواف', 'مهند', 'نائل', 'زيد', 'أنس', 'أكرم', 'ثامر', 'مؤيد', 'بلال', 'حذيفة', 'مناف'
];

const FAKE_MESSAGES = [
  'opened a new trade on BTCUSDT',
  'secured profit from Gold position',
  'enabled manual trading mode',
  'received VIP verification badge',
  'extended subscription by 30 days',
  'closed ETH trade at take-profit',
  'requested withdrawal confirmation'
];

function NotificationCard({ entry }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-white/5 p-4 text-sm text-white/80 backdrop-blur">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-white">{entry.name}</span>
        <span className="text-xs text-white/50">{dayjs(entry.time).fromNow()}</span>
      </div>
      <p className="mt-1 text-white/70">{entry.message}</p>
    </div>
  );
}

function Home() {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [profile, setProfile] = useState({
    balance: 0,
    subDays: 0,
    telegramId: '000000000',
    lastLogin: dayjs().subtract(2, 'hour').toISOString()
  });
  const [activity, setActivity] = useState([]);

  useEffect(() => {
    let mounted = true;

    async function fetchProfile() {
      try {
        setLoading(true);
        const response = await fetch('/api/user');
        if (!response.ok) {
          throw new Error('Failed to load profile');
        }
        const data = await response.json();
        if (!mounted) return;
        setProfile((prev) => ({
          balance: data?.balance ?? prev.balance ?? 0,
          subDays: data?.subscriptionDays ?? prev.subDays ?? 0,
          telegramId: data?.telegramId ?? prev.telegramId ?? '000000000',
          lastLogin: data?.lastLogin ?? prev.lastLogin
        }));
        setLoading(false);
      } catch (err) {
        console.error('home-profile-error', err);
        if (!mounted) return;
        setError('Unable to load profile. Showing cached data.');
        setLoading(false);
      }
    }

    fetchProfile();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    setActivity((prev) => {
      if (prev.length) return prev;
      return Array.from({ length: 5 }).map(() => {
        const name = ARABIC_NAMES[Math.floor(Math.random() * ARABIC_NAMES.length)];
        const message = FAKE_MESSAGES[Math.floor(Math.random() * FAKE_MESSAGES.length)];
        return { name, message, time: Date.now() - Math.random() * 10 * 60 * 1000 };
      });
    });

    const interval = setInterval(() => {
      const name = ARABIC_NAMES[Math.floor(Math.random() * ARABIC_NAMES.length)];
      const message = FAKE_MESSAGES[Math.floor(Math.random() * FAKE_MESSAGES.length)];
      setActivity((prev) => [{ name, message, time: Date.now() }, ...prev].slice(0, 15));
    }, 60_000);

    return () => clearInterval(interval);
  }, []);

  const cards = useMemo(
    () => [
      {
        title: t.remainingSubscription,
        value: `${profile.subDays} days`,
        gradient: 'from-accent/50 to-transparent'
      },
      {
        title: t.balance,
        value: `$${Number(profile.balance).toLocaleString()}`,
        gradient: 'from-emerald-500/40 to-transparent'
      },
      {
        title: t.telegramId,
        value: profile.telegramId,
        gradient: 'from-sky-500/40 to-transparent'
      },
      {
        title: t.lastLogin,
        value: dayjs(profile.lastLogin).format('MMM D, YYYY HH:mm'),
        gradient: 'from-amber-500/40 to-transparent'
      }
    ],
    [profile, t]
  );

  return (
    <section className="space-y-8">
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.title}
            className={`rounded-2xl border border-white/5 bg-gradient-to-br ${card.gradient} p-6 shadow-glow backdrop-blur transition hover:border-accent/60`}
          >
            <p className="text-sm text-white/60">{card.title}</p>
            <p className="mt-2 text-2xl font-semibold text-white">{card.value}</p>
          </div>
        ))}
      </div>

      {error && <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-white/5 bg-white/5 p-6 shadow-glow backdrop-blur">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Account overview</h2>
            {loading && <span className="text-xs text-white/50">Loading...</span>}
          </div>
          <dl className="mt-6 space-y-4 text-sm text-white/70">
            <div className="flex items-center justify-between">
              <dt>Status</dt>
              <dd className="text-emerald-400">Active</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt>Plan</dt>
              <dd>Pro • Auto + Manual</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt>Next renewal</dt>
              <dd>{dayjs().add(profile.subDays, 'day').format('MMM D, YYYY')}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-3xl border border-white/5 bg-white/5 p-6 shadow-glow backdrop-blur">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">{t.fakeActivity}</h2>
            <span className="text-xs text-white/50">1 alert / min</span>
          </div>
          <div className="mt-6 space-y-4 overflow-y-auto pr-1 scrollbar-thin" style={{ maxHeight: '320px' }}>
            {activity.map((entry) => (
              <NotificationCard key={entry.time + entry.name} entry={entry} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default Home;
