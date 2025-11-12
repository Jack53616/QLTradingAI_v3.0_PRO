const SUPPORT_CHANNELS = [
  {
    title: 'Telegram concierge',
    description: 'Chat with our trading desk for fast portfolio updates.',
    action: {
      label: '@qlsupport',
      href: 'https://t.me/qlsupport'
    }
  },
  {
    title: 'WhatsApp hotline',
    description: 'Reach the 24/7 support desk for withdrawals and deposits.',
    action: {
      label: 'Message us',
      href: 'https://wa.me/message/P6BBPSDL2CC4D1'
    }
  },
  {
    title: 'Email escalation',
    description: 'Escalate compliance or account issues directly to management.',
    action: {
      label: 'support@qlwallet.ai',
      href: 'mailto:support@qlwallet.ai'
    }
  }
];

const FAQ = [
  {
    q: 'How fast are withdrawals processed?',
    a: 'Withdrawals are reviewed by compliance within 12 hours. Approved requests are released instantly after verification.'
  },
  {
    q: 'Can I trade manually?',
    a: 'Yes. Toggle manual trading on the Markets page. If disabled, it means the risk desk is temporarily limiting manual entries.'
  },
  {
    q: 'How do I change my language?',
    a: 'Use the language selector in the sidebar. Your preference is saved to your device automatically.'
  }
];

function Support() {
  return (
    <section className="space-y-8">
      <div className="rounded-3xl border border-white/5 bg-white/5 p-6 shadow-glow backdrop-blur">
        <h2 className="text-lg font-semibold text-white">Need a hand?</h2>
        <p className="mt-2 text-sm text-white/60">
          Our multilingual concierge team is on standby 24/7 to help with subscriptions, trading insights, and withdrawal updates.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {SUPPORT_CHANNELS.map((channel) => (
            <div key={channel.title} className="rounded-2xl border border-white/5 bg-black/40 p-5">
              <h3 className="text-base font-semibold text-white">{channel.title}</h3>
              <p className="mt-2 text-sm text-white/60">{channel.description}</p>
              <a
                href={channel.action.href}
                className="mt-4 inline-flex items-center rounded-full border border-white/10 bg-accent/40 px-4 py-2 text-xs font-semibold text-white shadow-glow transition hover:bg-accent/60"
              >
                {channel.action.label}
              </a>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-white/5 bg-white/5 p-6 shadow-glow backdrop-blur">
        <h3 className="text-lg font-semibold text-white">Frequently asked</h3>
        <div className="mt-4 space-y-4">
          {FAQ.map((item) => (
            <div key={item.q} className="rounded-2xl border border-white/5 bg-black/40 p-4">
              <p className="text-sm font-semibold text-white">{item.q}</p>
              <p className="mt-2 text-sm text-white/60">{item.a}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default Support;
