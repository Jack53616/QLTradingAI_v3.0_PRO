import { Fragment, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Bars3Icon, Cog6ToothIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { NavLink, Outlet } from 'react-router-dom';
import clsx from 'clsx';
import { LANGUAGES, useLanguage } from '../lib/i18n.js';
import SettingsDrawer from './SettingsDrawer.jsx';

const navigation = [
  { nameKey: 'home', to: '/' },
  { nameKey: 'markets', to: '/markets' },
  { nameKey: 'trades', to: '/trades' },
  { nameKey: 'withdraw', to: '/withdraw' },
  { nameKey: 'support', to: '/support' },
  { nameKey: 'admin', to: '/admin' }
];

function LanguageSelect() {
  const { language, setLanguage } = useLanguage();

  return (
    <select
      aria-label="language selector"
      className="mt-6 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 backdrop-blur-md focus:border-accent focus:outline-none"
      value={language}
      onChange={(event) => setLanguage(event.target.value)}
    >
      {Object.values(LANGUAGES).map((lang) => (
        <option key={lang.code} value={lang.code} className="bg-base text-white">
          {lang.label}
        </option>
      ))}
    </select>
  );
}

function DesktopSidebar({ onOpenSettings }) {
  const { t } = useLanguage();
  return (
    <div className="hidden w-64 flex-shrink-0 border-r border-white/5 bg-white/5/10 px-4 py-8 backdrop-blur xl:block">
      <div className="flex items-center justify-between">
        <span className="text-lg font-semibold text-white">QL Wallet</span>
        <button
          type="button"
          onClick={onOpenSettings}
          className="rounded-full border border-white/10 bg-accent/30 p-2 text-accent shadow-glow transition hover:bg-accent/50 hover:text-white"
        >
          <Cog6ToothIcon className="h-5 w-5" />
        </button>
      </div>
      <nav className="mt-10 space-y-2">
        {navigation.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              clsx(
                'flex items-center rounded-xl px-4 py-2 text-sm font-medium transition',
                isActive
                  ? 'bg-accent/40 text-white shadow-glow'
                  : 'text-white/70 hover:bg-white/10 hover:text-white'
              )
            }
          >
            {t[item.nameKey]}
          </NavLink>
        ))}
      </nav>
      <LanguageSelect />
    </div>
  );
}

function MobileSidebar({ open, setOpen, onOpenSettings }) {
  const { t } = useLanguage();

  return (
    <Transition.Root show={open} as={Fragment}>
      <Dialog as="div" className="relative z-40 xl:hidden" onClose={setOpen}>
        <Transition.Child
          as={Fragment}
          enter="transition-opacity ease-linear duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="transition-opacity ease-linear duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/60" />
        </Transition.Child>

        <div className="fixed inset-0 flex">
          <Transition.Child
            as={Fragment}
            enter="transition ease-in-out duration-300 transform"
            enterFrom="-translate-x-full"
            enterTo="translate-x-0"
            leave="transition ease-in-out duration-300 transform"
            leaveFrom="translate-x-0"
            leaveTo="-translate-x-full"
          >
            <Dialog.Panel className="relative flex w-full max-w-xs flex-1 flex-col bg-base/95 px-6 py-8 backdrop-blur">
              <div className="flex items-center justify-between">
                <span className="text-lg font-semibold text-white">QL Wallet</span>
                <button onClick={() => setOpen(false)} className="rounded-full border border-white/10 p-2 text-white/70">
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
              <nav className="mt-10 space-y-2">
                {navigation.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setOpen(false)}
                    className={({ isActive }) =>
                      clsx(
                        'flex items-center rounded-xl px-4 py-2 text-sm font-medium transition',
                        isActive ? 'bg-accent/40 text-white shadow-glow' : 'text-white/70 hover:bg-white/10 hover:text-white'
                      )
                    }
                  >
                    {t[item.nameKey]}
                  </NavLink>
                ))}
              </nav>
              <LanguageSelect />
              <button
                type="button"
                onClick={() => {
                  onOpenSettings();
                  setOpen(false);
                }}
                className="mt-6 flex items-center justify-center rounded-xl border border-white/10 bg-accent/40 px-4 py-2 text-sm font-semibold text-white shadow-glow"
              >
                <Cog6ToothIcon className="mr-2 h-5 w-5" /> {t.settings}
              </button>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition.Root>
  );
}

function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { t } = useLanguage();
  const content = children ?? <Outlet />;

  return (
    <div className="min-h-screen bg-base/95 text-white">
      <MobileSidebar open={sidebarOpen} setOpen={setSidebarOpen} onOpenSettings={() => setSettingsOpen(true)} />
      <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <div className="flex">
        <DesktopSidebar onOpenSettings={() => setSettingsOpen(true)} />
        <div className="flex min-h-screen flex-1 flex-col">
          <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/5 bg-black/50 px-6 py-4 backdrop-blur">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="inline-flex rounded-full border border-white/10 bg-white/5 p-2 text-white/70 transition hover:text-white xl:hidden"
              >
                <Bars3Icon className="h-6 w-6" />
              </button>
              <h1 className="text-lg font-semibold text-white/90">{t.quickActions}</h1>
            </div>
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="hidden items-center gap-2 rounded-full border border-white/10 bg-accent/30 px-4 py-2 text-sm font-semibold text-white shadow-glow transition hover:bg-accent/50 hover:text-white xl:flex"
            >
              <Cog6ToothIcon className="h-5 w-5" /> {t.settings}
            </button>
          </header>
          <main className="relative flex-1 overflow-y-auto bg-white/5/5 px-4 py-8 sm:px-8">
            <div className="mx-auto w-full max-w-6xl space-y-6">{content}</div>
          </main>
        </div>
      </div>
    </div>
  );
}

export default Layout;
