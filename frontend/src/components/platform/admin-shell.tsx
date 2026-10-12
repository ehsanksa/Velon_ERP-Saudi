import { useCallback, useEffect, useLayoutEffect, useState, type ReactNode } from 'react';
import {
  Bell,
  Building2,
  CreditCard,
  LayoutDashboard,
  MapPin,
  Moon,
  Server,
  Sun,
  Users,
} from 'lucide-react';
import { isAdminNavItemActive } from '@velon/shared';
import { AdminUserMenu } from '@/components/platform/admin-user-menu';
import { PlatformSyncIndicator } from '@/components/platform/platform-sync-indicator';
import { Button } from '@/components/ui/button';
import { AppShell, type NavGroup } from '@/components/workspace/app-shell';
import {
  NotificationDropdown,
  type NotificationPreview,
} from '@/components/workspace/notification-dropdown';
import {
  adminBooksCurrencyLine,
  AdminCurrencyProvider,
  useAdminCurrency,
} from '@/contexts/admin-currency';
import { usePlatformRealtime } from '@/hooks/use-platform-realtime';
import { useT } from '@/lib/i18n/locale-context';
import { loadAlertsLogsCommandCenter } from '@/lib/platform/admin-loaders';
import {
  applyVelonThemeFromStorage,
  isVelonDocumentDark,
  toggleVelonTheme,
} from '@/lib/shared/document-theme';
import { marketingSiteOrigin } from '@/lib/shared/logo-navigation';

export const adminGroups: NavGroup[] = [
  {
    label: 'Platform',
    items: [
      { label: 'Overview', to: '/admin', icon: LayoutDashboard },
      { label: 'Tenants', to: '/admin/tenants', icon: Building2 },
      { label: 'Users', to: '/admin/users', icon: Users },
      { label: 'Subscriptions', to: '/admin/subscriptions', icon: CreditCard },
      { label: 'Website', to: '/admin/website', icon: MapPin },
    ],
  },
  {
    label: 'Operations',
    items: [{ label: 'Alerts & Logs', to: '/admin/alerts-logs', icon: Bell }],
  },
  {
    label: 'System',
    items: [{ label: 'Infrastructure', to: '/admin/infrastructure', icon: Server }],
  },
];

function AdminHeaderToolbar({
  notifications,
  unreadCount,
}: {
  notifications: NotificationPreview[];
  unreadCount: number;
}) {
  const { preset, customSymbol } = useAdminCurrency();
  const books = adminBooksCurrencyLine(preset, customSymbol);
  const t = useT();
  const [dark, setDark] = useState(false);

  useLayoutEffect(() => {
    applyVelonThemeFromStorage();
    setDark(isVelonDocumentDark());
  }, []);

  return (
    <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5 sm:gap-2 md:gap-3">
      <span
        className="border-border bg-muted/50 text-foreground rounded-md border px-2 py-1 font-mono text-[10px] font-semibold md:hidden"
        title={books}
      >
        {preset === 'CUSTOM' ? customSymbol.trim() || '?' : preset}
      </span>
      <div className="hidden min-w-0 flex-col items-end text-right md:flex">
        <span className="text-muted-foreground text-[9px] font-medium tracking-wider uppercase">
          {t('Platform figures')}
        </span>
        <span
          className="max-w-[220px] truncate text-[11px] leading-tight font-semibold"
          title={books}
        >
          {books}
        </span>
      </div>
      <div
        className="bg-border hidden h-8 w-px md:block"
        aria-hidden
      />
      <div
        className="text-muted-foreground hidden min-w-0 items-center gap-1.5 sm:flex"
        title={t('Primary control plane')}
      >
        <MapPin
          className="h-3.5 w-3.5 shrink-0"
          aria-hidden
        />
        <div className="flex min-w-0 flex-col items-end text-right">
          <span className="text-foreground max-w-[min(42vw,200px)] truncate text-[11px] font-medium">
            {t('Global · multi-region')}
          </span>
          <span className="text-muted-foreground max-w-[min(42vw,200px)] truncate text-[10px]">
            Primary · us-east-1
          </span>
        </div>
      </div>
      <PlatformSyncIndicator />
      <Button
        variant="ghost"
        size="icon"
        className="shrink-0 rounded-lg"
        type="button"
        onClick={() => {
          toggleVelonTheme();
          setDark(isVelonDocumentDark());
        }}
        aria-label={dark ? t('Switch to light mode') : t('Switch to dark mode')}
      >
        {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </Button>
      <NotificationDropdown
        items={notifications}
        unreadCount={unreadCount}
        viewAllHref="/admin/alerts-logs"
        viewAllLabel="View All Alerts"
      />
    </div>
  );
}

export function AdminShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  const refreshNotifications = useCallback(() => {
    void loadAlertsLogsCommandCenter()
      .then((data) => {
        setNotifications(
          data.liveAlerts.map((alert) => ({
            id: alert.id,
            title: alert.title,
            detail: alert.rcaHint,
            timestamp: alert.timeLabel,
            priority: alert.severity,
          })),
        );
      })
      .catch(() => undefined);
  }, []);

  const [notifications, setNotifications] = useState<NotificationPreview[]>([]);
  const platformSync = usePlatformRealtime(true, 3000);

  useEffect(() => {
    refreshNotifications();
  }, [refreshNotifications, platformSync.revision]);

  return (
    <AdminCurrencyProvider>
      <AppShell
        brand="Velon-ERP"
        accent="Super Admin"
        groups={adminGroups}
        navActiveCheck={isAdminNavItemActive}
        initials="SA"
        title={title}
        subtitle={subtitle}
        logoNav={{ type: 'external', href: marketingSiteOrigin() }}
        headerToolbar={
          <AdminHeaderToolbar
            notifications={notifications}
            unreadCount={notifications.length}
          />
        }
        userMenu={<AdminUserMenu fallbackInitials="SA" />}
      >
        {children}
      </AppShell>
    </AdminCurrencyProvider>
  );
}
