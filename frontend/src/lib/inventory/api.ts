import { apiFetch } from '@/lib/api/client';

export type InventoryCategory = {
  id: string;
  name: string;
  description: string | null;
  parentId: string | null;
};

export type InventoryProduct = {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  itemType?: 'PRODUCT' | 'SERVICE';
  status: string;
  uom: string;
  unitPrice: number;
  abcClass: string;
  velocity: string;
  batchTracked: boolean;
  barcode: string | null;
  imageDataUrl: string | null;
  categoryId: string | null;
  hasVariants?: boolean;
  variantCount?: number;
  onHand?: number | null;
  category?: { id: string; name: string } | null;
  attributes?: ProductVariantAttribute[];
  variants?: ProductVariant[];
};

export type InventoryImportOptions = {
  createMissingCategories?: boolean;
  updateExisting?: boolean;
  stageForApproval?: boolean;
  createMissingWarehouses?: boolean;
};

export type InventoryImportIssue = {
  row: number;
  field?: string;
  message: string;
  severity: 'error' | 'warning';
};

export type InventoryImportPreview = {
  total: number;
  valid: number;
  createCount: number;
  updateCount: number;
  errorCount: number;
  warningCount: number;
  issues: InventoryImportIssue[];
  rows: Array<{
    rowNumber: number;
    sku: string | null;
    name: string;
    itemType: string;
    action: 'create' | 'update' | 'skip';
  }>;
};

export type InventoryImportResult = InventoryImportPreview & {
  created: number;
  updated: number;
  categoriesCreated: number;
  warehousesCreated: number;
  productIds: string[];
};

export type InventoryImportTemplate = {
  columns: string[];
  sampleRows: Record<string, string>[];
  csv: string;
  filename: string;
  notes: string[];
};

export type ProductVariantAttribute = {
  id: string;
  name: string;
  sortOrder: number;
  values: Array<{ id: string; value: string; sortOrder: number }>;
};

export type ProductVariant = {
  id: string;
  label: string;
  sku: string;
  barcode: string | null;
  unitPrice: number;
  costPrice: number;
  salePrice: number | null;
  effectivePrice: number;
  imageDataUrl: string | null;
  status: string;
  sortOrder: number;
  totalStock: number;
  options: Array<{
    attributeId: string;
    attributeName: string;
    valueId: string;
    value: string;
  }>;
  stock?: Array<{
    id: string;
    warehouseId: string;
    warehouseName: string;
    quantity: number;
    available: number;
    minStock: number;
    reorderLevel: number;
  }>;
};

export type ProductVariantAttributeInput = {
  name: string;
  values: string[];
};

export type ProductVariantInput = {
  id?: string;
  label?: string;
  sku: string;
  barcode?: string;
  unitPrice?: number;
  costPrice?: number;
  salePrice?: number;
  quantity?: number;
  minStock?: number;
  reorderLevel?: number;
  warehouseId?: string;
  imageDataUrl?: string;
  status?: string;
  optionValues?: Array<{ attributeName: string; value: string }>;
};

export type ProductVariantsPayload = {
  hasVariants: boolean;
  attributes?: ProductVariantAttributeInput[];
  variants?: ProductVariantInput[];
};

export type InventoryWarehouse = {
  id: string;
  code: string;
  name: string;
  location: string | null;
  phone: string | null;
  email: string | null;
  managerName: string | null;
  isActive: boolean;
};

export type InventoryStockRow = {
  id: string;
  sku: string;
  name: string;
  site: string;
  quantity: number;
  stockLevel: 'healthy' | 'low' | 'critical';
  safetyStock: number;
  reorderPoint: number;
  abcClass: 'A' | 'B' | 'C';
  velocity: 'fast' | 'medium' | 'slow';
  batchTracked: boolean;
  variantParent?: string;
  unitPrice: number;
  mfgDate?: string;
  expiryDate?: string;
  expiryStatus?: 'ok' | 'expiring_soon' | 'expired' | 'no_expiry';
  batches?: Array<{
    id: string;
    quantity: number;
    mfgDate: string;
    expiryDate: string;
    expiryStatus: string;
  }>;
};

function mapProduct(row: Record<string, unknown>): InventoryProduct {
  const price = row.unitPrice;
  const unitPrice =
    price && typeof price === 'object' && 'toNumber' in price
      ? (price as { toNumber(): number }).toNumber()
      : Number(price ?? 0);
  return { ...row, unitPrice } as InventoryProduct;
}

export async function listInventoryCategories() {
  return apiFetch<InventoryCategory[]>('/inventory/categories');
}

export async function createInventoryCategory(body: {
  name: string;
  description?: string;
  parentId?: string;
}) {
  return apiFetch<InventoryCategory>('/inventory/categories', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function updateInventoryCategory(
  id: string,
  body: { name?: string; description?: string; parentId?: string },
) {
  return apiFetch<InventoryCategory>(`/inventory/categories/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function deleteInventoryCategory(id: string) {
  return apiFetch<{ ok: boolean }>(`/inventory/categories/${id}`, { method: 'DELETE' });
}

export async function listInventoryStock(expiryFilter?: string) {
  const q = expiryFilter ? `?expiryFilter=${encodeURIComponent(expiryFilter)}` : '';
  return apiFetch<InventoryStockRow[]>(`/inventory/stock${q}`);
}

export async function listInventoryProducts(search?: string) {
  const q = search ? `?search=${encodeURIComponent(search)}` : '';
  const rows = await apiFetch<Record<string, unknown>[]>(`/inventory/products${q}`);
  return rows.map(mapProduct);
}

export async function getInventoryProduct(id: string) {
  const row = await apiFetch<Record<string, unknown>>(`/inventory/products/${id}`);
  return mapProduct(row);
}

export async function searchInventoryVariants(query: string) {
  const q = encodeURIComponent(query);
  return apiFetch<ProductVariant[]>(`/inventory/variants/search?q=${q}`);
}

export async function listInventoryWarehouses() {
  return apiFetch<InventoryWarehouse[]>('/inventory/warehouses');
}

export async function createInventoryProduct(body: Record<string, unknown>) {
  const row = await apiFetch<Record<string, unknown>>('/inventory/products', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return mapProduct(row);
}

export async function deleteInventoryItems(
  items: Array<{ productId?: string; variantId?: string }>,
) {
  return apiFetch<{ deleted: number }>('/inventory/items/delete', {
    method: 'POST',
    body: JSON.stringify({ items }),
  });
}

export async function updateInventoryProduct(id: string, body: Record<string, unknown>) {
  const row = await apiFetch<Record<string, unknown>>(`/inventory/products/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  return mapProduct(row);
}

export async function createInventoryWarehouse(body: {
  name: string;
  code?: string;
  location?: string;
  phone?: string;
  email?: string;
  managerName?: string;
}) {
  return apiFetch<InventoryWarehouse>('/inventory/warehouses', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function updateInventoryWarehouse(
  id: string,
  body: {
    name?: string;
    code?: string;
    location?: string;
    phone?: string;
    email?: string;
    managerName?: string;
    isActive?: boolean;
  },
) {
  return apiFetch<InventoryWarehouse>(`/inventory/warehouses/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function receiveInventoryStock(body: {
  productId: string;
  variantId?: string;
  warehouseId?: string;
  site?: string;
  quantity: number;
  minStock?: number;
  reorderLevel?: number;
  mfgDate?: string;
  expiryDate?: string;
}) {
  return apiFetch<InventoryStockRow>('/inventory/stock/receive', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function updateInventoryStock(id: string, body: Record<string, unknown>) {
  return apiFetch<InventoryStockRow>(`/inventory/stock/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function getInventoryImportTemplate() {
  return apiFetch<InventoryImportTemplate>('/inventory/products/import/template');
}

export async function validateInventoryImport(
  rows: Record<string, unknown>[],
  options: InventoryImportOptions = {},
) {
  return apiFetch<InventoryImportPreview>('/inventory/products/import/validate', {
    method: 'POST',
    body: JSON.stringify({ rows, options }),
  });
}

export async function executeInventoryImport(
  rows: Record<string, unknown>[],
  options: InventoryImportOptions = {},
) {
  return apiFetch<InventoryImportResult>('/inventory/products/import', {
    method: 'POST',
    body: JSON.stringify({ rows, options }),
  });
}
