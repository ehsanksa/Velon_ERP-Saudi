export const LOCALE_CHANGE_EVENT = 'velon-locale-changed';

export type AppLocale = 'ar' | 'en';

export function emitLocaleChange(language: AppLocale) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(LOCALE_CHANGE_EVENT, { detail: language }));
}
