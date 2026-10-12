import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  applyPricingLanguage,
  ensureDetectedPricingPreference,
  hasConfirmedLanguage,
  LANGUAGE_CONFIRMED_KEY,
  markLanguageConfirmed,
  PRICING_PREFERENCE_KEY,
  PRICING_PROMPT_DISMISSED_KEY,
  readPricingPreference,
  savePricingPreference,
} from '@/lib/billing/pricing-preferences';
import { LOCALE_CHANGE_EVENT, type AppLocale } from '@/lib/i18n/events';
import { translate } from '@/lib/i18n/translate';

type LocaleContextValue = {
  locale: AppLocale;
  setLocale: (next: AppLocale) => void;
  t: (source: string, vars?: Record<string, string | number>) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

/** Runs in <head> before paint so direction matches a confirmed choice. Arabic is the default. */
export function localeBootScript() {
  return `try{var confirmed=localStorage.getItem(${JSON.stringify(LANGUAGE_CONFIRMED_KEY)})==="true"||localStorage.getItem(${JSON.stringify(PRICING_PROMPT_DISMISSED_KEY)})==="true";var lang="ar";if(confirmed){var raw=localStorage.getItem(${JSON.stringify(PRICING_PREFERENCE_KEY)});if(raw){var parsed=JSON.parse(raw);if(parsed.language==="en"||parsed.language==="ar")lang=parsed.language;}}document.documentElement.lang=lang==="ar"?"ar-SA":"en-SA";document.documentElement.dir=lang==="ar"?"rtl":"ltr";}catch(e){}`;
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<AppLocale>('ar');

  useEffect(() => {
    const stored = ensureDetectedPricingPreference();
    const language: AppLocale = hasConfirmedLanguage() ? stored.language : 'ar';
    setLocaleState(language);
    applyPricingLanguage(language);

    function onChange(event: Event) {
      const next = (event as CustomEvent<AppLocale>).detail;
      if (next === 'ar' || next === 'en') setLocaleState(next);
    }

    window.addEventListener(LOCALE_CHANGE_EVENT, onChange);
    return () => window.removeEventListener(LOCALE_CHANGE_EVENT, onChange);
  }, []);

  const setLocale = useCallback((next: AppLocale) => {
    const current = readPricingPreference();
    savePricingPreference({ ...current, language: next });
    markLanguageConfirmed();
    setLocaleState(next);
  }, []);

  const t = useCallback(
    (source: string, vars?: Record<string, string | number>) => translate(locale, source, vars),
    [locale],
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error('useLocale must be used within LocaleProvider');
  }
  return ctx;
}

export function useT() {
  return useLocale().t;
}
