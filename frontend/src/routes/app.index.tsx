import { createFileRoute, Link } from '@tanstack/react-router';
import { AlertCircle, AlertTriangle, Package, RefreshCw, TrendingUp, Users } from 'lucide-react';
import { classifyDashboardLoaderError, formatCurrencyLabel } from '@velon/shared';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { MetricCard } from '@/components/ui/metric-card';
import { OnboardingChecklist } from '@/components/workspace/onboarding-checklist';
import { QuickActionGrid } from '@/components/workspace/quick-action-grid';
import { WorkspaceDashboardSkeleton } from '@/components/workspace/workspace-dashboard-skeleton';
import { isApiEnabled } from '@/lib/api/config';
import { signOutWorkspace } from '@/lib/auth/sign-out';
import { useT } from '@/lib/i18n/locale-context';
import { isSsrWorkspaceDashboardPlaceholder } from '@/lib/workspace/empty-states';
import { fetchWorkspaceDashboard, loadWorkspaceDashboard } from '@/lib/workspace/loaders';
import { useClientWorkspaceLoader } from '@/lib/workspace/use-client-workspace-loader';

export const Route = createFileRoute('/app/')({
  loader: () => loadWorkspaceDashboard(),
  pendingComponent: WorkspaceDashboardSkeleton,
  component: DashboardPage,
  errorComponent: DashboardError,
});

function DashboardError({ error }: { error: Error }) {
  const kind = classifyDashboardLoaderError(error.message);
  const t = useT();

  if (kind === 'api_config') {
    return (
      <Card className="bg-card border-amber-500/30 p-8 text-center">
        <AlertTriangle className="mx-auto h-8 w-8 text-amber-600" />
        <h2 className="mt-4 font-semibold">{t('API URL is not configured')}</h2>
        <p className="text-muted-foreground mt-2 text-sm">
          {t(
            'Add VITE_API_URL in the web environment (for example in .env). In local development, run npm run dev so the Vite proxy can reach the API on port 3001.',
          )}
        </p>
      </Card>
    );
  }

  const isAuth = kind === 'auth';
  const title = isAuth ? t('Session expired') : t('Could not load workspace dashboard');
  const description = isAuth
    ? t('Your session is no longer valid. Sign in again to continue.')
    : error.message;

  return (
    <Card className="border-destructive/30 bg-card p-8 text-center">
      <AlertTriangle className="text-destructive mx-auto h-8 w-8" />
      <h2 className="mt-4 font-semibold">{title}</h2>
      <p className="text-muted-foreground mt-2 text-sm">{description}</p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {isAuth ? (
          <Button
            variant="outline"
            onClick={() => {
              signOutWorkspace();
            }}
          >
            {t('Sign in again')}
          </Button>
        ) : (
          <Button
            variant="outline"
            onClick={() => window.location.reload()}
          >
            <RefreshCw className="me-2 h-4 w-4" />
            {t('Retry connection')}
          </Button>
        )}
      </div>
    </Card>
  );
}

function DashboardPage() {
  const t = useT();
  const loaderData = Route.useLoaderData();
  const { data, isReloading, error } = useClientWorkspaceLoader(
    loaderData,
    fetchWorkspaceDashboard,
    isSsrWorkspaceDashboardPlaceholder,
  );

  if (typeof window !== 'undefined' && !isApiEnabled()) {
    return (
      <DashboardError
        error={new Error('API URL is not configured. Add VITE_API_URL in the web environment.')}
      />
    );
  }

  if (error) {
    return <DashboardError error={error} />;
  }

  if (isReloading) {
    return <WorkspaceDashboardSkeleton />;
  }

  const currencyLabel = formatCurrencyLabel(data.workspace.currency);

  return (
    <div className="space-y-6">
      <div className="glass-panel rounded-xl p-5">
        <p className="text-primary text-[11px] font-medium tracking-wider uppercase">
          {t(greetingKey())}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{data.company.name}</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {t('Easy and affordable ERP for growing businesses · {currency}', {
            currency: currencyLabel,
          })}
        </p>
      </div>

      <OnboardingChecklist data={data} />

      <div>
        <h2 className="text-sm font-semibold">{t('What do you want to do today?')}</h2>
        <p className="text-muted-foreground mt-0.5 text-xs">
          {t('One tap to create invoices, add customers, record payments, and more.')}
        </p>
        <div className="mt-4">
          <QuickActionGrid />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label={t('Customers')}
          value={data.crmSummary.customers}
          hint={
            data.crmSummary.customers === 0 ? t('Add your first customer') : t('Active customers')
          }
          icon={Users}
        />
        <MetricCard
          label={t('Open quotes')}
          value={data.crmSummary.openQuotations}
          hint={t('Quotations waiting for approval')}
          icon={TrendingUp}
        />
        <MetricCard
          label={t('Products')}
          value={data.inventorySummary.totalProducts}
          hint={
            data.inventorySummary.totalProducts === 0 ? t('Add products you sell') : t('In catalog')
          }
          icon={Package}
        />
        <MetricCard
          label={t('Low stock')}
          value={data.inventorySummary.lowStockAlerts}
          hint={
            data.inventorySummary.lowStockAlerts > 0
              ? t('Items need restocking')
              : t('Stock levels look good')
          }
          icon={AlertCircle}
          trendTone={data.inventorySummary.lowStockAlerts > 0 ? 'down' : 'neutral'}
        />
      </div>

      {(data.inventorySummary.pendingPurchaseOrders > 0 ||
        data.crmSummary.openOpportunities > 0) && (
        <Card className="border-border bg-card p-4">
          <p className="text-sm font-medium">{t('Needs your attention')}</p>
          <ul className="text-muted-foreground mt-2 space-y-1 text-sm">
            {data.inventorySummary.pendingPurchaseOrders > 0 && (
              <li>
                <Link
                  to="/app/procurement"
                  className="text-primary hover:underline"
                >
                  {t(
                    data.inventorySummary.pendingPurchaseOrders === 1
                      ? '{count} pending purchase'
                      : '{count} pending purchases',
                    { count: data.inventorySummary.pendingPurchaseOrders },
                  )}
                </Link>
              </li>
            )}
            {data.crmSummary.openOpportunities > 0 && (
              <li>
                <Link
                  to="/app/crm/opportunities"
                  className="text-primary hover:underline"
                >
                  {t(
                    data.crmSummary.openOpportunities === 1
                      ? '{count} open sales opportunity'
                      : '{count} open sales opportunities',
                    { count: data.crmSummary.openOpportunities },
                  )}
                </Link>
              </li>
            )}
          </ul>
        </Card>
      )}
    </div>
  );
}

function greetingKey() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}
