import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { Copy, Download, Mail, Pencil, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { SalesInvoiceStatusBadge } from '@/components/sales/sales-invoice-status-badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useWorkspaceCurrency } from '@/contexts/workspace-currency';
import { openInvoicePdf, type SalesInvoice } from '@/lib/sales/invoice-api';

type Props = {
  invoice: SalesInvoice;
  companyName?: string;
  logoDataUrl?: string | null;
  onRecordPayment?: () => void;
  onEdit?: () => void;
  onDuplicate?: () => void;
  onCancel?: () => void;
  onVoid?: () => void;
  onDelete?: () => void;
  onEmail?: () => void;
  canWrite?: boolean;
};

export function InvoiceDocumentView({
  invoice,
  companyName,
  logoDataUrl,
  onRecordPayment,
  onEdit,
  onDuplicate,
  onCancel,
  onVoid,
  onDelete,
  onEmail,
  canWrite,
}: Props) {
  const { formatCurrency } = useWorkspaceCurrency();
  const [pdfBusy, setPdfBusy] = useState(false);

  const handlePdf = async (mode: 'download' | 'print') => {
    setPdfBusy(true);
    try {
      await openInvoicePdf(
        invoice.id,
        mode === 'download' ? { downloadName: `${invoice.invoiceNumber}.pdf` } : undefined,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to open invoice PDF');
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          {logoDataUrl ? (
            <img
              src={logoDataUrl}
              alt=""
              className="h-16 w-16 rounded-lg border object-contain"
            />
          ) : null}
          <div>
            <p className="text-muted-foreground text-sm">{companyName ?? 'Your company'}</p>
            <h1 className="text-2xl font-semibold">{invoice.invoiceNumber}</h1>
            <div className="mt-2">
              <SalesInvoiceStatusBadge status={invoice.status} />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            asChild
          >
            <Link to="/app/invoices">Back to invoices</Link>
          </Button>
          <Button
            variant="outline"
            disabled={pdfBusy}
            onClick={() => void handlePdf('download')}
          >
            <Download className="mr-2 h-4 w-4" />
            Download PDF
          </Button>
          <Button
            variant="outline"
            disabled={pdfBusy}
            onClick={() => void handlePdf('print')}
          >
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
          {onEmail ? (
            <Button
              variant="outline"
              onClick={onEmail}
            >
              <Mail className="mr-2 h-4 w-4" />
              Send email
            </Button>
          ) : null}
          {canWrite && onEdit ? (
            <Button
              variant="outline"
              onClick={onEdit}
            >
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
          ) : null}
          {canWrite && onDuplicate ? (
            <Button
              variant="outline"
              onClick={onDuplicate}
            >
              <Copy className="mr-2 h-4 w-4" />
              Duplicate
            </Button>
          ) : null}
          {canWrite && onRecordPayment ? (
            <Button onClick={onRecordPayment}>Record payment</Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-3 font-semibold">Bill to</h2>
          <p className="font-medium">{invoice.customerName}</p>
          {invoice.customerEmail ? <p className="text-sm">{invoice.customerEmail}</p> : null}
          {invoice.customerPhone ? <p className="text-sm">{invoice.customerPhone}</p> : null}
          {invoice.customerAddress ? (
            <p className="text-muted-foreground mt-2 text-sm whitespace-pre-wrap">
              {invoice.customerAddress}
            </p>
          ) : null}
          {invoice.customerTaxId ? (
            <p className="text-muted-foreground mt-2 text-sm">Tax ID: {invoice.customerTaxId}</p>
          ) : null}
        </Card>
        <Card className="p-5">
          <h2 className="mb-3 font-semibold">Invoice details</h2>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Issue date</dt>
              <dd>{invoice.issueDate.slice(0, 10)}</dd>
            </div>
            {invoice.dueDate ? (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Due date</dt>
                <dd>{invoice.dueDate.slice(0, 10)}</dd>
              </div>
            ) : null}
            {invoice.paymentMethod ? (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Payment method</dt>
                <dd>{invoice.paymentMethod.replace(/_/g, ' ')}</dd>
              </div>
            ) : null}
            {invoice.salespersonName ? (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Salesperson</dt>
                <dd>{invoice.salespersonName}</dd>
              </div>
            ) : null}
            {invoice.referenceNumber ? (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Reference</dt>
                <dd>{invoice.referenceNumber}</dd>
              </div>
            ) : null}
          </dl>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Item</th>
                <th className="px-4 py-3 text-right font-medium">Qty</th>
                <th className="px-4 py-3 text-right font-medium">Unit price</th>
                <th className="px-4 py-3 text-right font-medium">Discount</th>
                <th className="px-4 py-3 text-right font-medium">Tax</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item) => (
                <tr
                  key={item.id}
                  className="border-b last:border-b-0"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium">{item.itemName}</p>
                    {item.sku ? (
                      <p className="text-muted-foreground text-xs">SKU {item.sku}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {item.quantity} {item.uom ?? ''}
                  </td>
                  <td className="px-4 py-3 text-right">{formatCurrency(Number(item.unitPrice))}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(Number(item.discount))}</td>
                  <td className="px-4 py-3 text-right">
                    {item.taxRate}% ({formatCurrency(Number(item.taxAmount))})
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    {formatCurrency(Number(item.lineTotal))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-[1fr_320px]">
        <Card className="p-5">
          {invoice.notes ? (
            <>
              <h2 className="mb-2 font-semibold">Notes</h2>
              <p className="text-muted-foreground text-sm whitespace-pre-wrap">{invoice.notes}</p>
            </>
          ) : (
            <p className="text-muted-foreground text-sm">No additional notes.</p>
          )}
        </Card>
        <Card className="p-5">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt>Subtotal</dt>
              <dd>{formatCurrency(Number(invoice.subtotal))}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Discount</dt>
              <dd>{formatCurrency(Number(invoice.discount))}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Tax</dt>
              <dd>{formatCurrency(Number(invoice.taxAmount))}</dd>
            </div>
            {Number(invoice.shippingCharges) > 0 ? (
              <div className="flex justify-between">
                <dt>Shipping</dt>
                <dd>{formatCurrency(Number(invoice.shippingCharges))}</dd>
              </div>
            ) : null}
            <div className="flex justify-between border-t pt-2 text-base font-semibold">
              <dt>Grand total</dt>
              <dd>{formatCurrency(Number(invoice.total))}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Amount paid</dt>
              <dd>{formatCurrency(Number(invoice.amountPaid))}</dd>
            </div>
            <div className="flex justify-between font-medium">
              <dt>Balance due</dt>
              <dd>{formatCurrency(Number(invoice.balanceDue))}</dd>
            </div>
          </dl>
        </Card>
      </div>

      {canWrite ? (
        <div className="flex flex-wrap gap-2">
          {onCancel ? (
            <Button
              variant="outline"
              onClick={onCancel}
            >
              Cancel invoice
            </Button>
          ) : null}
          {onVoid ? (
            <Button
              variant="outline"
              onClick={onVoid}
            >
              Void invoice
            </Button>
          ) : null}
          {onDelete ? (
            <Button
              variant="destructive"
              onClick={onDelete}
            >
              Delete
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
