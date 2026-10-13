import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import {
  InventoryAbcClass,
  InventoryItemType,
  InventoryProductStatus,
  InventoryVelocity,
} from '@velon/database';
import { canManageInventory, canReadInventory, normalizeVelonRole } from '@velon/shared';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { NotificationService } from '../email/notification.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  AdjustInventoryStockDto,
  CreateInventoryCategoryDto,
  CreateInventoryProductDto,
  CreateInventoryWarehouseDto,
  TransferInventoryStockDto,
  UpdateInventoryCategoryDto,
  UpdateInventoryProductDto,
  UpdateInventoryWarehouseDto,
  UpdateStockLevelsDto,
} from './dto/inventory.dto';
import { InventoryBatchService } from './inventory-batch.service';
import { InventoryVariantsService } from './inventory-variants.service';
import {
  InventoryCategoryRepository,
  InventoryProductRepository,
  InventoryStockRepository,
  InventoryWarehouseRepository,
} from './inventory.repositories';

type AuditMeta = { ip?: string; ua?: string };

function stockLevel(
  quantity: number,
  minStock: number,
  reorderLevel: number,
): 'healthy' | 'low' | 'critical' {
  if (quantity <= minStock) return 'critical';
  if (quantity <= reorderLevel) return 'low';
  return 'healthy';
}

function mapAbc(c: InventoryAbcClass): 'A' | 'B' | 'C' {
  return c;
}

function mapVelocity(v: InventoryVelocity): 'fast' | 'medium' | 'slow' {
  return v.toLowerCase() as 'fast' | 'medium' | 'slow';
}

@Injectable()
export class InventoryService {
  constructor(
    private readonly categories: InventoryCategoryRepository,
    private readonly products: InventoryProductRepository,
    private readonly warehouses: InventoryWarehouseRepository,
    private readonly stock: InventoryStockRepository,
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
    private readonly variantsService: InventoryVariantsService,
    private readonly notifications: NotificationService,
    private readonly batches: InventoryBatchService,
  ) {}

  private async expiringSoonDays(tenantId: string): Promise<number> {
    const ws = await this.prisma.client.workspace.findFirst({
      where: { tenantId },
      select: { expiringSoonDays: true },
    });
    return ws?.expiringSoonDays ?? 30;
  }

  private requireBatchDates(
    batchTracked: boolean,
    quantity: number,
    mfgDate?: string,
    expiryDate?: string,
  ) {
    if (!batchTracked || quantity <= 0) return;
    if (!mfgDate?.trim() || !expiryDate?.trim()) {
      throw new BadRequestException(
        'Manufacturing and expiry dates are required for batch-tracked stock.',
      );
    }
  }

  private notifyInventoryProduct(
    user: AuthenticatedUser,
    product: { id: string; name: string; sku: string },
    action: 'created' | 'updated',
  ) {
    if (!user.tenantId) return;

    void (async () => {
      try {
        const workspace = await this.prisma.client.workspace.findFirst({
          where: { id: user.workspaceId, tenantId: user.tenantId },
          select: { name: true },
        });
        await this.notifications.notifyInventoryProductMajorUpdate({
          tenantId: user.tenantId!,
          productId: product.id,
          userId: user.id,
          email: user.email,
          userName: user.email,
          workspaceName: workspace?.name ?? 'your workspace',
          productName: product.name,
          sku: product.sku,
          action,
        });
      } catch {
        /* notification must not block inventory operations */
      }
    })();
  }

  private role(user: AuthenticatedUser) {
    return normalizeVelonRole(user.role);
  }

  private assertRead(user: AuthenticatedUser) {
    if (!canReadInventory(this.role(user))) {
      throw new ForbiddenException('Inventory access denied.');
    }
  }

  private assertManage(user: AuthenticatedUser) {
    if (!canManageInventory(this.role(user))) {
      throw new ForbiddenException('Insufficient permissions to manage inventory.');
    }
  }

  private async nextSku() {
    const count = await this.products.count();
    return `SKU-${String(count + 1).padStart(5, '0')}`;
  }

  private warehouseCode(name: string) {
    const slug = name
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '-')
      .slice(0, 12);
    return slug || `WH-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
  }

  mapStockRow(
    row: {
      id: string;
      quantity: number;
      reservedQty: number;
      minStock: number;
      reorderLevel: number;
      product: {
        sku: string;
        name: string;
        unitPrice: { toNumber(): number };
        costPrice?: { toNumber(): number };
        abcClass: InventoryAbcClass;
        velocity: InventoryVelocity;
        batchTracked: boolean;
        variantParent: string | null;
        hasVariants?: boolean;
      };
      warehouse: { name: string };
      variant?: {
        id: string;
        label: string;
        sku: string;
        unitPrice: { toNumber(): number };
        salePrice: { toNumber(): number } | null;
      } | null;
      batches?: Array<{
        id: string;
        quantity: number;
        mfgDate: Date;
        expiryDate: Date;
        unitCost: { toNumber(): number };
        batchNumber: string | null;
      }>;
    },
    expiringSoonDays = 30,
  ) {
    const available = row.quantity - row.reservedQty;
    const variantPrice = row.variant
      ? row.variant.salePrice != null
        ? row.variant.salePrice.toNumber()
        : row.variant.unitPrice.toNumber()
      : null;
    const batchSummaries = row.batches?.map((b) =>
      this.batches.mapBatchForApi(b, expiringSoonDays),
    );
    const nearestExpiry = batchSummaries?.[0]?.expiryDate;
    const expiryStatus = batchSummaries?.some((b) => b.expiryStatus === 'expired')
      ? 'expired'
      : batchSummaries?.some((b) => b.expiryStatus === 'expiring_soon')
        ? 'expiring_soon'
        : batchSummaries?.length
          ? 'ok'
          : 'no_expiry';

    return {
      id: row.id,
      sku: row.variant?.sku ?? row.product.sku,
      name: row.variant ? `${row.product.name} / ${row.variant.label}` : row.product.name,
      site: row.warehouse.name,
      quantity: available,
      stockLevel: stockLevel(available, row.minStock, row.reorderLevel),
      safetyStock: row.minStock,
      reorderPoint: row.reorderLevel,
      abcClass: mapAbc(row.product.abcClass),
      velocity: mapVelocity(row.product.velocity),
      batchTracked: row.product.batchTracked,
      variantParent: row.product.variantParent ?? undefined,
      unitPrice: variantPrice ?? row.product.unitPrice.toNumber(),
      costPrice: row.product.costPrice?.toNumber() ?? 0,
      variantId: row.variant?.id,
      hasVariants: row.product.hasVariants ?? false,
      mfgDate: batchSummaries?.[0]?.mfgDate,
      expiryDate: nearestExpiry,
      expiryStatus,
      batches: batchSummaries,
    };
  }

  // ─── Categories ────────────────────────────────────────────

  listCategories(user: AuthenticatedUser) {
    this.assertRead(user);
    return this.categories.findMany();
  }

  async createCategory(user: AuthenticatedUser, dto: CreateInventoryCategoryDto) {
    this.assertManage(user);
    return this.categories.create({
      name: dto.name.trim(),
      description: dto.description?.trim() || null,
      parentId: dto.parentId || null,
    });
  }

  async updateCategory(user: AuthenticatedUser, id: string, dto: UpdateInventoryCategoryDto) {
    this.assertManage(user);
    const row = await this.categories.findById(id);
    if (!row) throw new NotFoundException('Category not found.');
    return this.categories.update(id, {
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.description !== undefined ? { description: dto.description?.trim() || null } : {}),
      ...(dto.parentId !== undefined ? { parentId: dto.parentId || null } : {}),
    });
  }

  async deleteCategory(user: AuthenticatedUser, id: string) {
    this.assertManage(user);
    const row = await this.categories.findById(id);
    if (!row) throw new NotFoundException('Category not found.');
    const productCount = await this.prisma.client.inventoryProduct.count({
      where: { tenantId: user.tenantId, categoryId: id },
    });
    if (productCount > 0) {
      throw new BadRequestException('Cannot delete category with assigned products.');
    }
    await this.categories.delete(id);
    return { ok: true };
  }

  // ─── Products ──────────────────────────────────────────────

  listProducts(user: AuthenticatedUser, search?: string) {
    this.assertRead(user);
    return this.products.findMany({ search });
  }

  async listProductsWithVariantCounts(user: AuthenticatedUser, search?: string) {
    this.assertRead(user);
    const rows = await this.products.findMany({ search });
    const counts = await this.prisma.client.inventoryProductVariant.groupBy({
      by: ['productId'],
      where: { tenantId: user.tenantId },
      _count: { id: true },
    });
    const countMap = new Map(counts.map((c) => [c.productId, c._count.id]));
    return rows.map((p) => ({
      ...p,
      variantCount: p.hasVariants ? (countMap.get(p.id) ?? 0) : 0,
    }));
  }

  async getProduct(user: AuthenticatedUser, id: string) {
    this.assertRead(user);
    return this.variantsService.getProductWithVariants(user, id);
  }

  async createProduct(user: AuthenticatedUser, dto: CreateInventoryProductDto, meta: AuditMeta) {
    this.assertManage(user);
    const sku = dto.sku?.trim() || (await this.nextSku());
    await this.variantsService.assertProductSkuAvailable(sku);
    const itemType = dto.itemType ?? InventoryItemType.PRODUCT;
    const isService = itemType === InventoryItemType.SERVICE;

    const product = await this.products.create({
      sku,
      name: dto.name.trim(),
      description: dto.description?.trim() || null,
      categoryId: dto.categoryId || null,
      itemType,
      uom: dto.uom,
      status: dto.status ?? InventoryProductStatus.ACTIVE,
      imageDataUrl: dto.imageDataUrl || null,
      barcode: dto.barcode?.trim() || null,
      unitPrice: dto.unitPrice ?? 0,
      abcClass: dto.abcClass,
      velocity: dto.velocity,
      batchTracked: isService ? false : (dto.batchTracked ?? false),
      costPrice: dto.costPrice ?? 0,
      variantParent: dto.variantParent?.trim() || null,
      hasVariants: isService ? false : (dto.hasVariants ?? false),
      createdById: user.id,
    });

    try {
      let defaultWarehouseId: string | undefined;
      if (!isService && dto.site?.trim()) {
        let warehouse = await this.warehouses.findByName(dto.site.trim());
        if (!warehouse) {
          const code = this.warehouseCode(dto.site);
          warehouse = await this.warehouses.create({
            code,
            name: dto.site.trim(),
          });
        }
        defaultWarehouseId = warehouse.id;
        if (!dto.hasVariants) {
          const qty = dto.quantity ?? 0;
          this.requireBatchDates(product.batchTracked, qty, dto.mfgDate, dto.expiryDate);
          const stockRow = await this.stock.create({
            productId: product.id,
            warehouseId: warehouse.id,
            quantity: product.batchTracked && qty > 0 ? 0 : qty,
            minStock: dto.safetyStock ?? 0,
            reorderLevel: dto.reorderPoint ?? 0,
          });
          if (product.batchTracked && qty > 0 && dto.mfgDate && dto.expiryDate) {
            await this.batches.addBatch(user.tenantId!, stockRow.id, {
              quantity: qty,
              mfgDate: dto.mfgDate,
              expiryDate: dto.expiryDate,
              unitCost: dto.costPrice,
            });
          }
        }
      } else if (!isService && dto.variants?.hasVariants && dto.variants.variants?.length) {
        const defaultWarehouse = (await this.warehouses.findMany(true))[0];
        defaultWarehouseId = defaultWarehouse?.id;
      }

      if (!isService && dto.variants?.hasVariants) {
        await this.variantsService.saveVariantsForProduct(
          user,
          product.id,
          true,
          dto.variants.attributes,
          dto.variants.variants,
          defaultWarehouseId,
        );
      }

      await this.audit.log({
        actorId: user.id,
        tenantId: user.tenantId,
        action: 'inventory.product_created',
        entityType: 'inventory_product',
        entityId: product.id,
        metadata: { sku: product.sku, name: product.name, itemType },
        ipAddress: meta.ip,
        userAgent: meta.ua,
      });

      this.notifyInventoryProduct(user, product, 'created');

      return !isService && dto.variants?.hasVariants
        ? this.variantsService.getProductWithVariants(user, product.id)
        : product;
    } catch (err) {
      await this.prisma.client.inventoryProduct
        .delete({ where: { id: product.id } })
        .catch(() => undefined);
      throw err;
    }
  }

  async updateProduct(
    user: AuthenticatedUser,
    id: string,
    dto: UpdateInventoryProductDto,
    meta: AuditMeta,
  ) {
    this.assertManage(user);
    const row = await this.products.findById(id);
    if (!row) throw new NotFoundException('Product not found.');

    const updated = await this.products.update(id, {
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.description !== undefined ? { description: dto.description?.trim() || null } : {}),
      ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId || null } : {}),
      ...(dto.itemType !== undefined ? { itemType: dto.itemType } : {}),
      ...(dto.uom !== undefined ? { uom: dto.uom } : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
      ...(dto.imageDataUrl !== undefined ? { imageDataUrl: dto.imageDataUrl || null } : {}),
      ...(dto.barcode !== undefined ? { barcode: dto.barcode?.trim() || null } : {}),
      ...(dto.unitPrice !== undefined ? { unitPrice: dto.unitPrice } : {}),
      ...(dto.abcClass !== undefined ? { abcClass: dto.abcClass } : {}),
      ...(dto.velocity !== undefined ? { velocity: dto.velocity } : {}),
      ...(dto.batchTracked !== undefined
        ? {
            batchTracked:
              (dto.itemType ?? row.itemType) === InventoryItemType.SERVICE
                ? false
                : dto.batchTracked,
          }
        : {}),
      ...(dto.costPrice !== undefined ? { costPrice: dto.costPrice } : {}),
      ...(dto.variantParent !== undefined
        ? { variantParent: dto.variantParent?.trim() || null }
        : {}),
      ...(dto.hasVariants !== undefined ? { hasVariants: dto.hasVariants } : {}),
    });

    if (dto.variants !== undefined) {
      const defaultWarehouse = (await this.warehouses.findMany(true))[0];
      await this.variantsService.saveVariantsForProduct(
        user,
        id,
        dto.variants.hasVariants,
        dto.variants.attributes,
        dto.variants.variants,
        defaultWarehouse?.id,
      );
    }

    await this.audit.log({
      actorId: user.id,
      tenantId: user.tenantId,
      action: 'inventory.product_updated',
      entityType: 'inventory_product',
      entityId: id,
      ipAddress: meta.ip,
      userAgent: meta.ua,
    });

    const majorUpdate =
      dto.status !== undefined ||
      dto.unitPrice !== undefined ||
      dto.name !== undefined ||
      dto.hasVariants !== undefined;
    if (majorUpdate) {
      this.notifyInventoryProduct(
        user,
        { id: updated.id, name: updated.name, sku: updated.sku },
        'updated',
      );
    }

    return dto.variants !== undefined
      ? this.variantsService.getProductWithVariants(user, id)
      : updated;
  }

  listVariantsForProduct(user: AuthenticatedUser, productId: string) {
    return this.variantsService.listVariantsForProduct(user, productId);
  }

  searchVariants(user: AuthenticatedUser, query?: string) {
    return this.variantsService.searchVariants(user, query);
  }

  deactivateVariant(user: AuthenticatedUser, variantId: string) {
    return this.variantsService.deactivateVariant(user, variantId);
  }

  // ─── Warehouses ────────────────────────────────────────────

  listWarehouses(user: AuthenticatedUser) {
    this.assertRead(user);
    return this.warehouses.findMany();
  }

  async createWarehouse(user: AuthenticatedUser, dto: CreateInventoryWarehouseDto) {
    this.assertManage(user);
    const code = dto.code?.trim() || this.warehouseCode(dto.name);
    return this.warehouses.create({
      code,
      name: dto.name.trim(),
      location: dto.location?.trim() || null,
      phone: dto.phone?.trim() || null,
      email: dto.email?.trim() || null,
      managerName: dto.managerName?.trim() || null,
      managerId: dto.managerId || null,
    });
  }

  async updateWarehouse(user: AuthenticatedUser, id: string, dto: UpdateInventoryWarehouseDto) {
    this.assertManage(user);
    const row = await this.warehouses.findById(id);
    if (!row) throw new NotFoundException('Warehouse not found.');
    return this.warehouses.update(id, {
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.code !== undefined ? { code: dto.code.trim() } : {}),
      ...(dto.location !== undefined ? { location: dto.location?.trim() || null } : {}),
      ...(dto.phone !== undefined ? { phone: dto.phone?.trim() || null } : {}),
      ...(dto.email !== undefined ? { email: dto.email?.trim() || null } : {}),
      ...(dto.managerName !== undefined ? { managerName: dto.managerName?.trim() || null } : {}),
      ...(dto.managerId !== undefined ? { managerId: dto.managerId || null } : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
    });
  }

  // ─── Stock ───────────────────────────────────────────────────

  async listStock(user: AuthenticatedUser, expiryFilter?: string) {
    this.assertRead(user);
    const soonDays = await this.expiringSoonDays(user.tenantId!);
    const rows = await this.stock.findMany({ includeBatches: true });
    const mapped = rows.map((r) => this.mapStockRow(r, soonDays));
    if (!expiryFilter || expiryFilter === 'all') return mapped;
    return mapped.filter((row) => {
      if (expiryFilter === 'no_expiry') return row.expiryStatus === 'no_expiry';
      return row.expiryStatus === expiryFilter;
    });
  }

  async adjustStock(user: AuthenticatedUser, dto: AdjustInventoryStockDto, meta: AuditMeta) {
    this.assertManage(user);
    const row = await this.stock.findByProductWarehouse(dto.productId, dto.warehouseId);
    if (!row) throw new NotFoundException('Stock record not found.');

    if (dto.delta > 0 && row.product.batchTracked) {
      this.requireBatchDates(true, dto.delta, dto.mfgDate, dto.expiryDate);
      await this.batches.addBatch(user.tenantId!, row.id, {
        quantity: dto.delta,
        mfgDate: dto.mfgDate!,
        expiryDate: dto.expiryDate!,
        unitCost: dto.unitCost,
      });
    } else {
      const nextQty = row.quantity + dto.delta;
      if (nextQty < 0) throw new BadRequestException('Insufficient stock for adjustment.');
      await this.stock.update(row.id, { quantity: nextQty });
    }

    const updated = await this.stock.findById(row.id, true);
    const soonDays = await this.expiringSoonDays(user.tenantId!);

    await this.audit.log({
      actorId: user.id,
      tenantId: user.tenantId,
      action: 'inventory.stock_adjusted',
      entityType: 'inventory_stock',
      entityId: row.id,
      metadata: {
        delta: dto.delta,
        reason: dto.reason,
        mfgDate: dto.mfgDate,
        expiryDate: dto.expiryDate,
      },
      ipAddress: meta.ip,
      userAgent: meta.ua,
    });

    return updated ? this.mapStockRow(updated, soonDays) : null;
  }

  async transferStock(user: AuthenticatedUser, dto: TransferInventoryStockDto, meta: AuditMeta) {
    this.assertManage(user);
    if (dto.fromWarehouseId === dto.toWarehouseId) {
      throw new BadRequestException('Source and destination warehouses must differ.');
    }

    const from = await this.stock.findByProductWarehouse(dto.productId, dto.fromWarehouseId);
    if (!from || from.quantity < dto.quantity) {
      throw new BadRequestException('Insufficient stock at source warehouse.');
    }

    const variantId = from.variantId ?? null;
    const existingDest = await this.stock.findByProductWarehouse(
      dto.productId,
      dto.toWarehouseId,
      variantId,
    );
    const dest =
      existingDest ??
      (await this.stock.create({
        productId: dto.productId,
        variantId,
        warehouseId: dto.toWarehouseId,
        quantity: 0,
        minStock: from.minStock,
        reorderLevel: from.reorderLevel,
      }));

    await this.prisma.client.$transaction([
      this.prisma.client.inventoryStock.update({
        where: { id: from.id },
        data: { quantity: from.quantity - dto.quantity },
      }),
      this.prisma.client.inventoryStock.update({
        where: { id: dest.id },
        data: { quantity: dest.quantity + dto.quantity },
      }),
    ]);

    await this.audit.log({
      actorId: user.id,
      tenantId: user.tenantId,
      action: 'inventory.stock_transferred',
      entityType: 'inventory_stock',
      entityId: from.id,
      metadata: {
        productId: dto.productId,
        fromWarehouseId: dto.fromWarehouseId,
        toWarehouseId: dto.toWarehouseId,
        quantity: dto.quantity,
      },
      ipAddress: meta.ip,
      userAgent: meta.ua,
    });

    const refreshed = await this.stock.findByProductWarehouse(
      dto.productId,
      dto.toWarehouseId,
      variantId,
    );
    return refreshed ? this.mapStockRow(refreshed) : null;
  }

  /** Workspace UI: update stock row by stock id */
  async updateStockRow(
    user: AuthenticatedUser,
    stockId: string,
    dto: UpdateStockLevelsDto,
    meta: AuditMeta,
  ) {
    this.assertManage(user);
    const row = await this.stock.findById(stockId);
    if (!row) throw new NotFoundException('Stock record not found.');

    if (dto.site?.trim() && dto.site.trim() !== row.warehouse.name) {
      let warehouse = await this.warehouses.findByName(dto.site.trim());
      if (!warehouse) {
        warehouse = await this.warehouses.create({
          code: this.warehouseCode(dto.site),
          name: dto.site.trim(),
        });
      }
      const existing = await this.stock.findByProductWarehouse(row.productId, warehouse.id);
      if (existing && existing.id !== stockId) {
        throw new BadRequestException('Product already has stock at that warehouse.');
      }
      await this.stock.update(stockId, { warehouseId: warehouse.id });
    }

    const minStock = dto.minStock ?? dto.safetyStock;
    const reorderLevel = dto.reorderLevel ?? dto.reorderPoint;

    if (
      dto.name !== undefined ||
      dto.unitPrice !== undefined ||
      dto.abcClass !== undefined ||
      dto.velocity !== undefined ||
      dto.batchTracked !== undefined ||
      dto.variantParent !== undefined
    ) {
      await this.products.update(row.productId, {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.unitPrice !== undefined ? { unitPrice: dto.unitPrice } : {}),
        ...(dto.abcClass !== undefined ? { abcClass: dto.abcClass } : {}),
        ...(dto.velocity !== undefined ? { velocity: dto.velocity } : {}),
        ...(dto.batchTracked !== undefined ? { batchTracked: dto.batchTracked } : {}),
        ...(dto.variantParent !== undefined
          ? { variantParent: dto.variantParent?.trim() || null }
          : {}),
      });
    }

    const batchTracked = dto.batchTracked ?? row.product.batchTracked;
    const currentQty = row.quantity - row.reservedQty;

    if (dto.quantity !== undefined) {
      const delta = dto.quantity - currentQty;
      if (delta > 0 && batchTracked) {
        this.requireBatchDates(true, delta, dto.mfgDate, dto.expiryDate);
        await this.batches.addBatch(user.tenantId!, stockId, {
          quantity: delta,
          mfgDate: dto.mfgDate!,
          expiryDate: dto.expiryDate!,
        });
      } else if (delta < 0) {
        throw new BadRequestException(
          'Use stock adjustment to reduce batch-tracked quantity (FEFO applies).',
        );
      } else if (!batchTracked) {
        await this.stock.update(stockId, { quantity: dto.quantity });
      }
    }

    const updated = await this.stock.update(stockId, {
      ...(dto.quantity !== undefined && !batchTracked ? { quantity: dto.quantity } : {}),
      ...(minStock !== undefined ? { minStock } : {}),
      ...(reorderLevel !== undefined ? { reorderLevel } : {}),
    });

    if (dto.quantity !== undefined) {
      await this.audit.log({
        actorId: user.id,
        tenantId: user.tenantId,
        action: 'inventory.stock_adjusted',
        entityType: 'inventory_stock',
        entityId: stockId,
        metadata: {
          quantity: dto.quantity,
          mfgDate: dto.mfgDate,
          expiryDate: dto.expiryDate,
        },
        ipAddress: meta.ip,
        userAgent: meta.ua,
      });
    }

    const soonDays = await this.expiringSoonDays(user.tenantId!);
    const full = await this.stock.findById(stockId, true);
    return full ? this.mapStockRow(full, soonDays) : this.mapStockRow(updated, soonDays);
  }

  async dashboardMetrics(tenantId: string) {
    const [productCount, warehouseCount, stocks, pendingRequests, pendingOrders] =
      await Promise.all([
        this.prisma.client.inventoryProduct.count({ where: { tenantId } }),
        this.prisma.client.inventoryWarehouse.count({
          where: { tenantId, isActive: true },
        }),
        this.prisma.client.inventoryStock.findMany({ where: { tenantId } }),
        this.prisma.client.purchaseRequest.count({
          where: { tenantId, status: 'PENDING_APPROVAL' },
        }),
        this.prisma.client.purchaseOrder.count({
          where: { tenantId, status: { in: ['DRAFT', 'PENDING_APPROVAL'] } },
        }),
      ]);

    const lowStock = stocks.filter((s) => s.quantity - s.reservedQty <= s.reorderLevel).length;

    return {
      totalProducts: productCount,
      lowStockAlerts: lowStock,
      pendingPurchaseRequests: pendingRequests,
      pendingPurchaseOrders: pendingOrders,
      warehouseCount,
    };
  }
}
