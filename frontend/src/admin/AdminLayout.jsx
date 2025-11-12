import { Fragment, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import {
  Bars3Icon,
  ChartPieIcon,
  MegaphoneIcon,
  QueueListIcon,
  RectangleStackIcon,
  UsersIcon,
  XMarkIcon,
  ArrowLeftOnRectangleIcon
} from '@heroicons/react/24/outline';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAdmin } from './AdminContext.jsx';

const navigation = [
  { name: 'Users', to: 'users', icon: UsersIcon },
  { name: 'Trades', to: 'trades', icon: RectangleStackIcon },
  { name: 'Withdrawals', to: 'withdrawals', icon: QueueListIcon },
  { name: 'Notifications', to: 'notifications', icon: MegaphoneIcon },
  { name: 'Analytics', to: 'analytics', icon: ChartPieIcon }
];

function classNames(...classes) {
  return classes.filter(Boolean).join(' ');
}

function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { logout, profile } = useAdmin();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="flex min-h-screen bg-base/95 text-white">
      <Transition.Root show={sidebarOpen} as={Fragment}>
        <Dialog as="div" className="relative z-40 lg:hidden" onClose={setSidebarOpen}>
          <Transition.Child
            as={Fragment}
            enter="transition-opacity ease-linear duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="transition-opacity ease-linear duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/70" />
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
              <Dialog.Panel className="relative flex w-full max-w-xs flex-1 flex-col border-r border-white/10 bg-black/80 p-6 backdrop-blur">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-semibold">QL Admin</span>
                  <button
                    type="button"
                    className="rounded-full border border-white/10 p-2 text-white/70"
                    onClick={() => setSidebarOpen(false)}
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>
                <nav className="mt-10 space-y-2">
                  {navigation.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={() => setSidebarOpen(false)}
                      className={({ isActive }) =>
                        classNames(
                          isActive ? 'bg-accent/50 text-white shadow-glow' : 'text-white/70 hover:bg-white/10 hover:text-white',
                          'flex items-center gap-3 rounded-xl px-4 py-2 text-sm font-medium transition'
                        )
                      }
                    >
                      <item.icon className="h-5 w-5" />
                      {item.name}
                    </NavLink>
                  ))}
                </nav>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition.Root>

      <div className="hidden w-72 flex-shrink-0 flex-col border-r border-white/10 bg-black/70 p-8 backdrop-blur lg:flex">
        <div>
          <span className="text-xl font-semibold">QL Wallet Admin</span>
          <p className="mt-2 text-xs text-white/50">Secure controls for power users.</p>
        </div>
        <nav className="mt-10 space-y-2">
          {navigation.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                classNames(
                  isActive ? 'bg-accent/60 text-white shadow-glow' : 'text-white/70 hover:bg-white/10 hover:text-white',
                  'flex items-center gap-3 rounded-xl px-4 py-2 text-sm font-medium transition'
                )
              }
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/10 bg-black/60 px-6 py-4 backdrop-blur">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="rounded-full border border-white/10 p-2 text-white/70 transition hover:text-white lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Bars3Icon className="h-6 w-6" />
            </button>
            <div>
              <h1 className="text-lg font-semibold text-white/90">Admin Panel</h1>
              <p className="text-xs text-white/50">Manage users, trades, and risk from one place.</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right text-xs">
              <p className="font-semibold text-white/80">{profile?.name || 'QL Admin'}</p>
              <p className="text-white/50">{profile?.email || 'admin@qlwallet.local'}</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white/80 transition hover:bg-red-500/60 hover:text-white"
            >
              <ArrowLeftOnRectangleIcon className="h-4 w-4" /> Logout
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto bg-white/5/5 px-4 py-6 sm:px-8">
          <div className="mx-auto w-full max-w-7xl space-y-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

export default AdminLayout;
