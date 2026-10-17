import { useCallback, useEffect, useState } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import { canWriteSales, formatHijriDate, normalizeVelonRole } from '@velon/shared';
import { DeleteInvoiceDialog } from '@/components/sales/delete-invoice-dialog';
import { InvoiceDocumentView } from '@/components/sales/invoice-document';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getSessionMembershipRole } from '@/lib/auth/session';
import { useT } from '@/lib/i18n/locale-context';
import {
  cancelInvoice,
  deleteInvoice,
  duplicateInvoice,
  loadInvoice,
  recordInvoicePayment,
  sendInvoiceEmail,
  voidInvoice,
  type SalesInvoice,
  type SalesInvoicePaymentMethod,
} from '@/lib/sales/invoice-api';
import { loadInvoiceCompanyProfile } from '@/lib/sales/invoicing/workspace-profile';

export const Route = createFileRoute('/app/invoices/$invoiceId')({
  loader: ({ params }) => loadInvoice(params.invoiceId),
  component: InvoiceDetailPage,
});

const PAYMENT_METHODS: SalesInvoicePaymentMethod[] = [
  'CASH',
  'CARD',
  'BANK_TRANSFER',
  'WALLET',
  'GIFT',
  'OTHER',
];

function InvoiceDetailPage() {
  const navigate = useNavigate();
  const initial = Route.useLoaderData();
  const [invoice, setInvoice] = useState<SalesInvoice>(initial);
  const [companyName, setCompanyName] = useState('');
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<SalesInvoicePaymentMethod>('CASH');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const canWrite = canWriteSales(normalizeVelonRole(getSessionMembershipRole() ?? 'USER'));
  const t = useT();

  const refresh = useCallback(async () => {
    const row = await loadInvoice(invoice.id);
    setInvoice(row);
  }, [invoice.id]);

  useEffect(() => {
    loadInvoiceCompanyProfile()
      .then((profile) => {
        setCompanyName(profile.legalName);
        setLogoDataUrl(profile.logoDataUrl ?? null);
      })
      .catch(() => undefined);
  }, []);

  const onRecordPayment = async () => {
    try {
      const updated = await recordInvoicePayment(invoice.id, {
        amount: Number(paymentAmount),
        method: paymentMethod,
      });
      setInvoice(updated);
      setShowPayment(false);
      toast.success('Payment recorded');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not record payment');
    }
  };

  const onEmail = async () => {
    try {
      const result = await sendInvoiceEmail(invoice.id);
      if (result.sent) {
        toast.success('Invoice email sent');
        return;
      }
      const warning = result.warning ?? 'Invoice email could not be sent';
      const friendly =
        warning.includes('not_configured') || warning.includes('EMAIL NOT CONFIGURED')
          ? 'Email is not configured on the server (Resend/SMTP). PDF still works — ask Super Admin to set mail env.'
          : warning.includes('timeout')
            ? 'Email provider timed out. Try again in a moment.'
            : warning.includes('failed')
              ? 'Email provider rejected the message. Check Resend/SMTP settings and sender domain.'
              : warning;
      toast.error(friendly);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Invoice email could not be sent');
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-border bg-card p-4 text-sm">
        <p>
          Gregorian issue date: {invoice.issueDate} · Hijri: {formatHijriDate(invoice.issueDate)}
        </p>
        <p className="text-muted-foreground mt-1">
          E-invoice status: {invoice.zatcaStatus ?? 'NOT_SUBMITTED'}.{' '}
          {invoice.zatcaStatusDetail ??
            'A generated QR is not ZATCA clearance or reporting confirmation.'}
        </p>
      </Card>
      <InvoiceDocumentView
        invoice={invoice}
        companyName={companyName}
        logoDataUrl={logoDataUrl}
        canWrite={canWrite}
        onRecordPayment={
          canWrite && !['PAID', 'CANCELLED', 'VOID', 'DRAFT'].includes(invoice.status)
            ? () => {
                setPaymentAmount(String(invoice.balanceDue));
                setShowPayment(true);
              }
            : undefined
        }
        onEdit={
          canWrite
            ? () =>
                void navigate({
                  to: '/app/invoices/create',
                  search: { invoiceId: invoice.id },
                })
            : undefined
        }
        onDuplicate={
          canWrite
            ? async () => {
                const copy = await duplicateInvoice(invoice.id);
                toast.success('Invoice duplicated');
                await navigate({
                  to: '/app/invoices/$invoiceId',
                  params: { invoiceId: copy.id },
                });
              }
            : undefined
        }
        onCancel={
          canWrite && !['CANCELLED', 'VOID', 'DRAFT'].includes(invoice.status)
            ? async () => {
                const updated = await cancelInvoice(invoice.id);
                setInvoice(updated);
                toast.success('Invoice cancelled');
              }
            : undefined
        }
        onVoid={
          canWrite && !['CANCELLED', 'VOID', 'DRAFT'].includes(invoice.status)
            ? async () => {
                const updated = await voidInvoice(invoice.id);
                setInvoice(updated);
                toast.success('Invoice voided');
              }
            : undefined
        }
        onDelete={canWrite ? () => setConfirmDelete(true) : undefined}
        onEmail={canWrite ? () => void onEmail() : undefined}
      />

      {showPayment ? (
        <Card className="p-5">
          <h2 className="mb-4 font-semibold">Record payment</h2>
          <div className="grid max-w-md gap-3">
            <div>
              <Label>Amount</Label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
              />
            </div>
            <div>
              <Label>Method</Label>
              <Select
                value={paymentMethod}
                onValueChange={(v) => setPaymentMethod(v as SalesInvoicePaymentMethod)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((method) => (
                    <SelectItem
                      key={method}
                      value={method}
                    >
                      {method.replace(/_/g, ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => void onRecordPayment()}>Save payment</Button>
              <Button
                variant="outline"
                onClick={() => setShowPayment(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      ) : null}
      <DeleteInvoiceDialog
        invoiceNumber={confirmDelete ? invoice.invoiceNumber : null}
        pending={deleting}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          setDeleting(true);
          void deleteInvoice(invoice.id)
            .then(async () => {
              toast.success(t('Invoice deleted'));
              await navigate({ to: '/app/invoices' });
            })
            .catch((err: unknown) => {
              toast.error(err instanceof Error ? err.message : t('Could not delete invoice'));
              setDeleting(false);
            });
        }}
      />
    </div>
  );
}
