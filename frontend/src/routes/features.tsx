import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowRight } from 'lucide-react';
import { MarketingPageShell } from '@/components/marketing/marketing-page-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { loginSearch } from '@/lib/auth/login-utils';
import { loadPublicSiteContentSafe } from '@/lib/cms/load-public';
import { useT } from '@/lib/i18n/locale-context';

export const Route = createFileRoute('/features')({
  loader: () => loadPublicSiteContentSafe(),
  component: FeaturesPage,
});

function FeaturesPage() {
  const siteContent = Route.useLoaderData();
  const items = siteContent.features.items;
  const t = useT();

  return (
    <MarketingPageShell
      label="Platform Features"
      title="A complete business operating stack in one product"
      description="Velon-ERP combines the highest-impact modules for SMEs and multi-branch teams with a consistent, role-based UX."
      siteContent={siteContent}
    >
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <Card
            key={item.title}
            className="border-border bg-card p-6"
          >
            <h3 className="text-lg font-semibold">{t(item.title)}</h3>
            <p className="text-muted-foreground mt-2 text-sm">{t(item.description)}</p>
          </Card>
        ))}
      </div>
      <Card className="border-border bg-gradient-pale mt-8 flex flex-wrap items-center justify-between gap-4 p-6">
        <div>
          <Badge
            variant="outline"
            className="border-border bg-background"
          >
            {t('Workspace ready')}
          </Badge>
          <p className="text-muted-foreground mt-2 text-sm">
            {t('Sign up, invite your team, and manage your company from day one.')}
          </p>
        </div>
        <Button
          asChild
          className="bg-foreground text-background hover:bg-foreground/90"
        >
          <Link
            to="/login"
            search={loginSearch({ tab: 'signup' })}
          >
            {t('Start free trial')} <ArrowRight className="ms-1.5 h-4 w-4 rtl:-scale-x-100" />
          </Link>
        </Button>
      </Card>
    </MarketingPageShell>
  );
}
