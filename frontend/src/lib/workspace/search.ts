import { loadCrmCustomers } from '@/lib/crm/api';
import { loadCompanyAssets } from '@/lib/crm/company-assets-api';
import { loadQuotations } from '@/lib/crm/quotation-api';
import { loadEmployees } from '@/lib/hr/api';
import {
  listInventoryProducts,
  listInventoryStock,
  searchInventoryVariants,
  type InventoryStockRow,
} from '@/lib/inventory/api';
import { listSuppliers } from '@/lib/procurement/api';
import { loadInvoices } from '@/lib/sales/invoice-api';
import { loadTenantMembers } from '@/lib/tenants/admin-api';

export type WorkspaceSearchKind =
  | 'product'
  | 'invoice'
  | 'document'
  | 'user'
  | 'customer'
  | 'supplier'
  | 'employee';

export type WorkspaceSearchHit = {
  id: string;
  kind: WorkspaceSearchKind;
  title: string;
  subtitle: string;
  /** Filter passed to the product list. Variant hits use the parent product name. */
  productQuery?: string;
  /** Available pieces. Null when stock could not be loaded. */
  stockLeft?: number | null;
  status?: string;
  amount?: number;
  /** Translatable role label for a workspace user, such as Owner. */
  role?: string;
  inactive?: boolean;
  fileName?: string;
  mimeType?: string;
  documentSource?: 'asset' | 'quotation';
};

export type WorkspaceSearchResult = {
  failed: boolean;
  products: WorkspaceSearchHit[];
  invoices: WorkspaceSearchHit[];
  documents: WorkspaceSearchHit[];
  users: WorkspaceSearchHit[];
  customers: WorkspaceSearchHit[];
  suppliers: WorkspaceSearchHit[];
  employees: WorkspaceSearchHit[];
};

const EMPTY: WorkspaceSearchResult = {
  failed: false,
  products: [],
  invoices: [],
  documents: [],
  users: [],
  customers: [],
  suppliers: [],
  employees: [],
};

async function settled<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch {
    return null;
  }
}

type VariantSearchRow = {
  id: string;
  label: string;
  sku: string;
  totalStock?: number;
  productId?: string;
  productName?: string;
};

function piecesForProduct(
  product: { sku: string; name: string },
  stock: InventoryStockRow[] | null,
): number | null {
  if (!stock) return null;
  const name = product.name.trim();
  const sku = product.sku.trim();
  const matched = stock.filter(
    (row) => row.sku === sku || row.name === name || row.name.startsWith(`${name} / `),
  );
  return matched.reduce((sum, row) => sum + Number(row.quantity || 0), 0);
}

function fileHint(mimeType: string, fileName: string, sizeBytes?: number) {
  const lower = `${mimeType} ${fileName}`.toLowerCase();
  const kind = lower.includes('pdf')
    ? 'PDF'
    : lower.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/.test(fileName.toLowerCase())
      ? 'Image'
      : 'Document';
  if (!sizeBytes || sizeBytes <= 0) return kind;
  if (sizeBytes < 1024) return `${kind} · ${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${kind} · ${Math.round(sizeBytes / 1024)} KB`;
  return `${kind} · ${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function roleLabel(role: string) {
  if (role === 'TENANT_OWNER') return 'Owner';
  if (role === 'TENANT_ADMIN') return 'Administrator';
  if (role === 'DEPARTMENT_ADMIN') return 'Department admin';
  if (role === 'USER') return 'User';
  return role.replaceAll('_', ' ').toLowerCase();
}

export async function searchWorkspace(query: string): Promise<WorkspaceSearchResult> {
  const term = query.trim();
  if (!term) return EMPTY;

  const [
    products,
    variants,
    stock,
    invoices,
    assets,
    quotations,
    members,
    customers,
    suppliers,
    employees,
  ] = await Promise.all([
    settled(listInventoryProducts(term)),
    settled(searchInventoryVariants(term)),
    settled(listInventoryStock()),
    settled(loadInvoices(term)),
    settled(loadCompanyAssets({ search: term })),
    settled(loadQuotations({ search: term })),
    settled(loadTenantMembers(term)),
    settled(loadCrmCustomers(term)),
    settled(listSuppliers(term)),
    settled(loadEmployees({ search: term })),
  ]);

  const failed = [
    products,
    variants,
    invoices,
    assets,
    quotations,
    members,
    customers,
    suppliers,
    employees,
  ].every((rows) => rows === null);

  const productHits: WorkspaceSearchHit[] = (products ?? []).slice(0, 6).map((product) => ({
    id: product.id,
    kind: 'product',
    title: product.name,
    subtitle: [product.sku, product.category?.name].filter(Boolean).join(' · '),
    productQuery: term,
    stockLeft: piecesForProduct(product, stock),
  }));

  const seenProducts = new Set(productHits.map((hit) => hit.id));
  const variantRows = (variants ?? []) as VariantSearchRow[];
  for (const variant of variantRows) {
    if (productHits.length >= 8) break;
    const parentId = variant.productId;
    const parentName = variant.productName?.trim();
    if (!parentId || !parentName || seenProducts.has(parentId)) continue;
    seenProducts.add(parentId);
    const label = variant.label?.trim();
    productHits.push({
      id: parentId,
      kind: 'product',
      title: label && label !== parentName ? label : parentName,
      subtitle: variant.sku ? `${variant.sku} · ${parentName}` : parentName,
      productQuery: parentName,
      stockLeft: typeof variant.totalStock === 'number' ? variant.totalStock : null,
    });
  }

  const assetHits: WorkspaceSearchHit[] = (assets ?? []).slice(0, 4).map((asset) => ({
    id: asset.id,
    kind: 'document',
    title: asset.name,
    subtitle: fileHint(asset.mimeType, asset.fileName, asset.sizeBytes),
    fileName: asset.fileName || asset.name,
    mimeType: asset.mimeType,
    documentSource: 'asset',
  }));

  const quotationHits: WorkspaceSearchHit[] = (quotations ?? []).slice(0, 4).map((quotation) => ({
    id: quotation.id,
    kind: 'document',
    title: quotation.quotationNumber,
    subtitle: [quotation.customer?.companyName, 'PDF'].filter(Boolean).join(' · '),
    fileName: `${quotation.quotationNumber}.pdf`,
    mimeType: 'application/pdf',
    documentSource: 'quotation',
  }));

  return {
    failed,
    products: productHits,
    invoices: (invoices ?? []).slice(0, 4).map((invoice) => ({
      id: invoice.id,
      kind: 'invoice',
      title: invoice.invoiceNumber,
      subtitle: invoice.customerName,
      status: invoice.status,
      amount: Number(invoice.total),
      fileName: `${invoice.invoiceNumber}.pdf`,
    })),
    documents: [...assetHits, ...quotationHits].slice(0, 6),
    users: (members ?? []).slice(0, 5).map((member) => ({
      id: member.userId || member.id,
      kind: 'user',
      title: member.fullName?.trim() || member.email,
      subtitle: [member.departmentName, member.email].filter(Boolean).join(' · '),
      role: roleLabel(member.role),
      inactive: !member.isActive,
    })),
    customers: (customers ?? []).slice(0, 4).map((customer) => ({
      id: customer.id,
      kind: 'customer',
      title: customer.companyName,
      subtitle: [customer.customerCode, customer.email].filter(Boolean).join(' · '),
    })),
    suppliers: (suppliers ?? []).slice(0, 4).map((supplier) => ({
      id: supplier.id,
      kind: 'supplier',
      title: supplier.name,
      subtitle: [supplier.code, supplier.email].filter(Boolean).join(' · '),
    })),
    employees: (employees ?? []).slice(0, 4).map((employee) => ({
      id: employee.id,
      kind: 'employee',
      title: `${employee.firstName} ${employee.lastName}`.trim(),
      subtitle: employee.employeeCode,
    })),
  };
}

export function flattenWorkspaceSearch(result: WorkspaceSearchResult): WorkspaceSearchHit[] {
  return [
    ...result.products,
    ...result.invoices,
    ...result.documents,
    ...result.users,
    ...result.customers,
    ...result.suppliers,
    ...result.employees,
  ];
}

const BASE_ORDER: WorkspaceSearchKind[] = [
  'product',
  'invoice',
  'document',
  'user',
  'customer',
  'supplier',
  'employee',
];

/** Put the group that best matches the typed words first. */
export function orderWorkspaceSearch(
  term: string,
  result: WorkspaceSearchResult,
): Array<{ kind: WorkspaceSearchKind; items: WorkspaceSearchHit[] }> {
  const q = term.trim().toLowerCase();
  const groups: Array<{ kind: WorkspaceSearchKind; items: WorkspaceSearchHit[] }> = [
    { kind: 'product', items: result.products },
    { kind: 'invoice', items: result.invoices },
    { kind: 'document', items: result.documents },
    { kind: 'user', items: result.users },
    { kind: 'customer', items: result.customers },
    { kind: 'supplier', items: result.suppliers },
    { kind: 'employee', items: result.employees },
  ];

  const score = (kind: WorkspaceSearchKind, items: WorkspaceSearchHit[]) => {
    if (items.length === 0) return -1;
    const exact = items.some((hit) => hit.title.toLowerCase() === q);
    const starts = items.some((hit) => hit.title.toLowerCase().startsWith(q));
    let bias = BASE_ORDER.indexOf(kind) * -0.1;
    if (kind === 'invoice' && /inv|invoice|فاتور/.test(q)) bias += 4;
    if (kind === 'document' && /pdf|doc|ملف|عرض/.test(q)) bias += 4;
    if (kind === 'user' && /user|staff|عضو|مستخدم/.test(q)) bias += 4;
    if (exact) return 20 + bias;
    if (starts) return 10 + bias;
    return 2 + bias;
  };

  return groups
    .filter((group) => group.items.length > 0)
    .sort((a, b) => score(b.kind, b.items) - score(a.kind, a.items));
}
