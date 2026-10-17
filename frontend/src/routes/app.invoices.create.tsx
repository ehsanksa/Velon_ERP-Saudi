import { createFileRoute } from '@tanstack/react-router';
import { InvoiceForm } from '@/components/sales/invoice-form';
import { useT } from '@/lib/i18n/locale-context';

export const Route = createFileRoute('/app/invoices/create')({
  validateSearch: (search: Record<string, unknown>): { invoiceId?: string } => {
    const invoiceId = typeof search.invoiceId === 'string' ? search.invoiceId.trim() : '';
    return invoiceId ? { invoiceId } : {};
  },
  component: CreateInvoicePage,
});

function CreateInvoicePage() {
  const { invoiceId } = Route.useSearch();
  const t = useT();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">
          {invoiceId ? t('Edit invoice') : 'Create Invoice'}
        </h1>
        <p className="text-muted-foreground text-sm">
          {invoiceId
            ? t('Update the customer, lines, and totals. The invoice number stays the same.')
            : 'Build a professional invoice with customers, inventory products, taxes, and payments.'}
        </p>
      </div>
      <InvoiceForm invoiceId={invoiceId} />
    </div>
  );
}
