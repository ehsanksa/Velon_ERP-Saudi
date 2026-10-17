import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { MapPin, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AppShell } from '@/components/workspace/app-shell';
import {
  NotificationDropdown,
  type NotificationPreview,
} from '@/components/workspace/notification-dropdown';
import { QuickCreateFab } from '@/components/workspace/quick-create-fab';
import { WorkspaceSearch } from '@/components/workspace/workspace-search';
import { WorkspaceUserMenu } from '@/components/workspace/workspace-user-menu';
import { WorkspaceCurrencyProvider } from '@/contexts/workspace-currency';
import {
  useWorkspacePreferences,
  WorkspacePreferencesProvider,
} from '@/contexts/workspace-preferences';
import {
  useWorkspaceUserProfile,
  WorkspaceUserProfileProvider,
} from '@/contexts/workspace-user-profile';
import { useDeviceLocation } from '@/hooks/use-device-location';
import { usePlatformRealtime } from '@/hooks/use-platform-realtime';
import { useT } from '@/lib/i18n/locale-context';
import { normalizeExternalUrl, type LogoNav } from '@/lib/shared/logo-navigation';
import {
  loadWorkspaceAlerts,
  loadWorkspaceIdentity,
  loadWorkspaceNavBadges,
} from '@/lib/workspace/loaders';
import { markAllNotificationsRead } from '@/lib/workspace/mutations';
import { buildWorkspaceNavGroups } from '@/lib/workspace/nav';
import { readWorkspaceName, saveWorkspaceName } from '@/lib/workspace/tenant-workspace';

function WorkspaceHeaderToolbar({
  alertCount,
  notifications,
  onMarkAllRead,
}: {
  alertCount: number;
  notifications: NotificationPreview[];
  onMarkAllRead: () => void | Promise<void>;
}) {
  const { theme, toggleTheme } = useWorkspacePreferences();
  const { place, status, refresh } = useDeviceLocation();
  const t = useT();
  const locationPrimary = place
    ? place.city
    : status === 'denied'
      ? t('Location off')
      : status === 'unavailable'
        ? t('Location unavailable')
        : t('Locating…');
  const locationSecondary = place
    ? [place.region, place.country].filter(Boolean).join(' · ')
    : status === 'denied'
      ? t('Allow location to show your city')
      : '';
  const locationTitle = place
    ? `${[place.city, place.region, place.country].filter(Boolean).join(', ')} · ${place.latitude.toFixed(4)}, ${place.longitude.toFixed(4)}`
    : locationPrimary;

  return (
    <div className="flex min-w-0 items-center justify-end gap-1.5 sm:gap-2 md:gap-3">
      <button
        type="button"
        className="text-muted-foreground hover:bg-muted/60 flex min-w-0 items-center gap-1.5 rounded-lg px-2 py-1"
        title={locationTitle}
        onClick={refresh}
        aria-label={locationTitle}
      >
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
            status === 'live' ? 'bg-emerald-500' : 'bg-muted-foreground/40'
          }`}
          aria-hidden
        />
        <MapPin
          className="h-3.5 w-3.5 shrink-0"
          aria-hidden
        />
        <span className="flex min-w-0 flex-col items-end text-right">
          <span className="text-foreground max-w-[min(42vw,220px)] truncate text-[11px] font-medium">
            {locationPrimary}
          </span>
          {locationSecondary ? (
            <span className="text-muted-foreground max-w-[min(42vw,220px)] truncate text-[10px]">
              {locationSecondary}
            </span>
          ) : null}
        </span>
      </button>
      <Button
        variant="ghost"
        size="icon"
        className="shrink-0 rounded-lg"
        type="button"
        onClick={toggleTheme}
        aria-label={theme === 'dark' ? t('Switch to light mode') : t('Switch to dark mode')}
      >
        {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </Button>
      <NotificationDropdown
        items={notifications}
        unreadCount={alertCount}
        viewAllHref="/app/alerts"
        viewAllLabel="View All Notifications"
        onMarkAllRead={onMarkAllRead}
      />
    </div>
  );
}

function WorkspaceShellInner({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  const getWorkspaceIdentityFn = loadWorkspaceIdentity;
  const getNavBadgesFn = loadWorkspaceNavBadges;
  const getWorkspaceAlertsFn = loadWorkspaceAlerts;
  const { initials, profile } = useWorkspaceUserProfile();
  const [workspaceName, setWorkspaceName] = useState('Workspace');
  const [tenantWebsite, setTenantWebsite] = useState<string | null>(null);
  const [navBadges, setNavBadges] = useState({ billingOpen: 0, alerts: 0 });
  const [notifications, setNotifications] = useState<NotificationPreview[]>([]);

  const refreshNavBadges = useCallback(() => {
    void getNavBadgesFn()
      .then(setNavBadges)
      .catch(() => undefined);
  }, [getNavBadgesFn]);

  const refreshNotifications = useCallback(() => {
    void getWorkspaceAlertsFn()
      .then((alerts) => {
        setNotifications(
          alerts.map((alert) => ({
            id: alert.id,
            title: alert.title,
            detail: alert.body,
            timestamp: alert.createdAt,
          })),
        );
      })
      .catch(() => undefined);
  }, [getWorkspaceAlertsFn]);

  const handleMarkAllRead = useCallback(async () => {
    await markAllNotificationsRead();
    refreshNavBadges();
    refreshNotifications();
  }, [refreshNavBadges, refreshNotifications]);

  const platformSync = usePlatformRealtime(true, 3000);

  useEffect(() => {
    refreshNavBadges();
    refreshNotifications();
  }, [refreshNavBadges, refreshNotifications, platformSync.revision]);

  useEffect(() => {
    const sync = () => setWorkspaceName(readWorkspaceName());
    sync();

    const onNameChange = () => sync();
    window.addEventListener('velon-workspace-name-changed', onNameChange);

    const onWebsiteChange = (event: Event) => {
      const website = (event as CustomEvent<{ website?: string | null }>).detail?.website ?? null;
      setTenantWebsite(normalizeExternalUrl(website));
    };
    window.addEventListener('velon-workspace-website-changed', onWebsiteChange);

    void getWorkspaceIdentityFn().then((identity) => {
      if (identity.name && identity.name !== 'Workspace') {
        saveWorkspaceName(identity.name);
        setWorkspaceName(identity.name);
      }
      setTenantWebsite(normalizeExternalUrl(identity.website));
    });

    return () => {
      window.removeEventListener('velon-workspace-name-changed', onNameChange);
      window.removeEventListener('velon-workspace-website-changed', onWebsiteChange);
    };
  }, [getWorkspaceIdentityFn]);

  const sidebarLogo =
    profile.workspaceLogoDataUrl && profile.workspaceLogoAspect === 'square'
      ? profile.workspaceLogoDataUrl
      : undefined;

  const navGroups = useMemo(() => buildWorkspaceNavGroups(navBadges), [navBadges]);

  const logoNav = useMemo((): LogoNav => ({ type: 'workspace' }), []);

  return (
    <AppShell
      brand={workspaceName}
      accent="Easy ERP"
      groups={navGroups}
      initials={initials}
      title={title}
      subtitle={subtitle}
      logoNav={logoNav}
      headerToolbar={
        <WorkspaceHeaderToolbar
          alertCount={navBadges.alerts}
          notifications={notifications}
          onMarkAllRead={handleMarkAllRead}
        />
      }
      userMenu={<WorkspaceUserMenu />}
      headerSearch={<WorkspaceSearch />}
      sidebarLogoUrl={sidebarLogo}
    >
      {children}
      <QuickCreateFab />
    </AppShell>
  );
}

export function WorkspaceShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <WorkspaceUserProfileProvider>
      <WorkspaceCurrencyProvider>
        <WorkspacePreferencesProvider>
          <WorkspaceShellInner
            title={title}
            subtitle={subtitle}
          >
            {children}
          </WorkspaceShellInner>
        </WorkspacePreferencesProvider>
      </WorkspaceCurrencyProvider>
    </WorkspaceUserProfileProvider>
  );
}
