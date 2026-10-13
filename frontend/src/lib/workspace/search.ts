import { loadCrmCustomers } from '@/lib/crm/api';
import { loadEmployees } from '@/lib/hr/api';
import { listInventoryProducts, searchInventoryVariants } from '@/lib/inventory/api';
import { listSuppliers } from '@/lib/procurement/api';
import { loadInvoices } from '@/lib/sales/invoice-api';

export type WorkspaceSearchKind = 'product' | 'customer' | 'invoice' | 'supplier' | 'employee';

export type WorkspaceSearchHit = {
  id: string;
  kind: WorkspaceSearchKind;
  title: string;
  subtitle: string;
  /** Filter passed to the product list. Variant hits use the parent product name. */
  productQuery?: string;
};

export type WorkspaceSearchResult = {
  failed: boolean;
  products: WorkspaceSearchHit[];
  customers: WorkspaceSearchHit[];
  invoices: WorkspaceSearchHit[];
  suppliers: WorkspaceSearchHit[];
  employees: WorkspaceSearchHit[];
};

const EMPTY: WorkspaceSearchResult = {
  failed: false,
  products: [],
  customers: [],
  invoices: [],
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
  productId?: string;
  productName?: string;
};

export async function searchWorkspace(query: string): Promise<WorkspaceSearchResult> {
  const term = query.trim();
  if (!term) return EMPTY;

  const [products, variants, customers, invoices, suppliers, employees] = await Promise.all([
    settled(listInventoryProducts(term)),
    settled(searchInventoryVariants(term)),
    settled(loadCrmCustomers(term)),
    settled(loadInvoices(term)),
    settled(listSuppliers(term)),
    settled(loadEmployees({ search: term })),
  ]);

  const failed = [products, variants, customers, invoices, suppliers, employees].every(
    (rows) => rows === null,
  );

  const productHits: WorkspaceSearchHit[] = (products ?? []).slice(0, 6).map((product) => ({
    id: product.id,
    kind: 'product',
    title: product.name,
    subtitle: [product.sku, product.category?.name].filter(Boolean).join(' · '),
    productQuery: term,
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
    });
  }

  return {
    failed,
    products: productHits,
    customers: (customers ?? []).slice(0, 4).map((customer) => ({
      id: customer.id,
      kind: 'customer',
      title: customer.companyName,
      subtitle: [customer.customerCode, customer.email].filter(Boolean).join(' · '),
    })),
    invoices: (invoices ?? []).slice(0, 4).map((invoice) => ({
      id: invoice.id,
      kind: 'invoice',
      title: invoice.invoiceNumber,
      subtitle: invoice.customerName,
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
    ...result.customers,
    ...result.invoices,
    ...result.suppliers,
    ...result.employees,
  ];
}
