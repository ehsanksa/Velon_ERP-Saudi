import { useCallback, useEffect, useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { FileText, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { canWriteSales, normalizeVelonRole } from '@velon/shared';
import { DeleteInvoiceDialog } from '@/components/sales/delete-invoice-dialog';
import { SalesInvoiceStatusBadge } from '@/components/sales/sales-invoice-status-badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ModuleEmptyState } from '@/components/workspace/module-empty-state';
import { useWorkspaceCurrency } from '@/contexts/workspace-currency';
import { getSessionMembershipRole } from '@/lib/auth/session';
import { useT } from '@/lib/i18n/locale-context';
import {
  deleteInvoice,
  loadInvoices,
  type SalesInvoice,
  type SalesInvoiceStatus,
} from '@/lib/sales/invoice-api';

const statuses: Array<SalesInvoiceStatus | 'all'> = [
  'all',
  'DRAFT',
  'UNPAID',
  'PARTIALLY_PAID',
  'PAID',
  'OVERDUE',
  'CANCELLED',
  'VOID',
];

export const Route = createFileRoute('/app/invoices/')({
  component: InvoicesPage,
});

function InvoicesPage() {
  const { formatCurrency } = useWorkspaceCurrency();
  const t = useT();
  const canWrite = canWriteSales(normalizeVelonRole(getSessionMembershipRole() ?? 'USER'));
  const [rows, setRows] = useState<SalesInvoice[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [busy, setBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<SalesInvoice | null>(null);
  const [deleting, setDeleting] = useState(false);

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const data = await loadInvoices(
        search || undefined,
        status === 'all' ? undefined : (status as SalesInvoiceStatus),
      );
      setRows(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not load invoices');
    } finally {
      setBusy(false);
    }
  }, [search, status]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteInvoice(pendingDelete.id);
      toast.success(t('Invoice deleted'));
      setPendingDelete(null);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('Could not delete invoice'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Invoices</h1>
          <p className="text-muted-foreground text-sm">
            Create, track, and collect on customer invoices.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            asChild
          >
            <Link to="/app/billing-pos">Quick Sale</Link>
          </Button>
          <Button asChild>
            <Link to="/app/invoices/create">
              <Plus className="mr-2 h-4 w-4" />
              Create Invoice
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Input
          className="max-w-sm"
          placeholder="Search invoice or customer"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select
          value={status}
          onValueChange={setStatus}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {statuses.map((value) => (
              <SelectItem
                key={value}
                value={value}
              >
                {value === 'all' ? 'All statuses' : value.replace(/_/g, ' ')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          onClick={() => void refresh()}
          disabled={busy}
        >
          Refresh
        </Button>
      </div>

      {rows.length === 0 ? (
        <ModuleEmptyState
          icon={FileText}
          title="No invoices yet"
          description="Create your first invoice with products from inventory, customer details, and taxes."
          actionLabel="Create Invoice"
          actionTo="/app/invoices/create"
        />
      ) : (
        <div className="grid gap-3">
          {rows.map((invoice) => (
            <Card
              key={invoice.id}
              className="hover:bg-muted/40 relative p-4 transition-colors"
            >
              <Link
                to="/app/invoices/$invoiceId"
                params={{ invoiceId: invoice.id }}
                aria-label={t('Open invoice {number}', { number: invoice.invoiceNumber })}
                className="focus-visible:ring-ring absolute inset-0 z-0 rounded-xl focus-visible:ring-2"
              />
              <div className="pointer-events-none relative z-10 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{invoice.invoiceNumber}</p>
                  <p className="text-muted-foreground text-sm">{invoice.customerName}</p>
                </div>
                <div className="flex items-center gap-3">
                  <SalesInvoiceStatusBadge status={invoice.status} />
                  <div className="text-right">
                    <p className="font-semibold">{formatCurrency(Number(invoice.total))}</p>
                    <p className="text-muted-foreground text-xs">
                      Due {formatCurrency(Number(invoice.balanceDue))}
                    </p>
                  </div>
                  {canWrite ? (
                    <div className="pointer-events-auto relative z-10 flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                      >
                        <Link
                          to="/app/invoices/create"
                          search={{ invoiceId: invoice.id }}
                        >
                          <Pencil className="mr-1.5 h-3.5 w-3.5" />
                          {t('Edit')}
                        </Link>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        type="button"
                        onClick={() => setPendingDelete(invoice)}
                      >
                        <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                        {t('Delete')}
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
      <DeleteInvoiceDialog
        invoiceNumber={pendingDelete?.invoiceNumber ?? null}
        pending={deleting}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => void onDelete()}
      />
    </div>
  );
}
