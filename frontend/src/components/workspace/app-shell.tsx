import { useState, type ReactNode } from 'react';
import { Link, useRouterState } from '@tanstack/react-router';
import { Command, Menu, Search, Sun, type LucideIcon } from 'lucide-react';
import { isAdminNavItemActive, isWorkspaceNavItemActive } from '@velon/shared';
import { BrandLogoLink } from '@/components/marketing/brand-logo-link';
import { SiteFooter } from '@/components/marketing/site-footer';
import { VelonLogoMark } from '@/components/marketing/velon-logo-mark';
import { LanguageSwitch } from '@/components/shared/language-switch';
import { breadcrumbsFromPath, PageBreadcrumbs } from '@/components/shared/page-breadcrumbs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useT } from '@/lib/i18n/locale-context';
import type { LogoNav } from '@/lib/shared/logo-navigation';
import { cn } from '@/lib/utils';

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  badge?: string;
  /** When true, shows a "Soon" badge in the sidebar */
  comingSoon?: boolean;
  search?: Record<string, string>;
}
export interface NavGroup {
  label: string;
  items: NavItem[];
}

function SidebarNav({
  groups,
  path,
  isActive,
  onNavigate,
}: {
  groups: NavGroup[];
  path: string;
  isActive: (pathname: string, to: string, label: string) => boolean;
  onNavigate?: () => void;
}) {
  const t = useT();

  return (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-2">
      {groups.map((group) => (
        <div key={group.label}>
          <div className="text-sidebar-foreground/40 mb-1.5 px-3 text-[10px] font-medium tracking-[0.18em] uppercase">
            {t(group.label)}
          </div>
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const active = isActive(path, item.to, item.label);
              return (
                <Link
                  key={item.label}
                  to={item.to}
                  search={item.search}
                  onClick={onNavigate}
                  className={cn(
                    'group flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] transition',
                    active
                      ? 'bg-sidebar-primary/15 text-sidebar-primary-foreground ring-sidebar-primary/25 font-medium shadow-sm ring-1'
                      : 'text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-foreground',
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1">{t(item.label)}</span>
                  {(item.comingSoon || item.badge) && (
                    <span
                      className={cn(
                        'rounded-md px-1.5 py-0.5 text-[10px] font-medium',
                        item.comingSoon
                          ? 'bg-amber-500/20 text-amber-200'
                          : active
                            ? 'bg-sidebar-primary/25 text-sidebar-primary-foreground'
                            : 'bg-sidebar-accent text-sidebar-foreground',
                      )}
                    >
                      {item.comingSoon ? t('Soon') : item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

export function AppShell({
  brand,
  accent,
  groups,
  title,
  subtitle,
  children,
  initials = 'VE',
  headerEnd,
  /** When set, replaces legacy `headerEnd`, theme toggle, and bell (caller supplies full cluster). */
  headerToolbar,
  userMenu,
  headerSearch,
  sidebarLogoUrl,
  logoNav = { type: 'home' },
  navActiveCheck,
  showBreadcrumbs = true,
}: {
  brand: string;
  accent: string;
  groups: NavGroup[];
  title: string;
  subtitle?: string;
  children: ReactNode;
  initials?: string;
  /** Legacy: currency slot before theme + bell (ignored if `headerToolbar` is passed). */
  headerEnd?: ReactNode;
  headerToolbar?: ReactNode;
  /** Profile dropdown (workspace). Falls back to static avatar when omitted. */
  userMenu?: ReactNode;
  /** Tenant workspace search. Falls back to a static field when omitted. */
  headerSearch?: ReactNode;
  sidebarLogoUrl?: string;
  /** Logo click behavior — defaults to marketing homepage route. */
  logoNav?: LogoNav;
  /** Override sidebar active-state logic (Super Admin uses exact route matching). */
  navActiveCheck?: (pathname: string, to: string, label: string) => boolean;
  showBreadcrumbs?: boolean;
}) {
  const pathRaw = useRouterState({ select: (s) => s.location.pathname });
  const path = pathRaw !== '/' && pathRaw.endsWith('/') ? pathRaw.slice(0, -1) : pathRaw;
  const isActive = navActiveCheck ?? isWorkspaceNavItemActive;
  const [mobileOpen, setMobileOpen] = useState(false);
  const t = useT();
  const breadcrumbSegments = breadcrumbsFromPath(path, title);

  const sidebarBrand = (
    <BrandLogoLink
      nav={logoNav}
      className="flex items-center gap-2.5 px-5 py-5"
    >
      {sidebarLogoUrl ? (
        <img
          src={sidebarLogoUrl}
          alt=""
          className="h-8 w-8 rounded-lg bg-white/10 object-contain"
        />
      ) : (
        <VelonLogoMark
          size="sm"
          variant="sidebar"
        />
      )}
      <div>
        <div className="text-sm font-semibold tracking-tight">{brand}</div>
        <div className="text-sidebar-foreground/50 text-[10px] tracking-[0.18em] uppercase">
          {t(accent)}
        </div>
      </div>
    </BrandLogoLink>
  );

  return (
    <div className="bg-muted/30 flex min-h-screen w-full">
      {/* Desktop sidebar */}
      <aside className="border-sidebar-border bg-sidebar text-sidebar-foreground sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r lg:flex">
        {sidebarBrand}
        <SidebarNav
          groups={groups}
          path={path}
          isActive={isActive}
        />
      </aside>

      {/* Mobile sidebar */}
      <Sheet
        open={mobileOpen}
        onOpenChange={setMobileOpen}
      >
        <SheetContent
          side="left"
          className="border-sidebar-border bg-sidebar text-sidebar-foreground w-72 p-0"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>{t('Navigation')}</SheetTitle>
          </SheetHeader>
          {sidebarBrand}
          <SidebarNav
            groups={groups}
            path={path}
            isActive={isActive}
            onNavigate={() => setMobileOpen(false)}
          />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="border-border bg-background/80 sticky top-0 z-30 grid min-h-16 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-b px-4 py-2 backdrop-blur-xl sm:gap-3 sm:px-6 lg:grid-cols-[minmax(160px,240px)_minmax(220px,320px)_minmax(0,1fr)_auto] 2xl:grid-cols-[minmax(200px,320px)_minmax(320px,460px)_minmax(0,1fr)_auto]">
          <div className="flex min-w-0 items-center gap-2 lg:w-[240px] lg:max-w-[240px] 2xl:w-[320px] 2xl:max-w-[320px]">
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 rounded-lg lg:hidden"
              type="button"
              aria-label={t('Open navigation menu')}
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="min-w-0">
              <div className="truncate text-base font-semibold tracking-tight">{t(title)}</div>
              {subtitle && (
                <div className="text-muted-foreground truncate text-xs">{t(subtitle)}</div>
              )}
            </div>
          </div>
          <div className="relative order-3 col-span-3 hidden w-full max-w-[460px] md:block lg:order-none lg:col-span-1">
            {headerSearch ?? (
              <>
                <Search className="text-muted-foreground pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2" />
                <Input
                  placeholder={t('Search anything…')}
                  className="border-border bg-muted/50 focus-visible:ring-primary/30 h-9 rounded-lg ps-9 pe-14"
                />
                <kbd className="border-border bg-background text-muted-foreground pointer-events-none absolute end-2.5 top-1/2 flex -translate-y-1/2 items-center gap-0.5 rounded border px-1.5 py-0.5 text-[10px]">
                  <Command className="h-2.5 w-2.5" />K
                </kbd>
              </>
            )}
          </div>
          <div className="flex min-w-0 justify-end">
            {headerToolbar !== undefined ? (
              headerToolbar
            ) : (
              <>
                {headerEnd}
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-lg"
                  type="button"
                >
                  <Sun className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
          <div className="border-border flex items-center gap-2.5 border-s ps-3">
            <LanguageSwitch />
            {userMenu ?? (
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary text-primary-foreground text-[11px] font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 pb-24 sm:p-6 sm:pb-28">
          {showBreadcrumbs ? <PageBreadcrumbs segments={breadcrumbSegments} /> : null}
          {children}
        </main>
        <SiteFooter />
      </div>
    </div>
  );
}

export function Kpi({
  label,
  value,
  delta,
  deltaTone = 'up',
  icon: Icon,
  hint,
}: {
  label: string;
  value: string;
  delta?: string;
  deltaTone?: 'up' | 'down' | 'neutral';
  icon: LucideIcon;
  hint?: string;
}) {
  const deltaCls =
    deltaTone === 'up'
      ? 'text-success'
      : deltaTone === 'down'
        ? 'text-destructive'
        : 'text-muted-foreground';
  return (
    <div className="group border-border/80 bg-card/90 hover:border-primary/20 relative overflow-hidden rounded-xl border p-5 shadow-sm backdrop-blur-sm transition hover:shadow-md">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-[11px] font-medium tracking-[0.14em] uppercase">
          {label}
        </span>
        <div className="bg-primary/8 text-primary flex h-8 w-8 items-center justify-center rounded-lg">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-4 text-[28px] leading-none font-semibold tracking-tight">{value}</div>
      <div className="mt-2 flex items-center gap-2">
        {delta && <span className={cn('text-xs font-medium', deltaCls)}>{delta}</span>}
        {hint && <span className="text-muted-foreground text-xs">{hint}</span>}
      </div>
    </div>
  );
}
