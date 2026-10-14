import { createFileRoute, Link } from '@tanstack/react-router';
import { MarketingPageShell } from '@/components/marketing/marketing-page-shell';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { loadPublicSiteContentSafe } from '@/lib/cms/load-public';
import { useT } from '@/lib/i18n/locale-context';

export const Route = createFileRoute('/help')({
  loader: () => loadPublicSiteContentSafe(),
  component: HelpPage,
});

function HelpPage() {
  const siteContent = Route.useLoaderData();
  const faqItems = siteContent.faq.items;
  const t = useT();

  return (
    <MarketingPageShell
      label="Help Center"
      title="Answers for setup, billing and daily operations"
      description="Guides for trial onboarding, role setup, module usage and subscription lifecycle."
      siteContent={siteContent}
    >
      <Card className="border-border bg-card mx-auto mb-6 max-w-4xl p-6">
        <h2 className="text-lg font-semibold">{t('In-app user guide')}</h2>
        <p className="text-muted-foreground mt-2 text-sm">
          {t(
            'After you sign in, open User guide from the left menu for step-by-step help — including why the Import CSV template differs from Products and Stock layouts.',
          )}
        </p>
        <Button
          asChild
          className="mt-4"
          size="sm"
        >
          <Link to="/app/help">{t('Open workspace user guide')}</Link>
        </Button>
      </Card>

      <Card className="border-border bg-card mx-auto max-w-4xl p-6">
        <Accordion
          type="single"
          collapsible
          className="w-full"
        >
          {faqItems.map((item, index) => (
            <AccordionItem
              key={item.q}
              value={`faq-${index}`}
            >
              <AccordionTrigger>{t(item.q)}</AccordionTrigger>
              <AccordionContent>{t(item.a)}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Card>
    </MarketingPageShell>
  );
}
