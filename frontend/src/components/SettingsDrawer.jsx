import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import dayjs from 'dayjs';
import { useLanguage } from '../lib/i18n.js';

const brokerDetails = {
  broker: 'XM Trading',
  accountName: 'Mohammad',
  email: 'client@qlwallet.ai',
  type: 'Standard',
  status: 'Verified'
};

function InfoRow({ label, value }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-white/5 bg-white/5 px-4 py-3 text-sm text-white/70">
      <span>{label}</span>
      <span className="font-medium text-white">{value}</span>
    </div>
  );
}

function SettingsDrawer({ open, onClose }) {
  const { t } = useLanguage();
  const lastSynced = dayjs().format('MMM D, YYYY HH:mm');

  return (
    <Transition.Root show={open} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/60" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full">
              <Transition.Child
                as={Fragment}
                enter="transform transition ease-in-out duration-300"
                enterFrom="translate-x-full"
                enterTo="translate-x-0"
                leave="transform transition ease-in-out duration-300"
                leaveFrom="translate-x-0"
                leaveTo="translate-x-full"
              >
                <Dialog.Panel className="pointer-events-auto w-screen max-w-md border-l border-white/10 bg-base/95 p-8 text-white shadow-2xl shadow-accent/20 backdrop-blur">
                  <div className="flex items-start justify-between">
                    <Dialog.Title className="text-xl font-semibold text-white">{t.settings}</Dialog.Title>
                    <button onClick={onClose} className="rounded-full border border-white/10 px-4 py-1 text-sm text-white/70 transition hover:text-white">
                      {t.close}
                    </button>
                  </div>

                  <div className="mt-8 space-y-4 text-sm">
                    <InfoRow label="Broker" value={brokerDetails.broker} />
                    <InfoRow label="Account name" value={brokerDetails.accountName} />
                    <InfoRow label="Email" value={brokerDetails.email} />
                    <InfoRow label="Account type" value={brokerDetails.type} />
                    <InfoRow label="Status" value={brokerDetails.status} />
                    <InfoRow label="Last synced" value={lastSynced} />
                  </div>

                  <a
                    href="https://www.xm.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-accent/40 px-5 py-3 text-sm font-semibold text-white shadow-glow transition hover:bg-accent/60"
                  >
                    Open XM Dashboard <ArrowTopRightOnSquareIcon className="h-5 w-5" />
                  </a>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
}

export default SettingsDrawer;
