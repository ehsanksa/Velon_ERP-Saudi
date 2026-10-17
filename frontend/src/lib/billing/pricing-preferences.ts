import { isSaudiBilling, type PlanRegionalPrices } from '@velon/shared';
import { emitLocaleChange } from '@/lib/i18n/events';
import {
  countryOptions,
  currencyOptions,
  getCountryDefaultCurrency,
  getSarPerUnit,
  type PricingCountry,
  type PricingCurrency,
} from '@/lib/shared/country-currency-catalog';

export type { PricingCountry, PricingCurrency };

export type PricingLanguage = 'en' | 'ar';

export type MarketingBillingInterval = 'MONTHLY' | 'YEARLY';

export type PricingPreference = {
  country: PricingCountry;
  currency: PricingCurrency;
  language: PricingLanguage;
};

export const PRICING_PREFERENCE_KEY = 'velon-pricing-preference-v2';
export const PRICING_PROMPT_DISMISSED_KEY = 'velon-pricing-prompt-dismissed-v2';
export const LANGUAGE_CONFIRMED_KEY = 'velon-language-confirmed-v1';

export const defaultPricingPreference: PricingPreference = {
  country: 'SA',
  currency: 'SAR',
  language: 'ar',
};

export { countryOptions, currencyOptions, getCountryDefaultCurrency };

export const LANGUAGE_LABELS: Record<PricingLanguage, string> = {
  en: 'English',
  ar: 'العربية',
};

const GCC_COUNTRIES = new Set<PricingCountry>(['SA', 'AE', 'BH', 'OM', 'QA', 'KW']);

export function getCountryLabel(country: PricingCountry): string {
  return countryOptions.find((option) => option.value === country)?.label ?? 'your region';
}

/** Languages offered on first-visit confirmation for a detected country. */
export function languageChoicesForCountry(country: PricingCountry): PricingLanguage[] {
  if (GCC_COUNTRIES.has(country) || country === 'EG') return ['ar', 'en'];
  return ['en', 'ar'];
}

export function hasConfirmedLanguage(): boolean {
  if (typeof window === 'undefined') return true;
  return (
    window.localStorage.getItem(LANGUAGE_CONFIRMED_KEY) === 'true' ||
    window.localStorage.getItem(PRICING_PROMPT_DISMISSED_KEY) === 'true'
  );
}

export function markLanguageConfirmed() {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LANGUAGE_CONFIRMED_KEY, 'true');
  window.localStorage.setItem(PRICING_PROMPT_DISMISSED_KEY, 'true');
}

export function formatMarketingMonthlyPrice(
  amount: number,
  currency: PricingCurrency,
  language: PricingLanguage,
) {
  const rounded = Math.max(Math.round(amount * 100) / 100, 0);
  const arabic = language === 'ar';
  try {
    return new Intl.NumberFormat(arabic ? 'ar-SA' : 'en-SA', {
      style: 'currency',
      currency,
      currencyDisplay: arabic ? 'symbol' : 'code',
      numberingSystem: arabic ? 'arab' : 'latn',
      maximumFractionDigits: 0,
    }).format(rounded);
  } catch {
    return `${currency} ${rounded}`;
  }
}

export function resolveMarketingPlanPrice(
  regionalPrices: PlanRegionalPrices | undefined,
  fallbackMonthlyPrice: number,
  preference: PricingPreference,
  interval: MarketingBillingInterval = 'MONTHLY',
): { amount: number; currency: PricingCurrency; monthlyEquivalent: number } {
  const saudi = isSaudiBilling(preference.country, preference.currency);

  if (!regionalPrices) {
    const monthly = fallbackMonthlyPrice;
    if (saudi) {
      const annual = monthly * 11;
      return interval === 'YEARLY'
        ? {
            amount: annual,
            currency: 'SAR',
            monthlyEquivalent: Math.round((annual / 12) * 100) / 100,
          }
        : { amount: monthly, currency: 'SAR', monthlyEquivalent: monthly };
    }
    if (preference.currency === 'USD') {
      const annual = monthly * 11;
      return interval === 'YEARLY'
        ? {
            amount: annual,
            currency: 'USD',
            monthlyEquivalent: Math.round((annual / 12) * 100) / 100,
          }
        : { amount: monthly, currency: 'USD', monthlyEquivalent: monthly };
    }
    const sarPerUnit = getSarPerUnit(preference.currency);
    const converted = monthly / sarPerUnit;
    return { amount: converted, currency: preference.currency, monthlyEquivalent: converted };
  }

  const table = saudi ? regionalPrices.saudi : regionalPrices.global;
  const monthlyPrice = saudi
    ? regionalPrices.saudi.monthlyPrice
    : preference.currency === 'USD'
      ? regionalPrices.global.monthlyPrice
      : regionalPrices.saudi.monthlyPrice / getSarPerUnit(preference.currency);

  if (saudi || preference.currency === 'USD') {
    const annualPrice = table.annualPrice;
    const currency = table.currency as PricingCurrency;
    if (interval === 'YEARLY') {
      return {
        amount: annualPrice,
        currency,
        monthlyEquivalent: Math.round((annualPrice / 12) * 100) / 100,
      };
    }
    return { amount: table.monthlyPrice, currency, monthlyEquivalent: table.monthlyPrice };
  }

  const sarPerUnit = getSarPerUnit(preference.currency);
  const annualConverted = table.annualPrice / sarPerUnit;
  const monthlyConverted = table.monthlyPrice / sarPerUnit;
  if (interval === 'YEARLY') {
    return {
      amount: annualConverted,
      currency: preference.currency,
      monthlyEquivalent: Math.round((annualConverted / 12) * 100) / 100,
    };
  }
  return {
    amount: monthlyConverted,
    currency: preference.currency,
    monthlyEquivalent: monthlyConverted,
  };
}

export function formatPlanPriceForPreference(
  plan: { regionalPrices?: PlanRegionalPrices; monthlyPrice: number },
  preference: PricingPreference,
  interval: MarketingBillingInterval = 'MONTHLY',
) {
  const { amount, currency } = resolveMarketingPlanPrice(
    plan.regionalPrices,
    plan.monthlyPrice,
    preference,
    interval,
  );
  return formatMarketingMonthlyPrice(amount, currency, preference.language);
}

export function formatPlanEffectiveMonthly(
  plan: { regionalPrices?: PlanRegionalPrices; monthlyPrice: number },
  preference: PricingPreference,
) {
  const { monthlyEquivalent, currency } = resolveMarketingPlanPrice(
    plan.regionalPrices,
    plan.monthlyPrice,
    preference,
    'YEARLY',
  );
  return formatMarketingMonthlyPrice(monthlyEquivalent, currency, preference.language);
}

function isValidLanguage(value: unknown): value is PricingLanguage {
  return value === 'en' || value === 'ar';
}

export function readPricingPreference(): PricingPreference {
  if (typeof window === 'undefined') return defaultPricingPreference;

  try {
    const raw = window.localStorage.getItem(PRICING_PREFERENCE_KEY);
    if (!raw) return defaultPricingPreference;
    const parsed = JSON.parse(raw) as Partial<PricingPreference>;
    const currency: PricingCurrency = currencyOptions.some(
      (option) => option.value === parsed.currency,
    )
      ? (parsed.currency as PricingCurrency)
      : defaultPricingPreference.currency;
    const country: PricingCountry = countryOptions.some((option) => option.value === parsed.country)
      ? (parsed.country as PricingCountry)
      : defaultPricingPreference.country;
    const language = isValidLanguage(parsed.language)
      ? parsed.language
      : defaultPricingPreference.language;

    return { country, currency, language };
  } catch {
    return defaultPricingPreference;
  }
}

export function savePricingPreference(preference: PricingPreference) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(PRICING_PREFERENCE_KEY, JSON.stringify(preference));
  applyPricingLanguage(preference.language);
  emitLocaleChange(preference.language);
}

const TIMEZONE_COUNTRY: Record<string, PricingCountry> = {
  'Asia/Kolkata': 'IN',
  'Asia/Calcutta': 'IN',
  'Asia/Dubai': 'AE',
  'Asia/Riyadh': 'SA',
  'Asia/Muscat': 'OM',
  'Asia/Bahrain': 'BH',
  'Asia/Qatar': 'QA',
  'Asia/Kuwait': 'KW',
  'Asia/Singapore': 'SG',
  'Europe/London': 'GB',
  'Europe/Berlin': 'DE',
  'Europe/Paris': 'FR',
  'America/New_York': 'US',
  'America/Los_Angeles': 'US',
  'America/Chicago': 'US',
};

export function detectVisitorPricingPreference(): PricingPreference {
  if (typeof window === 'undefined') return defaultPricingPreference;

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const languages = navigator.languages?.length ? navigator.languages : [navigator.language];

  let country: PricingCountry = TIMEZONE_COUNTRY[timeZone] ?? 'OTHER';
  if (country === 'OTHER') {
    if (languages.some((l) => /-IN\b/i.test(l))) country = 'IN';
    else if (languages.some((l) => /-AE\b|-SA\b|-BH\b|-OM\b|-QA\b|-KW\b/i.test(l))) {
      const match = languages.find((l) => /-(AE|SA|BH|OM|QA|KW)\b/i.test(l));
      const code = match?.split('-')[1]?.toUpperCase();
      if (
        code === 'AE' ||
        code === 'SA' ||
        code === 'BH' ||
        code === 'OM' ||
        code === 'QA' ||
        code === 'KW'
      ) {
        country = code;
      } else {
        country = 'AE';
      }
    } else if (languages.some((l) => /-DE\b/i.test(l))) country = 'DE';
    else if (languages.some((l) => /-GB\b/i.test(l))) country = 'GB';
    else if (languages.some((l) => /-US\b/i.test(l))) country = 'US';
  }

  const currency = getCountryDefaultCurrency(country);
  // Saudi edition: Arabic is the language on first visit. English is an explicit switch.
  return { country, currency, language: 'ar' };
}

/** Soft-apply region detection when the visitor has no saved preference yet. */
export function ensureDetectedPricingPreference(): PricingPreference {
  if (typeof window === 'undefined') return defaultPricingPreference;
  const raw = window.localStorage.getItem(PRICING_PREFERENCE_KEY);
  if (raw) {
    const saved = readPricingPreference();
    if (!hasConfirmedLanguage() && saved.language !== 'ar') {
      const next = { ...saved, language: 'ar' as const };
      savePricingPreference(next);
      return next;
    }
    return saved;
  }
  const detected = detectVisitorPricingPreference();
  savePricingPreference(detected);
  return detected;
}

export function applyPricingLanguage(language: PricingLanguage) {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = language === 'ar' ? 'ar-SA' : 'en-SA';
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
  }
}
