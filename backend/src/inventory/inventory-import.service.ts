import { ForbiddenException, Injectable } from '@nestjs/common';
import { InventoryItemType, InventoryProductStatus, InventoryUom } from '@velon/database';
import { canManageInventory, normalizeVelonRole } from '@velon/shared';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import type { InventoryImportOptionsDto, InventoryImportRowDto } from './dto/inventory-import.dto';
import {
  InventoryCategoryRepository,
  InventoryProductRepository,
  InventoryStockRepository,
  InventoryWarehouseRepository,
} from './inventory.repositories';

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

export const INVENTORY_IMPORT_SAMPLE_ROWS: InventoryImportRowDto[] = [
  {
    sku: 'SKU-WIDGET-01',
    name: 'Premium Widget',
    itemType: 'PRODUCT',
    description: 'Physical product example',
    category: 'General',
    uom: 'EACH',
    unitPrice: '49.00',
    costPrice: '22.00',
    barcode: '',
    status: 'ACTIVE',
    warehouse: 'Main',
    quantity: '10',
    reorderPoint: '5',
    safetyStock: '2',
    batchTracked: 'false',
  },
  {
    sku: 'SVC-SUPPORT-01',
    name: 'Premium Support (1 Year)',
    itemType: 'SERVICE',
    description: 'Non-inventory service — no stock tracking',
    category: 'Services',
    uom: 'EACH',
    unitPrice: '999.00',
    costPrice: '0',
    barcode: '',
    status: 'ACTIVE',
    warehouse: '',
    quantity: '',
    reorderPoint: '',
    safetyStock: '',
    batchTracked: 'false',
  },
];

const UOM_VALUES = new Set(Object.values(InventoryUom));
const STATUS_VALUES = new Set(Object.values(InventoryProductStatus));
const ITEM_TYPE_VALUES = new Set(Object.values(InventoryItemType));

export type ImportRowIssue = {
  row: number;
  field?: string;
  message: string;
  severity: 'error' | 'warning';
};

export type NormalizedImportRow = {
  rowNumber: number;
  sku: string | null;
  name: string;
  itemType: InventoryItemType;
  description: string | null;
  categoryName: string | null;
  uom: InventoryUom;
  unitPrice: number;
  costPrice: number;
  barcode: string | null;
  status: InventoryProductStatus;
  warehouseName: string | null;
  quantity: number;
  reorderPoint: number;
  safetyStock: number;
  batchTracked: boolean;
  action: 'create' | 'update' | 'skip';
  existingId?: string;
};

export type ImportPreviewResult = {
  total: number;
  valid: number;
  createCount: number;
  updateCount: number;
  errorCount: number;
  warningCount: number;
  issues: ImportRowIssue[];
  rows: NormalizedImportRow[];
};

export type ImportExecuteResult = ImportPreviewResult & {
  created: number;
  updated: number;
  categoriesCreated: number;
  warehousesCreated: number;
  productIds: string[];
};

type AuditMeta = { ip?: string; ua?: string };

function csvEscape(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function parseBool(raw: string | undefined, fallback = false): boolean | null {
  if (raw === undefined || raw.trim() === '') return fallback;
  const v = raw.trim().toLowerCase();
  if (['true', 'yes', '1', 'y'].includes(v)) return true;
  if (['false', 'no', '0', 'n'].includes(v)) return false;
  return null;
}

function parseNumber(raw: string | undefined, fallback = 0): number | null {
  if (raw === undefined || raw.trim() === '') return fallback;
  const n = Number(raw.trim().replace(/,/g, ''));
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function parseIntNonNeg(raw: string | undefined, fallback = 0): number | null {
  const n = parseNumber(raw, fallback);
  if (n === null) return null;
  if (!Number.isInteger(n)) return null;
  return n;
}

@Injectable()
export class InventoryImportService {
  constructor(
    private readonly categories: InventoryCategoryRepository,
    private readonly products: InventoryProductRepository,
    private readonly warehouses: InventoryWarehouseRepository,
    private readonly stock: InventoryStockRepository,
    private readonly audit: AuditService,
  ) {}

  private assertManage(user: AuthenticatedUser) {
    if (!canManageInventory(normalizeVelonRole(user.role))) {
      throw new ForbiddenException('Inventory write access required.');
    }
  }

  getTemplate() {
    const header = [...INVENTORY_IMPORT_COLUMNS];
    const sample = INVENTORY_IMPORT_SAMPLE_ROWS.map((r) => {
      const record = r as unknown as Record<string, string | undefined>;
      return INVENTORY_IMPORT_COLUMNS.map((col) => String(record[col] ?? ''));
    });
    const csv = [header, ...sample].map((line) => line.map(csvEscape).join(',')).join('\n');
    return {
      columns: header,
      sampleRows: INVENTORY_IMPORT_SAMPLE_ROWS,
      csv: `\uFEFF${csv}\n`,
      filename: 'velon-inventory-import-template.csv',
      notes: [
        'Use PRODUCT for stockable items and SERVICE for non-inventory offerings.',
        'Services ignore warehouse, quantity, and batchTracked.',
        'Category and UoM must match existing values unless createMissingCategories is enabled.',
        'UoM must be one of: EACH, KG, LITER, BOX, CARTON.',
        'Run a 3–5 row test import (validate) before uploading the full file.',
        'Enable stageForApproval to create items as INACTIVE until a manager activates them.',
      ],
    };
  }

  async validate(
    user: AuthenticatedUser,
    rows: InventoryImportRowDto[],
    options: InventoryImportOptionsDto = {},
  ): Promise<ImportPreviewResult> {
    this.assertManage(user);
    return this.buildPreview(rows, options);
  }

  async execute(
    user: AuthenticatedUser,
    rows: InventoryImportRowDto[],
    options: InventoryImportOptionsDto = {},
    meta: AuditMeta = {},
  ): Promise<ImportExecuteResult> {
    this.assertManage(user);
    const preview = await this.buildPreview(rows, options);
    if (preview.errorCount > 0) {
      return {
        ...preview,
        created: 0,
        updated: 0,
        categoriesCreated: 0,
        warehousesCreated: 0,
        productIds: [],
      };
    }

    const categoryByName = new Map(
      (await this.categories.findMany()).map((c) => [c.name.toLowerCase(), c]),
    );
    const warehouseByName = new Map(
      (await this.warehouses.findMany(true)).map((w) => [w.name.toLowerCase(), w]),
    );

    let categoriesCreated = 0;
    let warehousesCreated = 0;
    let created = 0;
    let updated = 0;
    const productIds: string[] = [];

    for (const row of preview.rows) {
      if (row.action === 'skip') continue;

      let categoryId: string | null = null;
      if (row.categoryName) {
        const key = row.categoryName.toLowerCase();
        let cat = categoryByName.get(key);
        if (!cat && options.createMissingCategories) {
          cat = await this.categories.create({ name: row.categoryName });
          categoryByName.set(key, cat);
          categoriesCreated += 1;
        }
        categoryId = cat?.id ?? null;
      }

      let warehouseId: string | undefined;
      if (row.itemType === InventoryItemType.PRODUCT && row.warehouseName) {
        const key = row.warehouseName.toLowerCase();
        let wh = warehouseByName.get(key);
        if (!wh && options.createMissingWarehouses) {
          const code =
            row.warehouseName
              .trim()
              .toUpperCase()
              .replace(/[^A-Z0-9]+/g, '-')
              .replace(/^-|-$/g, '')
              .slice(0, 24) || 'WH';
          wh = await this.warehouses.create({
            code: `${code}-${Date.now().toString(36).slice(-4)}`,
            name: row.warehouseName,
          });
          warehouseByName.set(key, wh);
          warehousesCreated += 1;
        }
        warehouseId = wh?.id;
      }

      const status = options.stageForApproval ? InventoryProductStatus.INACTIVE : row.status;

      if (row.action === 'update' && row.existingId) {
        const updatedProduct = await this.products.update(row.existingId, {
          name: row.name,
          description: row.description,
          categoryId,
          itemType: row.itemType,
          uom: row.uom,
          status,
          barcode: row.barcode,
          unitPrice: row.unitPrice,
          costPrice: row.costPrice,
          batchTracked: row.itemType === InventoryItemType.SERVICE ? false : row.batchTracked,
        });
        productIds.push(updatedProduct.id);
        updated += 1;
      } else {
        const sku = row.sku || (await this.nextSku());
        const product = await this.products.create({
          sku,
          name: row.name,
          description: row.description,
          categoryId,
          itemType: row.itemType,
          uom: row.uom,
          status,
          barcode: row.barcode,
          unitPrice: row.unitPrice,
          costPrice: row.costPrice,
          batchTracked: row.itemType === InventoryItemType.SERVICE ? false : row.batchTracked,
          createdById: user.id,
        });
        productIds.push(product.id);
        created += 1;

        if (
          row.itemType === InventoryItemType.PRODUCT &&
          warehouseId &&
          (row.quantity > 0 || row.reorderPoint > 0 || row.safetyStock > 0)
        ) {
          const existing = await this.stock.findByProductWarehouse(product.id, warehouseId);
          if (!existing) {
            await this.stock.create({
              productId: product.id,
              warehouseId,
              quantity: row.batchTracked ? 0 : row.quantity,
              minStock: row.safetyStock,
              reorderLevel: row.reorderPoint,
            });
          }
        }
      }
    }

    await this.audit.log({
      actorId: user.id,
      tenantId: user.tenantId,
      action: 'inventory.products_imported',
      entityType: 'inventory_product',
      entityId: productIds[0] ?? undefined,
      metadata: {
        created,
        updated,
        categoriesCreated,
        warehousesCreated,
        staged: Boolean(options.stageForApproval),
        total: preview.total,
      },
      ipAddress: meta.ip,
      userAgent: meta.ua,
    });

    return {
      ...preview,
      created,
      updated,
      categoriesCreated,
      warehousesCreated,
      productIds,
    };
  }

  private async nextSku(): Promise<string> {
    const count = await this.products.count();
    return `SKU-${String(count + 1).padStart(5, '0')}`;
  }

  private async buildPreview(
    rows: InventoryImportRowDto[],
    options: InventoryImportOptionsDto,
  ): Promise<ImportPreviewResult> {
    const issues: ImportRowIssue[] = [];
    const normalized: NormalizedImportRow[] = [];
    const categories = await this.categories.findMany();
    const categoryNames = new Map(categories.map((c) => [c.name.toLowerCase(), c.name]));
    const warehouses = await this.warehouses.findMany(true);
    const warehouseNames = new Map(warehouses.map((w) => [w.name.toLowerCase(), w.name]));

    const skuList = rows.map((r) => r.sku?.trim()).filter((s): s is string => Boolean(s));
    const existing = await this.products.findBySkus([...new Set(skuList)]);
    const existingBySku = new Map(existing.map((p) => [p.sku.toLowerCase(), p]));

    const seenSkus = new Map<string, number>();

    rows.forEach((raw, index) => {
      const rowNumber = index + 2; // header is row 1 in CSV
      const name = raw.name?.trim() ?? '';
      if (!name) {
        issues.push({
          row: rowNumber,
          field: 'name',
          message: 'Name is required.',
          severity: 'error',
        });
        return;
      }

      const skuRaw = raw.sku?.trim() || null;
      if (skuRaw) {
        const key = skuRaw.toLowerCase();
        const prev = seenSkus.get(key);
        if (prev !== undefined) {
          issues.push({
            row: rowNumber,
            field: 'sku',
            message: `Duplicate SKU in file (also on row ${prev}).`,
            severity: 'error',
          });
          return;
        }
        seenSkus.set(key, rowNumber);
      }

      let itemType: InventoryItemType = InventoryItemType.PRODUCT;
      if (raw.itemType?.trim()) {
        const t = raw.itemType.trim().toUpperCase();
        if (!ITEM_TYPE_VALUES.has(t as InventoryItemType)) {
          issues.push({
            row: rowNumber,
            field: 'itemType',
            message: 'itemType must be PRODUCT or SERVICE.',
            severity: 'error',
          });
          return;
        }
        itemType = t as InventoryItemType;
      }

      let uom: InventoryUom = InventoryUom.EACH;
      if (raw.uom?.trim()) {
        const u = raw.uom.trim().toUpperCase();
        if (!UOM_VALUES.has(u as InventoryUom)) {
          issues.push({
            row: rowNumber,
            field: 'uom',
            message: `Unknown UoM "${raw.uom}". Use EACH, KG, LITER, BOX, or CARTON.`,
            severity: 'error',
          });
          return;
        }
        uom = u as InventoryUom;
      }

      let status: InventoryProductStatus = InventoryProductStatus.ACTIVE;
      if (raw.status?.trim()) {
        const s = raw.status.trim().toUpperCase();
        if (!STATUS_VALUES.has(s as InventoryProductStatus)) {
          issues.push({
            row: rowNumber,
            field: 'status',
            message: 'status must be ACTIVE, INACTIVE, or DISCONTINUED.',
            severity: 'error',
          });
          return;
        }
        status = s as InventoryProductStatus;
      }

      const unitPrice = parseNumber(raw.unitPrice, 0);
      if (unitPrice === null) {
        issues.push({
          row: rowNumber,
          field: 'unitPrice',
          message: 'unitPrice must be a non-negative number.',
          severity: 'error',
        });
        return;
      }
      const costPrice = parseNumber(raw.costPrice, 0);
      if (costPrice === null) {
        issues.push({
          row: rowNumber,
          field: 'costPrice',
          message: 'costPrice must be a non-negative number.',
          severity: 'error',
        });
        return;
      }

      const quantity = parseIntNonNeg(raw.quantity, 0);
      if (quantity === null) {
        issues.push({
          row: rowNumber,
          field: 'quantity',
          message: 'quantity must be a non-negative integer.',
          severity: 'error',
        });
        return;
      }
      const reorderPoint = parseIntNonNeg(raw.reorderPoint, 0);
      if (reorderPoint === null) {
        issues.push({
          row: rowNumber,
          field: 'reorderPoint',
          message: 'reorderPoint must be a non-negative integer.',
          severity: 'error',
        });
        return;
      }
      const safetyStock = parseIntNonNeg(raw.safetyStock, 0);
      if (safetyStock === null) {
        issues.push({
          row: rowNumber,
          field: 'safetyStock',
          message: 'safetyStock must be a non-negative integer.',
          severity: 'error',
        });
        return;
      }

      const batchTracked = parseBool(raw.batchTracked, false);
      if (batchTracked === null) {
        issues.push({
          row: rowNumber,
          field: 'batchTracked',
          message: 'batchTracked must be true/false (or yes/no).',
          severity: 'error',
        });
        return;
      }

      const categoryName = raw.category?.trim() || null;
      if (categoryName) {
        const exists = categoryNames.has(categoryName.toLowerCase());
        if (!exists && !options.createMissingCategories) {
          issues.push({
            row: rowNumber,
            field: 'category',
            message: `Category "${categoryName}" does not exist. Create it first or enable createMissingCategories.`,
            severity: 'error',
          });
          return;
        }
        if (!exists && options.createMissingCategories) {
          issues.push({
            row: rowNumber,
            field: 'category',
            message: `Category "${categoryName}" will be created.`,
            severity: 'warning',
          });
        }
      }

      const warehouseName = raw.warehouse?.trim() || null;
      if (itemType === InventoryItemType.SERVICE) {
        if (warehouseName || quantity > 0 || batchTracked) {
          issues.push({
            row: rowNumber,
            field: 'itemType',
            message: 'Services ignore warehouse, quantity, and batch tracking.',
            severity: 'warning',
          });
        }
      } else if (warehouseName) {
        const exists = warehouseNames.has(warehouseName.toLowerCase());
        if (!exists && !options.createMissingWarehouses) {
          issues.push({
            row: rowNumber,
            field: 'warehouse',
            message: `Warehouse "${warehouseName}" does not exist. Create it first or enable createMissingWarehouses.`,
            severity: 'error',
          });
          return;
        }
        if (!exists && options.createMissingWarehouses) {
          issues.push({
            row: rowNumber,
            field: 'warehouse',
            message: `Warehouse "${warehouseName}" will be created.`,
            severity: 'warning',
          });
        }
      } else if (quantity > 0) {
        issues.push({
          row: rowNumber,
          field: 'warehouse',
          message: 'Opening quantity requires a warehouse name.',
          severity: 'error',
        });
        return;
      }

      if (batchTracked && quantity > 0 && itemType === InventoryItemType.PRODUCT) {
        issues.push({
          row: rowNumber,
          field: 'batchTracked',
          message:
            'Batch-tracked opening stock needs mfg/expiry dates — quantity will be set to 0 on import; add batches afterward.',
          severity: 'warning',
        });
      }

      let action: NormalizedImportRow['action'] = 'create';
      let existingId: string | undefined;
      if (skuRaw) {
        const found = existingBySku.get(skuRaw.toLowerCase());
        if (found) {
          if (options.updateExisting) {
            action = 'update';
            existingId = found.id;
          } else {
            issues.push({
              row: rowNumber,
              field: 'sku',
              message: `SKU "${skuRaw}" already exists. Enable updateExisting to overwrite.`,
              severity: 'error',
            });
            return;
          }
        }
      }

      if (options.stageForApproval && status === InventoryProductStatus.ACTIVE) {
        issues.push({
          row: rowNumber,
          field: 'status',
          message: 'Will be created as INACTIVE for approval.',
          severity: 'warning',
        });
      }

      normalized.push({
        rowNumber,
        sku: skuRaw,
        name,
        itemType,
        description: raw.description?.trim() || null,
        categoryName,
        uom,
        unitPrice,
        costPrice,
        barcode: raw.barcode?.trim() || null,
        status,
        warehouseName: itemType === InventoryItemType.SERVICE ? null : warehouseName,
        quantity: itemType === InventoryItemType.SERVICE ? 0 : quantity,
        reorderPoint: itemType === InventoryItemType.SERVICE ? 0 : reorderPoint,
        safetyStock: itemType === InventoryItemType.SERVICE ? 0 : safetyStock,
        batchTracked: itemType === InventoryItemType.SERVICE ? false : batchTracked,
        action,
        existingId,
      });
    });

    const errorCount = issues.filter((i) => i.severity === 'error').length;
    const warningCount = issues.filter((i) => i.severity === 'warning').length;

    return {
      total: rows.length,
      valid: normalized.length,
      createCount: normalized.filter((r) => r.action === 'create').length,
      updateCount: normalized.filter((r) => r.action === 'update').length,
      errorCount,
      warningCount,
      issues,
      rows: normalized,
    };
  }
}
