export type InventoryImportRow = {
  sku?: string;
  name: string;
  itemType?: string;
  description?: string;
  category?: string;
  uom?: string;
  unitPrice?: string;
  costPrice?: string;
  barcode?: string;
  status?: string;
  warehouse?: string;
  quantity?: string;
  reorderPoint?: string;
  safetyStock?: string;
  batchTracked?: string;
};

export const INVENTORY_IMPORT_COLUMNS = [
  'sku',
  'name',
  'itemType',
  'description',
  'category',
  'uom',
  'unitPrice',
  'costPrice',
  'barcode',
  'status',
  'warehouse',
  'quantity',
  'reorderPoint',
  'safetyStock',
  'batchTracked',
] as const;

const COLUMN_ALIASES: Record<string, (typeof INVENTORY_IMPORT_COLUMNS)[number]> = {
  sku: 'sku',
  'sku / service id': 'sku',
  serviceid: 'sku',
  'service id': 'sku',
  name: 'name',
  itemtype: 'itemType',
  type: 'itemType',
  'item type': 'itemType',
  description: 'description',
  category: 'category',
  uom: 'uom',
  'unit of measure': 'uom',
  unitprice: 'unitPrice',
  price: 'unitPrice',
  'selling price': 'unitPrice',
  costprice: 'costPrice',
  cost: 'costPrice',
  barcode: 'barcode',
  status: 'status',
  warehouse: 'warehouse',
  site: 'warehouse',
  quantity: 'quantity',
  qty: 'quantity',
  reorderpoint: 'reorderPoint',
  'reorder point': 'reorderPoint',
  safetystock: 'safetyStock',
  'safety stock': 'safetyStock',
  batchtracked: 'batchTracked',
  'batch tracked': 'batchTracked',
};

function normalizeHeader(raw: string): string {
  return raw
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

/** Minimal RFC4180-ish CSV parser (quotes, commas, CRLF). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  const input = text.replace(/^\uFEFF/, '');

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    const next = input[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ',') {
      row.push(cell);
      cell = '';
      continue;
    }
    if (ch === '\n' || (ch === '\r' && next === '\n')) {
      row.push(cell);
      cell = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
      if (ch === '\r') i += 1;
      continue;
    }
    if (ch === '\r') {
      row.push(cell);
      cell = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
      continue;
    }
    cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== '')) rows.push(row);
  return rows;
}

export function mapCsvToImportRows(text: string): {
  rows: InventoryImportRow[];
  errors: string[];
} {
  const table = parseCsv(text);
  if (table.length < 2) {
    return { rows: [], errors: ['File needs a header row and at least one data row.'] };
  }

  const header = table[0].map(normalizeHeader);
  const indexByCol = new Map<string, number>();
  header.forEach((h, i) => {
    const key = COLUMN_ALIASES[h];
    if (key && !indexByCol.has(key)) indexByCol.set(key, i);
  });

  if (!indexByCol.has('name')) {
    return { rows: [], errors: ['Missing required column: name'] };
  }

  const errors: string[] = [];
  const rows: InventoryImportRow[] = [];

  for (let r = 1; r < table.length; r += 1) {
    const line = table[r];
    const get = (col: (typeof INVENTORY_IMPORT_COLUMNS)[number]) => {
      const idx = indexByCol.get(col);
      if (idx === undefined) return undefined;
      const v = line[idx]?.trim();
      return v || undefined;
    };
    const name = get('name');
    if (!name) {
      errors.push(`Row ${r + 1}: name is required.`);
      continue;
    }
    rows.push({
      sku: get('sku'),
      name,
      itemType: get('itemType'),
      description: get('description'),
      category: get('category'),
      uom: get('uom'),
      unitPrice: get('unitPrice'),
      costPrice: get('costPrice'),
      barcode: get('barcode'),
      status: get('status'),
      warehouse: get('warehouse'),
      quantity: get('quantity'),
      reorderPoint: get('reorderPoint'),
      safetyStock: get('safetyStock'),
      batchTracked: get('batchTracked'),
    });
  }

  return { rows, errors };
}

export function downloadTextFile(
  filename: string,
  content: string,
  mime = 'text/csv;charset=utf-8',
) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
