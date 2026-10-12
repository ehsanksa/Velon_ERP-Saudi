import { useLocale } from '@/lib/i18n/locale-context';
import { cn } from '@/lib/utils';

export function LanguageSwitch({ tone = 'default' }: { tone?: 'default' | 'inverse' }) {
  const { locale, setLocale, t } = useLocale();
  const inverse = tone === 'inverse';

  return (
    <div
      role="group"
      aria-label={t('Language')}
      className={cn(
        'inline-flex shrink-0 rounded-full border p-0.5 text-xs font-semibold',
        inverse ? 'border-white/20' : 'border-border bg-background/80',
      )}
    >
      <button
        type="button"
        aria-pressed={locale === 'ar'}
        className={cn(
          'rounded-full px-2.5 py-1 transition',
          locale === 'ar'
            ? inverse
              ? 'bg-white text-[#12294d]'
              : 'bg-foreground text-background'
            : inverse
              ? 'text-white/75 hover:text-white'
              : 'text-muted-foreground hover:text-foreground',
        )}
        onClick={() => setLocale('ar')}
      >
        العربية
      </button>
      <button
        type="button"
        aria-pressed={locale === 'en'}
        className={cn(
          'rounded-full px-2.5 py-1 transition',
          locale === 'en'
            ? inverse
              ? 'bg-white text-[#12294d]'
              : 'bg-foreground text-background'
            : inverse
              ? 'text-white/75 hover:text-white'
              : 'text-muted-foreground hover:text-foreground',
        )}
        onClick={() => setLocale('en')}
      >
        English
      </button>
    </div>
  );
}
