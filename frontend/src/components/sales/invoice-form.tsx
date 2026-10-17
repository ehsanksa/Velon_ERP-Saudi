import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { Minus, Plus, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  calculateInvoiceTotals,
  canWriteSales,
  normalizeVelonRole,
  standardVatRateOn,
} from '@velon/shared';
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
import { Textarea } from '@/components/ui/textarea';
import { useWorkspaceCurrency } from '@/contexts/workspace-currency';
import { getSessionMembershipRole } from '@/lib/auth/session';
import { loadCrmCustomers } from '@/lib/crm/api';
import { useT } from '@/lib/i18n/locale-context';
import {
  createInvoice,
  loadInvoice,
  loadInvoiceBootstrap,
  openInvoicePdf,
  searchInvoiceProducts,
  updateInvoice,
  type CreateInvoiceInput,
  type InvoiceBootstrap,
  type InvoiceLineInput,
  type InvoiceProductOption,
  type SalesInvoice,
  type SalesInvoicePaymentMethod,
} from '@/lib/sales/invoice-api';

type FormLine = InvoiceLineInput & { key: string };

const PAYMENT_METHODS: SalesInvoicePaymentMethod[] = [
  'CASH',
  'CARD',
  'BANK_TRANSFER',
  'WALLET',
  'GIFT',
  'OTHER',
];

function newLine(partial?: Partial<FormLine>): FormLine {
  return {
    key: crypto.randomUUID(),
    lineType: 'PRODUCT',
    itemName: '',
    quantity: 1,
    unitPrice: 0,
    discount: 0,
    taxTreatment: '',
    taxRate: 0,
    ...partial,
  };
}

export function InvoiceForm({ invoiceId }: { invoiceId?: string }) {
  const navigate = useNavigate();
  const t = useT();
  const { formatCurrency } = useWorkspaceCurrency();
  const canWrite = canWriteSales(normalizeVelonRole(getSessionMembershipRole() ?? 'USER'));
  const submittingRef = useRef(false);

  const [bootstrap, setBootstrap] = useState<InvoiceBootstrap | null>(null);
  const [customers, setCustomers] = useState<
    Array<{
      id: string;
      companyName: string;
      email: string | null;
      phone: string | null;
      address: string | null;
      taxId?: string | null;
      notes?: string | null;
    }>
  >([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerMode, setCustomerMode] = useState<'existing' | 'new'>('existing');
  const [customerId, setCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerTaxId, setCustomerTaxId] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');

  const [warehouseId, setWarehouseId] = useState('');
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<SalesInvoicePaymentMethod>('CASH');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [invoiceDiscount, setInvoiceDiscount] = useState('0');
  const [shippingCharges, setShippingCharges] = useState('0');
  const [amountPaid, setAmountPaid] = useState('0');

  const [lines, setLines] = useState<FormLine[]>([newLine()]);
  const [productSearch, setProductSearch] = useState('');
  const [productOptions, setProductOptions] = useState<InvoiceProductOption[]>([]);
  const [activeLineKey, setActiveLineKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editingNumber, setEditingNumber] = useState<string | null>(null);
  const [loadingExisting, setLoadingExisting] = useState(Boolean(invoiceId));

  const applyExisting = (invoice: SalesInvoice) => {
    setEditingNumber(invoice.invoiceNumber);
    setCustomerMode(invoice.customerId ? 'existing' : 'new');
    setCustomerId(invoice.customerId ?? '');
    setCustomerName(invoice.customerName);
    setCustomerPhone(invoice.customerPhone ?? '');
    setCustomerEmail(invoice.customerEmail ?? '');
    setCustomerAddress(invoice.customerAddress ?? '');
    setCustomerTaxId(invoice.customerTaxId ?? '');
    setCustomerNotes(invoice.customerNotes ?? '');
    setWarehouseId(invoice.warehouseId ?? '');
    setIssueDate(invoice.issueDate.slice(0, 10));
    setDueDate(invoice.dueDate ? invoice.dueDate.slice(0, 10) : '');
    setPaymentMethod(invoice.paymentMethod ?? 'CASH');
    setReferenceNumber(invoice.referenceNumber ?? '');
    setNotes(invoice.notes ?? '');
    setInvoiceDiscount(String(invoice.discount ?? 0));
    setShippingCharges(String(invoice.shippingCharges ?? 0));
    setAmountPaid(String(invoice.amountPaid ?? 0));
    setLines(
      invoice.items.length > 0
        ? invoice.items.map((item) =>
            newLine({
              lineType: item.lineType,
              productId: item.productId ?? undefined,
              variantId: item.variantId ?? undefined,
              itemName: item.itemName,
              sku: item.sku ?? undefined,
              description: item.description ?? undefined,
              uom: item.uom ?? undefined,
              quantity: Number(item.quantity),
              unitPrice: Number(item.unitPrice),
              discount: Number(item.discount),
              taxTreatment:
                item.taxTreatment || (Number(item.taxRate) > 0 ? 'STANDARD' : 'ZERO_RATED'),
              taxRate: Number(item.taxRate),
            }),
          )
        : [newLine()],
    );
  };

  useEffect(() => {
    let cancelled = false;
    setLoadingExisting(Boolean(invoiceId));
    void (async () => {
      try {
        const [boot, cust, existing] = await Promise.all([
          loadInvoiceBootstrap(),
          loadCrmCustomers(''),
          invoiceId ? loadInvoice(invoiceId) : Promise.resolve(null),
        ]);
        if (cancelled) return;
        setBootstrap(boot);
        setCustomers(cust);
        if (existing) {
          applyExisting(existing);
        } else if (boot.warehouses.length === 1) {
          setWarehouseId(boot.warehouses[0]!.id);
        }
      } catch (err) {
        if (!cancelled) {
          toast.error(err instanceof Error ? err.message : 'Could not load invoice form');
        }
      } finally {
        if (!cancelled) setLoadingExisting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [invoiceId]);

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return customers.slice(0, 12);
    return customers
      .filter(
        (c) =>
          c.companyName.toLowerCase().includes(q) ||
          (c.email ?? '').toLowerCase().includes(q) ||
          (c.phone ?? '').includes(q),
      )
      .slice(0, 12);
  }, [customers, customerSearch]);

  const totals = useMemo(
    () =>
      calculateInvoiceTotals({
        lines: lines.map((line) => ({
          quantity: Number(line.quantity) || 0,
          unitPrice: Number(line.unitPrice) || 0,
          discount: Number(line.discount) || 0,
          taxRate: Number(line.taxRate) || 0,
        })),
        invoiceDiscount: Number(invoiceDiscount) || 0,
        shippingCharges: Number(shippingCharges) || 0,
        amountPaid: Number(amountPaid) || 0,
      }),
    [lines, invoiceDiscount, shippingCharges, amountPaid],
  );

  const selectCustomer = (id: string) => {
    const customer = customers.find((c) => c.id === id);
    if (!customer) return;
    setCustomerId(customer.id);
    setCustomerName(customer.companyName);
    setCustomerPhone(customer.phone ?? '');
    setCustomerEmail(customer.email ?? '');
    setCustomerAddress(customer.address ?? '');
    setCustomerTaxId(customer.taxId ?? '');
    setCustomerNotes(customer.notes ?? '');
  };

  const refreshProducts = useCallback(
    async (search: string) => {
      if (!warehouseId) return;
      try {
        const rows = await searchInvoiceProducts(warehouseId, search);
        setProductOptions(rows);
      } catch {
        setProductOptions([]);
      }
    },
    [warehouseId],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshProducts(productSearch);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [productSearch, refreshProducts]);

  const addProductToLine = (lineKey: string, product: InvoiceProductOption) => {
    setLines((prev) =>
      prev.map((line) => {
        if (line.key !== lineKey) return line;
        return {
          ...line,
          lineType: 'PRODUCT',
          productId: product.productId,
          variantId: product.variantId ?? undefined,
          itemName: product.name,
          sku: product.sku,
          uom: product.uom,
          unitPrice: product.unitPrice,
        };
      }),
    );
    setActiveLineKey(null);
    setProductSearch('');
  };

  const mergeOrAddProduct = (product: InvoiceProductOption) => {
    const existing = lines.find(
      (line) =>
        line.lineType === 'PRODUCT' &&
        line.productId === product.productId &&
        (line.variantId ?? null) === (product.variantId ?? null),
    );
    if (existing) {
      setLines((prev) =>
        prev.map((line) =>
          line.key === existing.key ? { ...line, quantity: Number(line.quantity) + 1 } : line,
        ),
      );
      return;
    }
    setLines((prev) => [
      ...prev,
      newLine({
        lineType: 'PRODUCT',
        productId: product.productId,
        variantId: product.variantId ?? undefined,
        itemName: product.name,
        sku: product.sku,
        uom: product.uom,
        unitPrice: product.unitPrice,
        quantity: 1,
        taxTreatment: product.taxTreatment || 'STANDARD',
        taxRate: product.taxRate ?? 0,
      }),
    ]);
  };

  const buildPayload = (action: CreateInvoiceInput['action']): CreateInvoiceInput => ({
    customerId: customerMode === 'existing' && customerId ? customerId : undefined,
    customerName: customerName.trim(),
    customerPhone: customerPhone || undefined,
    customerEmail: customerEmail || undefined,
    customerAddress: customerAddress || undefined,
    customerTaxId: customerTaxId || undefined,
    customerNotes: customerNotes || undefined,
    createCustomer: customerMode === 'new' && !invoiceId,
    issueDate,
    dueDate: dueDate || undefined,
    paymentMethod,
    referenceNumber: referenceNumber || undefined,
    notes: notes.trim(),
    warehouseId: warehouseId || undefined,
    discount: Number(invoiceDiscount) || 0,
    shippingCharges: Number(shippingCharges) || 0,
    amountPaid: action === 'save_paid' ? totals.total : Number(amountPaid) || 0,
    action,
    idempotencyKey: crypto.randomUUID(),
    lines: lines.filter((line) => line.itemName.trim()).map(({ key: _key, ...line }) => line),
  });

  const submit = async (action: CreateInvoiceInput['action']) => {
    if (!canWrite) {
      toast.error(t('You do not have permission to create invoices.'));
      return;
    }
    if (!customerName.trim()) {
      toast.error(t('Customer name is required.'));
      return;
    }
    if (!warehouseId && lines.some((line) => line.lineType !== 'CUSTOM' && line.productId)) {
      toast.error(t('Select a warehouse before adding inventory products.'));
      return;
    }
    if (lines.every((line) => !line.itemName.trim())) {
      toast.error(t('Add at least one line item.'));
      return;
    }
    if (action !== 'draft' && lines.some((line) => line.itemName.trim() && !line.taxTreatment)) {
      toast.error(t('Select a VAT treatment for every line.'));
      return;
    }
    if (submittingRef.current) return;
    submittingRef.current = true;
    setBusy(true);
    try {
      const payload = buildPayload(action);
      const invoice = invoiceId
        ? await updateInvoice(invoiceId, payload)
        : await createInvoice(payload);
      toast.success(t('Invoice {number} saved', { number: invoice.invoiceNumber }));
      if (action === 'save_print') {
        try {
          await openInvoicePdf(invoice.id);
        } catch (pdfErr) {
          toast.error(pdfErr instanceof Error ? pdfErr.message : t('Could not open invoice PDF'));
        }
      }
      await navigate({ to: '/app/invoices/$invoiceId', params: { invoiceId: invoice.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('Could not save invoice'));
    } finally {
      submittingRef.current = false;
      setBusy(false);
    }
  };

  if (loadingExisting) {
    return <p className="text-muted-foreground text-sm">{t('Loading invoice…')}</p>;
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <Card className="p-5">
          <h2 className="mb-4 text-lg font-semibold">{t('Customer details')}</h2>
          <div className="mb-4 flex gap-2">
            <Button
              type="button"
              variant={customerMode === 'existing' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCustomerMode('existing')}
            >
              {t('Existing customer')}
            </Button>
            <Button
              type="button"
              variant={customerMode === 'new' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setCustomerMode('new');
                setCustomerId('');
              }}
            >
              {t('New customer')}
            </Button>
          </div>
          {customerMode === 'existing' ? (
            <div className="space-y-3">
              <div>
                <Label>Search customer</Label>
                <Input
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  placeholder="Name, email, or phone"
                />
              </div>
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-2">
                {filteredCustomers.map((customer) => (
                  <button
                    key={customer.id}
                    type="button"
                    className={`hover:bg-muted w-full rounded px-2 py-1.5 text-left text-sm ${
                      customerId === customer.id ? 'bg-muted font-medium' : ''
                    }`}
                    onClick={() => selectCustomer(customer.id)}
                  >
                    {customer.companyName}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div>
              <Label>Name</Label>
              <Input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </div>
            <div>
              <Label>Phone</Label>
              <Input
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
              />
            </div>
            <div>
              <Label>Customer VAT number</Label>
              <Input
                value={customerTaxId}
                onChange={(e) => setCustomerTaxId(e.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <Label>Billing address</Label>
              <Textarea
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
                rows={2}
              />
            </div>
            <div className="md:col-span-2">
              <Label>Customer notes</Label>
              <Textarea
                value={customerNotes}
                onChange={(e) => setCustomerNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 text-lg font-semibold">Invoice details</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>Invoice number</Label>
              <Input
                value={editingNumber ?? bootstrap?.invoiceNumberPreview ?? 'Auto-generated'}
                disabled
              />
            </div>
            <div>
              <Label>Warehouse / outlet</Label>
              <Select
                value={warehouseId}
                onValueChange={setWarehouseId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select warehouse" />
                </SelectTrigger>
                <SelectContent>
                  {(bootstrap?.warehouses ?? []).map((warehouse) => (
                    <SelectItem
                      key={warehouse.id}
                      value={warehouse.id}
                    >
                      {warehouse.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Invoice date</Label>
              <Input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
              />
            </div>
            <div>
              <Label>Due date</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
            <div>
              <Label>Payment method</Label>
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
            <div>
              <Label>Reference / PO number</Label>
              <Input
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <Label>Invoice notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">{t('Products')}</h2>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setLines((prev) => [...prev, newLine({ lineType: 'CUSTOM' })])}
              >
                {t('Add custom item')}
              </Button>
            </div>
          </div>

          <div className="mb-4">
            <Label>{t('Search products')}</Label>
            <div className="relative">
              <Search className="text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4" />
              <Input
                className="pl-9"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder={t('Name, SKU, barcode, or variant')}
                disabled={!warehouseId}
              />
            </div>
            {productSearch && productOptions.length > 0 ? (
              <div className="mt-2 max-h-48 overflow-y-auto rounded-md border">
                {productOptions.map((product) => (
                  <button
                    key={`${product.productId}:${product.variantId ?? ''}`}
                    type="button"
                    className="hover:bg-muted flex w-full items-center justify-between gap-3 border-b px-3 py-2 text-left text-sm last:border-b-0"
                    onClick={() => mergeOrAddProduct(product)}
                  >
                    <span>
                      <span className="font-medium">{product.name}</span>
                      <span className="text-muted-foreground block text-xs">
                        {product.sku} · Stock {product.availableQty} {product.uom}
                      </span>
                    </span>
                    <span className="font-medium">{formatCurrency(product.unitPrice)}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="space-y-3">
            {lines.map((line, index) => (
              <div
                key={line.key}
                className="rounded-lg border p-3"
              >
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-medium">Line {index + 1}</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setLines((prev) => prev.filter((row) => row.key !== line.key))}
                    disabled={lines.length === 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid gap-2 md:grid-cols-6">
                  <div className="md:col-span-2">
                    <Label>Product</Label>
                    <Input
                      value={line.itemName}
                      onChange={(e) =>
                        setLines((prev) =>
                          prev.map((row) =>
                            row.key === line.key ? { ...row, itemName: e.target.value } : row,
                          ),
                        )
                      }
                      onFocus={() => setActiveLineKey(line.key)}
                      placeholder="Select from search or enter custom item"
                    />
                    {activeLineKey === line.key && productOptions.length > 0 ? (
                      <div className="mt-1 max-h-32 overflow-y-auto rounded border">
                        {productOptions.slice(0, 6).map((product) => (
                          <button
                            key={`${product.productId}:${product.variantId ?? ''}:line`}
                            type="button"
                            className="hover:bg-muted block w-full px-2 py-1 text-left text-xs"
                            onClick={() => addProductToLine(line.key, product)}
                          >
                            {product.name} · {formatCurrency(product.unitPrice)}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div>
                    <Label>Qty</Label>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() =>
                          setLines((prev) =>
                            prev.map((row) =>
                              row.key === line.key
                                ? { ...row, quantity: Math.max(0.0001, Number(row.quantity) - 1) }
                                : row,
                            ),
                          )
                        }
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <Input
                        type="number"
                        min="0.0001"
                        step="any"
                        value={line.quantity}
                        onChange={(e) =>
                          setLines((prev) =>
                            prev.map((row) =>
                              row.key === line.key
                                ? { ...row, quantity: Number(e.target.value) }
                                : row,
                            ),
                          )
                        }
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() =>
                          setLines((prev) =>
                            prev.map((row) =>
                              row.key === line.key
                                ? { ...row, quantity: Number(row.quantity) + 1 }
                                : row,
                            ),
                          )
                        }
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <Label>Unit price</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.unitPrice}
                      onChange={(e) =>
                        setLines((prev) =>
                          prev.map((row) =>
                            row.key === line.key
                              ? { ...row, unitPrice: Number(e.target.value) }
                              : row,
                          ),
                        )
                      }
                    />
                  </div>
                  <div>
                    <Label>Discount</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.discount ?? 0}
                      onChange={(e) =>
                        setLines((prev) =>
                          prev.map((row) =>
                            row.key === line.key
                              ? { ...row, discount: Number(e.target.value) }
                              : row,
                          ),
                        )
                      }
                    />
                  </div>
                  <div>
                    <Label>{t('VAT treatment')}</Label>
                    <Select
                      value={line.taxTreatment || undefined}
                      onValueChange={(value) =>
                        setLines((prev) =>
                          prev.map((row) =>
                            row.key === line.key
                              ? {
                                  ...row,
                                  taxTreatment: value,
                                  taxRate:
                                    value === 'STANDARD' ? (standardVatRateOn(new Date()) ?? 0) : 0,
                                }
                              : row,
                          ),
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select treatment" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="STANDARD">Standard</SelectItem>
                        <SelectItem value="ZERO_RATED">Zero-rated</SelectItem>
                        <SelectItem value="EXEMPT">Exempt</SelectItem>
                        <SelectItem value="OUT_OF_SCOPE">Out of scope</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="space-y-4 xl:sticky xl:top-4 xl:self-start">
        <Card className="p-5">
          <h2 className="mb-4 text-lg font-semibold">Summary</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt>Subtotal</dt>
              <dd>{formatCurrency(totals.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Tax</dt>
              <dd>{formatCurrency(totals.taxAmount)}</dd>
            </div>
            <div className="flex justify-between border-t pt-2 text-base font-semibold">
              <dt>Total</dt>
              <dd>{formatCurrency(totals.total)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Balance due</dt>
              <dd>{formatCurrency(totals.balanceDue)}</dd>
            </div>
          </dl>
          <div className="mt-4 grid gap-2">
            <div>
              <Label>Invoice discount</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={invoiceDiscount}
                onChange={(e) => setInvoiceDiscount(e.target.value)}
              />
            </div>
            <div>
              <Label>Shipping</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={shippingCharges}
                onChange={(e) => setShippingCharges(e.target.value)}
              />
            </div>
            <div>
              <Label>Amount paid</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-4 grid gap-2">
            <Button
              disabled={busy}
              onClick={() => void submit('save')}
            >
              Save invoice
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => void submit('draft')}
            >
              Save as draft
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => void submit('save_paid')}
            >
              Save and mark paid
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => void submit('save_print')}
            >
              Save and print
            </Button>
            <Button
              variant="ghost"
              asChild
            >
              <Link to="/app/invoices">Cancel</Link>
            </Button>
          </div>
        </Card>
        {!bootstrap?.hasLogo ? (
          <Card className="border-amber-500/30 bg-amber-500/5 p-4 text-sm">
            <p className="font-medium">Add your company logo</p>
            <p className="text-muted-foreground mt-1">
              Logos appear on invoice PDF headers and watermarks.
            </p>
            <Button
              className="mt-3"
              variant="outline"
              size="sm"
              asChild
            >
              <Link
                to="/app/settings/admin"
                search={{ tab: 'general', section: 'company' }}
              >
                Upload logo
              </Link>
            </Button>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
