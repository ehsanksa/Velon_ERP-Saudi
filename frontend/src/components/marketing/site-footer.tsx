import { Link } from '@tanstack/react-router';
import { VELON_CONTACT_EMAIL } from '@velon/shared';
import { VelonLogo } from '@/components/marketing/velon-logo';
import type { PublicSiteContent } from '@/lib/cms/load-public';
import { useT } from '@/lib/i18n/locale-context';
import { cn } from '@/lib/utils';

type SiteFooterProps = {
  footer?: PublicSiteContent['footer'];
  contact?: PublicSiteContent['contact'];
  /** Navy band with the white footer lockup. Used on the platform sign-in surface. */
  appearance?: 'canvas' | 'navy';
};

export function SiteFooter({ footer, contact, appearance = 'canvas' }: SiteFooterProps = {}) {
  const t = useT();
  const tagline = footer?.tagline ?? 'VelonERP';
  const showTagline = tagline.trim().toLowerCase() !== 'velonerp';
  const onNavy = appearance === 'navy';
  const linkClass = onNavy ? 'hover:text-white' : 'hover:text-foreground';
  const email = footer?.email ?? contact?.email ?? VELON_CONTACT_EMAIL;
  const links = footer?.links ?? [
    { label: 'Features', href: '/features' },
    { label: 'Pricing', href: '/pricing' },
    { label: 'Contact', href: '/contact' },
  ];

  return (
    <footer
      className={
        onNavy
          ? 'border-t border-white/10 bg-[#071422] text-xs text-white/60'
          : 'border-border bg-background text-muted-foreground border-t text-xs'
      }
    >
      <div className="mx-auto max-w-7xl space-y-6 px-6 py-10">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row sm:items-start">
          <div className="flex flex-col items-center gap-2 sm:items-start">
            <VelonLogo
              slot="footer"
              tone={onNavy ? 'white' : 'auto'}
              size="sm"
            />
            {showTagline ? (
              <span className={onNavy ? 'font-medium text-white' : 'text-foreground font-medium'}>
                {tagline}
              </span>
            ) : null}
          </div>
          <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 sm:justify-end">
            <Link
              to="/privacy"
              className={linkClass}
            >
              {t('Privacy Policy')}
            </Link>
            <Link
              to="/terms"
              className={linkClass}
            >
              {t('Terms of Service')}
            </Link>
            <Link
              to="/refund-policy"
              className={linkClass}
            >
              {t('Refund Policy')}
            </Link>
            <Link
              to="/help"
              className={linkClass}
            >
              {t('Help')}
            </Link>
            {links.map((link) =>
              link.href.startsWith('/') ? (
                <Link
                  key={link.href}
                  to={link.href}
                  className={linkClass}
                >
                  {t(link.label)}
                </Link>
              ) : (
                <a
                  key={link.href}
                  href={link.href}
                  className={linkClass}
                >
                  {t(link.label)}
                </a>
              ),
            )}
          </nav>
        </div>

        <div
          className={cn(
            'border-t pt-6 text-center sm:text-start',
            onNavy ? 'border-white/10' : 'border-border/60',
          )}
        >
          <p className={cn('text-sm', onNavy ? 'text-white/85' : 'text-foreground/90')}>
            {t('Velon ERP Powered by')}{' '}
            <a
              href="https://archerstechnologies.com"
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'font-medium underline-offset-4 hover:underline',
                onNavy ? 'text-white' : 'text-foreground',
              )}
            >
              Archers Technologies
            </a>
          </p>
          <p className="mt-2">
            <a
              href={`mailto:${email}`}
              className={linkClass}
            >
              {email}
            </a>
            {contact?.phone ? (
              <>
                <span className="text-border mx-2">·</span>
                <span>{contact.phone}</span>
              </>
            ) : null}
          </p>
        </div>

        <p className="text-center text-[11px] sm:text-start">
          {t('© 2026 Archers Technologies. All rights reserved.')}
        </p>
      </div>
    </footer>
  );
}
