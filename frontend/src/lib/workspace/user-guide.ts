/** In-app how-to content. English keys are also used by `useT()` / `ar.ts`. */

export type UserGuideSection = {
  id: string;
  title: string;
  summary: string;
  steps?: string[];
  tips?: string[];
};

export const USER_GUIDE_SECTIONS: UserGuideSection[] = [
  {
    id: 'getting-started',
    title: 'Getting started',
    summary:
      'Velon is organized by everyday business words. Start on Dashboard, then set up Inventory, Customers, and Invoices.',
    steps: [
      'Open Settings and confirm workspace name, currency, and language.',
      'Add Categories and Warehouses under Inventory before a large import.',
      'Create a few products manually, or use Import CSV for many items at once.',
      'Create a customer, then an invoice that picks products from your catalog.',
    ],
  },
  {
    id: 'inventory-tabs',
    title: 'Products tab vs Stock tab',
    summary:
      'You are not wrong — they are different views of the same catalog. The CSV is not a copy of either table layout.',
    steps: [
      'Products tab = product master (what you sell): name, type, category, barcode, status, price.',
      'Stock tab = warehouse quantities (where it sits): location, on hand, safety, reorder, expiry.',
      'CSV import = one row that creates/updates the product and can also set opening stock.',
      'After import, open Products to verify catalog fields, then Stock to verify quantities.',
    ],
    tips: [
      'SERVICE rows skip warehouse/quantity — they appear on Products, not as stock lines.',
      'Columns like EXT. VALUE, SCAN, and ABC are calculated or managed in the Stock UI, not in the CSV.',
    ],
  },
  {
    id: 'csv-import',
    title: 'How to import products & services (CSV)',
    summary:
      'Use the template from Products → Import CSV. Fill a few test rows, validate, then import the full file.',
    steps: [
      'Go to Inventory → Products → Import CSV → Download template.',
      'Keep the header row exactly as downloaded.',
      'Set itemType to PRODUCT (stocked) or SERVICE (no stock).',
      'For products with opening stock, fill warehouse + quantity (warehouse name must exist, or enable Create missing warehouses).',
      'Upload the file, fix any errors in the validation list, then Import.',
      'If Stage as Inactive is on, activate items later by editing Status to Active.',
    ],
    tips: [
      'sku → Products SKU',
      'name → Products Name',
      'itemType → Products Type',
      'category → Products Category',
      'barcode → Products Barcode',
      'status → Products Status',
      'unitPrice → Products Price / Stock Unit price',
      'warehouse → Stock Location',
      'quantity → Stock On hand',
      'reorderPoint → Stock Reorder',
      'safetyStock → Stock Safety',
      'batchTracked → enables expiry workflow (add mfg/expiry later on Stock if needed)',
    ],
  },
  {
    id: 'sales-invoices',
    title: 'Sales & invoices',
    summary: 'Sell from your catalog with quotations or invoices.',
    steps: [
      'Add customers under Customers.',
      'Use Sales for leads, quotations, and pipeline.',
      'Create an Invoice and pick products/services from Inventory.',
      'Services bill without reducing stock; products can consume stock when fulfillment is configured.',
    ],
  },
  {
    id: 'purchases-vendors',
    title: 'Purchases & vendors',
    summary: 'Buy stock from suppliers and receive it into warehouses.',
    steps: [
      'Add vendors under Vendors.',
      'Create purchase documents under Purchases.',
      'Receive goods into a warehouse so Stock on hand increases.',
    ],
  },
  {
    id: 'accounting-reports',
    title: 'Accounting & reports',
    summary: 'Track money in/out and export simple reports.',
    steps: [
      'Use Accounting for cashbook-style balances and movement.',
      'Open Reports for sales, purchases, and operational summaries.',
      'Export CSV from Accounting when you need spreadsheets for auditors or owners.',
    ],
  },
  {
    id: 'settings-team',
    title: 'Settings & team',
    summary: 'Control language, roles, and who can edit inventory.',
    steps: [
      'Settings → general preferences for language and workspace defaults.',
      'Workspace admin (owners/admins) manage users and roles.',
      'Inventory write access is required for Import CSV and Create product.',
    ],
  },
];

export const CSV_TO_UI_MAP = [
  { csv: 'sku', products: 'SKU', stock: 'SKU' },
  { csv: 'name', products: 'Name', stock: 'Product' },
  { csv: 'itemType', products: 'Type', stock: '—' },
  { csv: 'category', products: 'Category', stock: '—' },
  { csv: 'barcode', products: 'Barcode', stock: 'Scan-related' },
  { csv: 'status', products: 'Status', stock: 'Status' },
  { csv: 'unitPrice', products: 'Price', stock: 'Unit price' },
  { csv: 'warehouse', products: '— (opening only)', stock: 'Location' },
  { csv: 'quantity', products: '— (opening only)', stock: 'On hand' },
  { csv: 'reorderPoint', products: '—', stock: 'Reorder' },
  { csv: 'safetyStock', products: '—', stock: 'Safety' },
] as const;
