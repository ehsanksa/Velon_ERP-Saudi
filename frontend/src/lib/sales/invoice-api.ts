import { apiFetch } from '@/lib/api/client';
import { API_V1_BASE } from '@/lib/api/config';
import { getAccessToken } from '@/lib/auth/session';

export type SalesInvoiceStatus =
  | 'DRAFT'
  | 'UNPAID'
  | 'PARTIALLY_PAID'
  | 'PAID'
  | 'OVERDUE'
  | 'CANCELLED'
  | 'VOID';

export type SalesInvoicePaymentMethod =
  | 'CASH'
  | 'CARD'
  | 'UPI'
  | 'BANK_TRANSFER'
  | 'WALLET'
  | 'GIFT'
  | 'OTHER';

export type SalesInvoiceLineType = 'PRODUCT' | 'CUSTOM';

export type SalesInvoiceItem = {
  id: string;
  lineType: SalesInvoiceLineType;
  productId: string | null;
  variantId: string | null;
  itemName: string;
  sku: string | null;
  description: string | null;
  uom: string | null;
  quantity: string | number;
  unitPrice: string | number;
  discount: string | number;
  taxTreatment?: string | null;
  taxRate: string | number;
  taxAmount: string | number;
  lineSubtotal: string | number;
  lineTotal: string | number;
  position: number;
};

export type SalesInvoicePayment = {
  id: string;
  amount: string | number;
  method: SalesInvoicePaymentMethod;
  reference: string | null;
  notes: string | null;
  paidAt: string;
};

export type SalesInvoice = {
  id: string;
  tenantId: string;
  workspaceId: string;
  invoiceNumber: string;
  customerId: string | null;
  customerName: string;
  customerPhone: string | null;
  customerEmail: string | null;
  customerAddress: string | null;
  customerTaxId: string | null;
  customerNotes: string | null;
  issueDate: string;
  dueDate: string | null;
  status: SalesInvoiceStatus;
  paymentMethod: SalesInvoicePaymentMethod | null;
  salespersonName: string | null;
  referenceNumber: string | null;
  notes: string | null;
  footerNotes: string | null;
  warehouseId: string | null;
  currency: string;
  invoiceKind?: string;
  zatcaStatus?: string;
  zatcaStatusDetail?: string | null;
  subtotal: string | number;
  discount: string | number;
  taxAmount: string | number;
  shippingCharges: string | number;
  roundingAdjustment: string | number;
  total: string | number;
  amountPaid: string | number;
  balanceDue: string | number;
  items: SalesInvoiceItem[];
  payments: SalesInvoicePayment[];
  warehouse?: { id: string; name: string; code: string } | null;
  customer?: {
    id: string;
    companyName: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    taxId: string | null;
    notes: string | null;
  } | null;
};

export type InvoiceBootstrap = {
  currency: string;
  currencySymbol: string | null;
  invoiceNumberPreview: string;
  warehouses: Array<{ id: string; name: string; code: string }>;
  hasLogo: boolean;
  companyName: string;
};

export type InvoiceProductOption = {
  productId: string;
  variantId: string | null;
  stockId?: string;
  name: string;
  sku: string;
  barcode: string | null;
  unitPrice: number;
  uom: string;
  availableQty: number;
  hasVariants: boolean;
  itemType?: 'PRODUCT' | 'SERVICE';
  taxTreatment?: string;
  taxRate?: number;
};

export type InvoiceLineInput = {
  lineType?: SalesInvoiceLineType;
  productId?: string;
  variantId?: string;
  itemName: string;
  sku?: string;
  description?: string;
  uom?: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  taxRate?: number;
  taxTreatment?: string;
};

export type CreateInvoiceInput = {
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  customerAddress?: string;
  customerTaxId?: string;
  customerNotes?: string;
  createCustomer?: boolean;
  issueDate?: string;
  dueDate?: string;
  paymentMethod?: SalesInvoicePaymentMethod;
  salespersonId?: string;
  referenceNumber?: string;
  notes?: string;
  footerNotes?: string;
  warehouseId?: string;
  discount?: number;
  shippingCharges?: number;
  roundingAdjustment?: number;
  amountPaid?: number;
  action: 'draft' | 'save' | 'save_paid' | 'save_print';
  idempotencyKey?: string;
  lines: InvoiceLineInput[];
};

export async function loadInvoiceBootstrap() {
  return apiFetch<InvoiceBootstrap>('/sales/invoices/bootstrap');
}

export async function searchInvoiceProducts(warehouseId: string, search?: string) {
  const params = new URLSearchParams({ warehouseId });
  if (search?.trim()) params.set('search', search.trim());
  return apiFetch<InvoiceProductOption[]>(`/sales/invoices/products?${params}`);
}

export async function loadInvoices(search?: string, status?: SalesInvoiceStatus) {
  const params = new URLSearchParams();
  if (search?.trim()) params.set('search', search.trim());
  if (status) params.set('status', status);
  const q = params.toString();
  return apiFetch<SalesInvoice[]>(`/sales/invoices${q ? `?${q}` : ''}`);
}

export async function loadInvoice(id: string) {
  return apiFetch<SalesInvoice>(`/sales/invoices/${id}`);
}

export async function createInvoice(input: CreateInvoiceInput) {
  return apiFetch<SalesInvoice>('/sales/invoices', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateInvoice(id: string, input: CreateInvoiceInput) {
  return apiFetch<SalesInvoice>(`/sales/invoices/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function recordInvoicePayment(
  id: string,
  input: {
    amount: number;
    method: SalesInvoicePaymentMethod;
    reference?: string;
    notes?: string;
  },
) {
  return apiFetch<SalesInvoice>(`/sales/invoices/${id}/payments`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function cancelInvoice(id: string) {
  return apiFetch<SalesInvoice>(`/sales/invoices/${id}/cancel`, { method: 'POST' });
}

export async function voidInvoice(id: string) {
  return apiFetch<SalesInvoice>(`/sales/invoices/${id}/void`, { method: 'POST' });
}

export async function duplicateInvoice(id: string) {
  return apiFetch<SalesInvoice>(`/sales/invoices/${id}/duplicate`, { method: 'POST' });
}

export async function deleteInvoice(id: string) {
  return apiFetch<{ deleted: boolean }>(`/sales/invoices/${id}`, { method: 'DELETE' });
}

export async function sendInvoiceEmail(id: string, input?: { to?: string; message?: string }) {
  return apiFetch<{ sent: boolean; warning: string | null }>(`/sales/invoices/${id}/email`, {
    method: 'POST',
    body: JSON.stringify(input ?? {}),
  });
}

export function invoicePdfUrl(id: string) {
  return `${API_V1_BASE}/sales/invoices/${id}/pdf`;
}

/** Authenticated PDF fetch — bare window.open/href cannot send Bearer token. */
export async function downloadInvoicePdf(id: string) {
  const token = getAccessToken();
  const res = await fetch(invoicePdfUrl(id), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: 'include',
  });
  if (!res.ok) {
    let message = 'Failed to download invoice PDF';
    try {
      const body = (await res.json()) as { message?: string | string[] };
      if (typeof body.message === 'string') message = body.message;
      else if (Array.isArray(body.message)) message = body.message.join(', ');
    } catch {
      /* keep the default message */
    }
    throw new Error(message);
  }
  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.includes('application/pdf')) {
    throw new Error('Invoice PDF is not available. The file could not be opened.');
  }
  const blob = await res.blob();
  const header = new TextDecoder().decode(await blob.slice(0, 5).arrayBuffer());
  if (!header.startsWith('%PDF')) {
    throw new Error('Invoice PDF is not available. The file could not be opened.');
  }
  return blob;
}

export async function openInvoicePdf(
  id: string,
  options?: { downloadName?: string },
): Promise<void> {
  const blob = await downloadInvoicePdf(id);
  const url = URL.createObjectURL(blob);
  try {
    if (options?.downloadName) {
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = options.downloadName;
      anchor.click();
    } else {
      const opened = window.open(url, '_blank', 'noopener');
      if (!opened) {
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.target = '_blank';
        anchor.rel = 'noreferrer';
        anchor.click();
      }
    }
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}
