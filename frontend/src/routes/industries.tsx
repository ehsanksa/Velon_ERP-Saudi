import { createFileRoute } from '@tanstack/react-router';
import { Building2, Factory, ShoppingBag, Stethoscope, Store, Truck } from 'lucide-react';
import { MarketingPageShell } from '@/components/marketing/marketing-page-shell';
import { Card } from '@/components/ui/card';
import { useT } from '@/lib/i18n/locale-context';

export const Route = createFileRoute('/industries')({
  component: IndustriesPage,
});

function IndustriesPage() {
  const t = useT();
  const industries = [
    {
      icon: Store,
      name: 'Retail',
      detail: 'POS speed, inventory accuracy and customer repeat analytics.',
    },
    {
      icon: Truck,
      name: 'Wholesale',
      detail: 'Bulk invoicing, supplier dues and warehouse-level controls.',
    },
    {
      icon: Building2,
      name: 'Multi-Branch',
      detail: 'Branch switching, consolidated reports and permission matrix.',
    },
    {
      icon: Stethoscope,
      name: 'Services',
      detail: 'Appointment billing, recurring customers and ledger tracking.',
    },
    {
      icon: Factory,
      name: 'SME Operations',
      detail: 'Day-to-day finance visibility with low operational overhead.',
    },
    {
      icon: ShoppingBag,
      name: 'Inventory Businesses',
      detail: 'Stock movement, returns, damaged goods and valuation.',
    },
  ];

  return (
    <MarketingPageShell
      label="Industries"
      title="Universal ERP UX built for real business models"
      description="Velon-ERP adapts to how different businesses run, while keeping one clean and scalable interface pattern."
    >
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {industries.map((item) => (
          <Card
            key={item.name}
            className="border-border bg-card p-6"
          >
            <item.icon className="h-5 w-5" />
            <h3 className="mt-4 text-lg font-semibold">{t(item.name)}</h3>
            <p className="text-muted-foreground mt-2 text-sm">{t(item.detail)}</p>
          </Card>
        ))}
      </div>
    </MarketingPageShell>
  );
}
