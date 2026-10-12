import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { Menu } from 'lucide-react';
import { BrandLogoLink } from '@/components/marketing/brand-logo-link';
import { VelonLogo } from '@/components/marketing/velon-logo';
import { LanguageSwitch } from '@/components/shared/language-switch';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { loginSearch } from '@/lib/auth/login-utils';
import { useT } from '@/lib/i18n/locale-context';

const NAV_LINKS = [
  { to: '/features', label: 'Features' },
  { to: '/industries', label: 'Industries' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/about', label: 'About' },
  { to: '/contact', label: 'Contact' },
  { to: '/help', label: 'Help' },
] as const;

export function SiteHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const t = useT();

  return (
    <header className="border-border/60 bg-background/80 sticky top-0 z-50 border-b backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <BrandLogoLink className="flex shrink-0 items-center">
          <VelonLogo
            slot="navbar"
            size="md"
            alt=""
          />
        </BrandLogoLink>

        <nav className="text-muted-foreground hidden items-center gap-8 text-sm font-medium md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="hover:text-foreground"
            >
              {t(link.label)}
            </Link>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <LanguageSwitch />
          <Button
            size="sm"
            variant="outline"
            className="border-border"
            asChild
          >
            <Link
              to="/login"
              search={loginSearch({ tab: 'signin' })}
            >
              {t('Login')}
            </Link>
          </Button>

          <Button
            size="sm"
            className="bg-gradient-primary shadow-glow hidden text-white hover:opacity-95 md:inline-flex"
            asChild
          >
            <Link to="/contact">{t('Contact sales')}</Link>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 md:hidden"
            type="button"
            aria-label={t('Open navigation menu')}
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <Sheet
        open={mobileOpen}
        onOpenChange={setMobileOpen}
      >
        <SheetContent
          side="right"
          className="w-[min(100vw-2rem,20rem)]"
        >
          <SheetHeader>
            <SheetTitle>{t('Menu')}</SheetTitle>
          </SheetHeader>
          <div className="mt-6">
            <LanguageSwitch />
          </div>
          <nav className="mt-4 flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-lg px-3 py-2.5 text-sm font-medium"
                onClick={() => setMobileOpen(false)}
              >
                {t(link.label)}
              </Link>
            ))}
            <div className="border-border mt-4 border-t pt-4">
              <Button
                className="bg-gradient-primary w-full text-white hover:opacity-95"
                asChild
              >
                <Link
                  to="/contact"
                  onClick={() => setMobileOpen(false)}
                >
                  {t('Contact sales')}
                </Link>
              </Button>
            </div>
          </nav>
        </SheetContent>
      </Sheet>
    </header>
  );
}
