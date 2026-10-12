import { AR } from '@/lib/i18n/ar';
import type { AppLocale } from '@/lib/i18n/events';

export function translate(
  locale: AppLocale,
  source: string,
  vars?: Record<string, string | number>,
): string {
  const mapped = locale === 'ar' ? (AR[source] ?? source) : source;
  if (!vars) return mapped;
  return mapped.replace(/\{(\w+)\}/g, (_, key: string) =>
    vars[key] === undefined ? `{${key}}` : String(vars[key]),
  );
}
