/** ISO country catalog with default currency for signup and workspace localization. */
export const COUNTRY_CATALOG = [
  { code: 'AF', label: 'Afghanistan', currency: 'AFN' },
  { code: 'BH', label: 'Bahrain', currency: 'BHD' },
  { code: 'IN', label: 'India', currency: 'INR' },
  { code: 'OM', label: 'Oman', currency: 'OMR' },
  { code: 'QA', label: 'Qatar', currency: 'QAR' },
  { code: 'SA', label: 'Saudi Arabia', currency: 'SAR' },
  { code: 'AE', label: 'United Arab Emirates', currency: 'AED' },
  { code: 'KW', label: 'Kuwait', currency: 'KWD' },
  { code: 'US', label: 'United States', currency: 'USD' },
  { code: 'GB', label: 'United Kingdom', currency: 'GBP' },
  { code: 'DE', label: 'Germany', currency: 'EUR' },
  { code: 'FR', label: 'France', currency: 'EUR' },
  { code: 'SG', label: 'Singapore', currency: 'SGD' },
  { code: 'AU', label: 'Australia', currency: 'AUD' },
  { code: 'CA', label: 'Canada', currency: 'CAD' },
  { code: 'JP', label: 'Japan', currency: 'JPY' },
  { code: 'CN', label: 'China', currency: 'CNY' },
  { code: 'PK', label: 'Pakistan', currency: 'PKR' },
  { code: 'BD', label: 'Bangladesh', currency: 'BDT' },
  { code: 'NP', label: 'Nepal', currency: 'NPR' },
  { code: 'LK', label: 'Sri Lanka', currency: 'LKR' },
  { code: 'MY', label: 'Malaysia', currency: 'MYR' },
  { code: 'TH', label: 'Thailand', currency: 'THB' },
  { code: 'ID', label: 'Indonesia', currency: 'IDR' },
  { code: 'PH', label: 'Philippines', currency: 'PHP' },
  { code: 'EG', label: 'Egypt', currency: 'EGP' },
  { code: 'ZA', label: 'South Africa', currency: 'ZAR' },
  { code: 'NG', label: 'Nigeria', currency: 'NGN' },
  { code: 'BR', label: 'Brazil', currency: 'BRL' },
  { code: 'MX', label: 'Mexico', currency: 'MXN' },
  { code: 'OTHER', label: 'Other / not listed', currency: 'USD' },
] as const;

export type CountryCode = (typeof COUNTRY_CATALOG)[number]['code'];

export const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: '₹',
  USD: '$',
  AED: 'د.إ',
  SAR: '﷼',
  BHD: '.د.ب',
  OMR: 'ر.ع.',
  QAR: 'ر.ق',
  KWD: 'د.ك',
  GBP: '£',
  EUR: '€',
  SGD: 'S$',
  CAD: 'C$',
  AUD: 'A$',
  JPY: '¥',
  CNY: '¥',
  PKR: '₨',
  BDT: '৳',
  NPR: '₨',
  LKR: 'Rs',
  MYR: 'RM',
  THB: '฿',
  IDR: 'Rp',
  PHP: '₱',
  EGP: 'E£',
  ZAR: 'R',
  NGN: '₦',
  BRL: 'R$',
  MXN: 'MX$',
};

export const TIMEZONE_OPTIONS = [
  { value: 'Asia/Riyadh', label: 'Asia/Riyadh (AST)' },
  { value: 'Asia/Dubai', label: 'Asia/Dubai (GST)' },
  { value: 'Asia/Kolkata', label: 'Asia/Kolkata (IST)' },
  { value: 'Asia/Muscat', label: 'Asia/Muscat (GST)' },
  { value: 'Asia/Qatar', label: 'Asia/Qatar (AST)' },
  { value: 'Asia/Kuwait', label: 'Asia/Kuwait (AST)' },
  { value: 'Asia/Bahrain', label: 'Asia/Bahrain (AST)' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore (SGT)' },
  { value: 'Europe/London', label: 'Europe/London (GMT/BST)' },
  { value: 'Europe/Berlin', label: 'Europe/Berlin (CET)' },
  { value: 'America/New_York', label: 'America/New_York (EST)' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (PST)' },
  { value: 'UTC', label: 'UTC' },
] as const;

export const DATE_FORMAT_OPTIONS = [
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
] as const;

export const NUMBER_FORMAT_OPTIONS = [
  { value: 'ar-SA', label: 'Arabic (Saudi Arabia)' },
  { value: 'en-SA', label: 'English (Saudi Arabia)' },
  { value: 'en-US', label: 'US (1,234,567.89)' },
  { value: 'en-GB', label: 'UK (1,234,567.89)' },
  { value: 'de-DE', label: 'German (1.234.567,89)' },
] as const;

export function getCountryByCode(code: string) {
  return COUNTRY_CATALOG.find((row) => row.code === code);
}

export function getCountryDefaultCurrency(code: string): string {
  return getCountryByCode(code)?.currency ?? 'SAR';
}

export function getCurrencySymbol(currencyCode: string): string {
  return CURRENCY_SYMBOLS[currencyCode] ?? currencyCode;
}

export function formatCurrencyLabel(currencyCode: string): string {
  const symbol = getCurrencySymbol(currencyCode);
  return `${currencyCode} — ${symbol}`;
}

export function defaultTimezoneForCountry(code: string): string {
  const map: Record<string, string> = {
    IN: 'Asia/Kolkata',
    AE: 'Asia/Dubai',
    SA: 'Asia/Riyadh',
    OM: 'Asia/Muscat',
    QA: 'Asia/Qatar',
    KW: 'Asia/Kuwait',
    BH: 'Asia/Bahrain',
    SG: 'Asia/Singapore',
    GB: 'Europe/London',
    US: 'America/New_York',
    DE: 'Europe/Berlin',
    FR: 'Europe/Berlin',
  };
  return map[code] ?? 'UTC';
}

export function defaultDateFormatForCountry(code: string): string {
  if (code === 'US') return 'MM/DD/YYYY';
  if (
    code === 'IN' ||
    code === 'GB' ||
    code === 'AE' ||
    code === 'SA' ||
    code === 'BH' ||
    code === 'OM' ||
    code === 'QA' ||
    code === 'KW'
  ) {
    return 'DD/MM/YYYY';
  }
  return 'YYYY-MM-DD';
}

export function defaultNumberFormatForCountry(code: string): string {
  if (code === 'US') return 'en-US';
  if (code === 'GB') return 'en-GB';
  if (code === 'SA') return 'ar-SA';
  if (code === 'AE' || code === 'BH' || code === 'OM' || code === 'QA' || code === 'KW') {
    return 'ar-SA';
  }
  if (code === 'DE' || code === 'FR') return 'de-DE';
  return 'en-US';
}

export type WorkspaceMoneyFormat = {
  currencyCode: string;
  currencySymbol?: string | null;
  numberFormat?: string | null;
};

export function formatHijriDate(value: Date | string, timeZone = 'Asia/Riyadh'): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat('ar-SA-u-ca-islamic', {
    dateStyle: 'medium',
    timeZone,
  }).format(date);
}

/** Digit system follows the interface language, not the workspace’s stored number format. */
export function numberFormatForLanguage(language: 'ar' | 'en'): string {
  return language === 'ar' ? 'ar-SA-u-nu-arab' : 'en-SA-u-nu-latn';
}

export function formatWorkspaceMoney(amount: number, format: WorkspaceMoneyFormat): string {
  const currencyCode = format.currencyCode || 'SAR';
  const locale = format.numberFormat?.trim() || 'en-SA-u-nu-latn';
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    const symbol = format.currencySymbol?.trim() || getCurrencySymbol(currencyCode);
    return `${symbol}${new Intl.NumberFormat(locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount)}`;
  }
}

export function isKnownCountryCode(code: string): boolean {
  const normalized = code.trim().toUpperCase();
  return normalized === 'OTHER' || /^[A-Z]{2}$/.test(normalized);
}

export function isKnownCurrencyCode(code: string): boolean {
  return /^[A-Z]{3}$/.test(code.trim().toUpperCase());
}
