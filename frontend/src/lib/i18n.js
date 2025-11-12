import { createContext, useContext, useEffect, useMemo, useState } from 'react';

export const LANGUAGES = {
  en: { label: 'English', code: 'en' },
  ar: { label: 'العربية', code: 'ar' },
  tr: { label: 'Türkçe', code: 'tr' },
  de: { label: 'Deutsch', code: 'de' }
};

const STRINGS = {
  en: {
    home: 'Home',
    markets: 'Markets',
    trades: 'Trades',
    withdraw: 'Withdraw',
    support: 'Support',
    admin: 'Admin',
    settings: 'Settings',
    manualTradingUnavailable: 'Manual trading is currently unavailable.',
    close: 'Close',
    remainingSubscription: 'Remaining subscription days',
    telegramId: 'Telegram user ID',
    fakeActivity: 'Live community feed',
    lastLogin: 'Last login',
    balance: 'Balance',
    quickActions: 'Quick actions'
  },
  ar: {
    home: 'الرئيسية',
    markets: 'الأسواق',
    trades: 'الصفقات',
    withdraw: 'السحب',
    support: 'الدعم',
    admin: 'لوحة التحكم',
    settings: 'الإعدادات',
    manualTradingUnavailable: 'التداول اليدوي غير متاح حالياً.',
    close: 'إغلاق',
    remainingSubscription: 'أيام الاشتراك المتبقية',
    telegramId: 'معرف مستخدم تيليجرام',
    fakeActivity: 'تغذية المجتمع المباشرة',
    lastLogin: 'آخر تسجيل دخول',
    balance: 'الرصيد',
    quickActions: 'إجراءات سريعة'
  },
  tr: {
    home: 'Ana Sayfa',
    markets: 'Piyasalar',
    trades: 'İşlemler',
    withdraw: 'Çekim',
    support: 'Destek',
    admin: 'Yönetim',
    settings: 'Ayarlar',
    manualTradingUnavailable: 'Manuel işlem şu anda kullanılamıyor.',
    close: 'Kapat',
    remainingSubscription: 'Kalan abonelik günleri',
    telegramId: 'Telegram kullanıcı kimliği',
    fakeActivity: 'Canlı topluluk akışı',
    lastLogin: 'Son giriş',
    balance: 'Bakiye',
    quickActions: 'Hızlı işlemler'
  },
  de: {
    home: 'Startseite',
    markets: 'Märkte',
    trades: 'Trades',
    withdraw: 'Auszahlung',
    support: 'Support',
    admin: 'Admin',
    settings: 'Einstellungen',
    manualTradingUnavailable: 'Manueller Handel ist derzeit nicht verfügbar.',
    close: 'Schließen',
    remainingSubscription: 'Verbleibende Abonnementtage',
    telegramId: 'Telegram-Benutzer-ID',
    fakeActivity: 'Live-Community-Feed',
    lastLogin: 'Letzte Anmeldung',
    balance: 'Kontostand',
    quickActions: 'Schnellaktionen'
  }
};

const LanguageContext = createContext({
  language: 'en',
  setLanguage: () => {},
  t: STRINGS.en
});

const STORAGE_KEY = 'qlwallet.language';

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState('en');

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && STRINGS[stored]) {
      setLanguageState(stored);
    }
  }, []);

  const setLanguage = (value) => {
    setLanguageState(value);
    localStorage.setItem(STORAGE_KEY, value);
  };

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t: STRINGS[language] ?? STRINGS.en,
      strings: STRINGS
    }),
    [language]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}
