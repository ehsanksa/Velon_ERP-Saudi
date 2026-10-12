import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import type { LucideIcon } from 'lucide-react';
import { BrandLogoLink } from '@/components/marketing/brand-logo-link';
import { SiteFooter } from '@/components/marketing/site-footer';
import { VelonLogo } from '@/components/marketing/velon-logo';
import { VelonLogoMark } from '@/components/marketing/velon-logo-mark';
import { LanguageSwitch } from '@/components/shared/language-switch';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { useT } from '@/lib/i18n/locale-context';
import { cn } from '@/lib/utils';

export type AuthPortalSignal = {
  icon: LucideIcon;
  title: string;
  desc: string;
};

type AuthPortalShellProps = {
  variant: 'workspace' | 'platform';
  badge: string;
  portalLabel: string;
  portalTitle: string;
  headline: string;
  description: string;
  signals: AuthPortalSignal[];
  complianceIcon: LucideIcon;
  complianceText: ReactNode;
  crossLink?: { label: string; to: string; search?: Record<string, string | undefined> };
  children: ReactNode;
};

export function AuthPortalShell({
  variant,
  badge,
  portalLabel,
  portalTitle,
  headline,
  description,
  signals,
  complianceIcon: ComplianceIcon,
  complianceText,
  crossLink,
  children,
}: AuthPortalShellProps) {
  const isPlatform = variant === 'platform';
  const t = useT();

  return (
    <div
      className={cn(
        'min-h-screen',
        isPlatform ? 'bg-[#071422] text-white' : 'bg-background text-foreground',
      )}
    >
      <header
        className={cn(
          'sticky top-0 z-50 border-b backdrop-blur-xl',
          isPlatform ? 'border-white/10 bg-[#071422]/90' : 'border-border/60 bg-background/80',
        )}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <BrandLogoLink className="flex items-center">
            <VelonLogo
              slot="navbar"
              tone={isPlatform ? 'white' : 'auto'}
              size="md"
              alt=""
            />
          </BrandLogoLink>
          <div className="flex items-center gap-3">
            <LanguageSwitch tone={isPlatform ? 'inverse' : 'default'} />
            {crossLink ? (
              <Link
                to={crossLink.to}
                search={crossLink.search}
                className={cn(
                  'text-sm font-medium underline-offset-4 hover:underline',
                  isPlatform ? 'text-[#b7f3df]' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {t(crossLink.label)}
              </Link>
            ) : null}
          </div>
        </div>
      </header>

      <main className="relative overflow-hidden">
        {!isPlatform ? (
          <>
            <div className="bg-gradient-hero absolute inset-0" />
            <div className="bg-gradient-mesh absolute inset-0 opacity-30" />
          </>
        ) : (
          <>
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(0,130,91,0.22),_transparent_55%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_rgba(18,81,135,0.28),_transparent_50%)]" />
          </>
        )}

        <div className="relative mx-auto grid min-h-[calc(100vh-9rem)] max-w-7xl gap-8 px-6 py-14 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <section>
            <Badge
              variant="outline"
              className={cn(
                'rounded-full',
                isPlatform
                  ? 'border-[#5ee0b5]/40 bg-[#00825b]/15 text-[#d8fff2]'
                  : 'border-border bg-background/80',
              )}
            >
              {t(badge)}
            </Badge>

            <div className="mt-8 flex items-center gap-3">
              <VelonLogoMark
                size="lg"
                variant={isPlatform ? 'platform' : 'default'}
                className="shadow-elegant"
              />
              <div>
                <div
                  className={cn('text-sm', isPlatform ? 'text-white/55' : 'text-muted-foreground')}
                >
                  {t(portalLabel)}
                </div>
                <div className="text-xl font-semibold tracking-tight">{t(portalTitle)}</div>
              </div>
            </div>

            <h1
              className={cn(
                'mt-8 max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl',
                isPlatform && 'text-white',
              )}
            >
              {t(headline)}
            </h1>
            <p
              className={cn(
                'mt-4 max-w-2xl text-base leading-relaxed',
                isPlatform ? 'text-white/60' : 'text-muted-foreground',
              )}
            >
              {t(description)}
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {signals.map((item) => (
                <Card
                  key={item.title}
                  className={cn(
                    'p-4 backdrop-blur',
                    isPlatform
                      ? 'border-white/10 bg-white/[0.04]'
                      : 'border-border bg-background/80',
                  )}
                >
                  <item.icon
                    className={cn('h-5 w-5', isPlatform ? 'text-[#5ee0b5]' : 'text-primary')}
                  />
                  <div className="mt-3 text-sm font-semibold">{t(item.title)}</div>
                  <p
                    className={cn(
                      'mt-1 text-xs leading-relaxed',
                      isPlatform ? 'text-white/50' : 'text-muted-foreground',
                    )}
                  >
                    {t(item.desc)}
                  </p>
                </Card>
              ))}
            </div>

            <Card
              className={cn(
                'mt-6 p-4 text-sm backdrop-blur',
                isPlatform
                  ? 'border-[#5ee0b5]/25 bg-[#00825b]/10 text-white/70'
                  : 'border-border bg-background/80 text-muted-foreground',
              )}
            >
              <div className="flex gap-3">
                <ComplianceIcon
                  className={cn(
                    'mt-0.5 h-4 w-4 shrink-0',
                    isPlatform ? 'text-[#5ee0b5]' : 'text-primary',
                  )}
                />
                <div className="leading-relaxed [&_a]:underline [&_a]:underline-offset-2">
                  {typeof complianceText === 'string' ? t(complianceText) : complianceText}
                </div>
              </div>
            </Card>
          </section>

          <Card
            className={cn(
              'shadow-elegant p-6 backdrop-blur',
              isPlatform
                ? 'border-white/10 bg-[#102033]/95 text-white'
                : 'border-border bg-card/95',
            )}
          >
            {children}
          </Card>
        </div>
      </main>

      <SiteFooter appearance={isPlatform ? 'navy' : 'canvas'} />
    </div>
  );
}
