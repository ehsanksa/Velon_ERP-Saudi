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
import { rethrowPrismaAsBadRequest } from '../common/prisma-errors';
import { NotificationService } from '../email/notification.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  AdjustInventoryStockDto,
  CreateInventoryCategoryDto,
  CreateInventoryProductDto,
  CreateInventoryWarehouseDto,
  DeleteInventoryItemsDto,
  ReceiveInventoryStockDto,
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

  /**
   * Removes catalogue products or a single variant.
   * Stock for the removed product or variant is deleted with it.
   * Invoice lines keep their saved names and are unlinked from the catalogue.
   */
  async deleteItems(user: AuthenticatedUser, dto: DeleteInventoryItemsDto, meta: AuditMeta) {
    this.assertManage(user);
    const tenantId = user.tenantId!;
    const productIds = new Set<string>();
    const variantIds = new Set<string>();
    for (const item of dto.items) {
      if (item.variantId) variantIds.add(item.variantId);
      else if (item.productId) productIds.add(item.productId);
      else throw new BadRequestException('Each item needs a product or a variant.');
    }

    let deleted = 0;
    try {
      deleted = await this.prisma.client.$transaction(async (tx) => {
        let count = 0;
        const variants = variantIds.size
          ? await tx.inventoryProductVariant.findMany({
              where: { tenantId, id: { in: [...variantIds] } },
            })
          : [];
        if (variants.length !== variantIds.size) {
          throw new NotFoundException('One or more variants were not found.');
        }
        const variantsToRemove = variants.filter((variant) => !productIds.has(variant.productId));

        if (productIds.size) {
          const products = await tx.inventoryProduct.findMany({
            where: { tenantId, id: { in: [...productIds] } },
            select: { id: true },
          });
          if (products.length !== productIds.size) {
            throw new NotFoundException('One or more products were not found.');
          }
          await tx.inventoryProduct.deleteMany({
            where: { tenantId, id: { in: [...productIds] } },
          });
          count += products.length;
        }

        for (const variant of variantsToRemove) {
          await tx.inventoryProductVariant.delete({ where: { id: variant.id } });
          count += 1;
          const remaining = await tx.inventoryProductVariant.count({
            where: { productId: variant.productId, tenantId },
          });
          const productLevelStock = await tx.inventoryStock.count({
            where: { productId: variant.productId, tenantId, variantId: null },
          });
          if (remaining === 0 && productLevelStock === 0) {
            await tx.inventoryProduct.delete({ where: { id: variant.productId } });
          } else if (remaining === 0) {
            await tx.inventoryProduct.update({
              where: { id: variant.productId },
              data: { hasVariants: false },
            });
          }
        }
        return count;
      });
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) throw error;
      rethrowPrismaAsBadRequest(error, 'Could not delete the selected items.');
    }

    await this.audit.log({
      actorId: user.id,
      tenantId,
      action: 'inventory.items_deleted',
      entityType: 'inventory_product',
      metadata: { productIds: [...productIds], variantIds: [...variantIds], deleted },
      ipAddress: meta.ip,
      userAgent: meta.ua,
    });

    return { deleted };
  }

  // ─── Products ──────────────────────────────────────────────

  listProducts(user: AuthenticatedUser, search?: string) {
    this.assertRead(user);
    return this.products.findMany({ search });
  }

  async listProductsWithVariantCounts(user: AuthenticatedUser, search?: string) {
    this.assertRead(user);
    const rows = await this.products.findMany({ search });
    const tenantId = user.tenantId!;
    const [counts, stockSums] = await Promise.all([
      this.prisma.client.inventoryProductVariant.groupBy({
        by: ['productId'],
        where: { tenantId },
        _count: { id: true },
      }),
      this.prisma.client.inventoryStock.groupBy({
        by: ['productId'],
        where: { tenantId },
        _sum: { quantity: true, reservedQty: true },
      }),
    ]);
    const countMap = new Map(counts.map((c) => [c.productId, c._count.id]));
    const onHandMap = new Map(
      stockSums.map((row) => [
        row.productId,
        (row._sum.quantity ?? 0) - (row._sum.reservedQty ?? 0),
      ]),
    );
    return rows.map((p) => ({
      ...p,
      variantCount: p.hasVariants ? (countMap.get(p.id) ?? 0) : 0,
      onHand: p.itemType === 'SERVICE' ? null : (onHandMap.get(p.id) ?? 0),
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
      } else if (!isService && !dto.hasVariants && (dto.quantity ?? 0) > 0) {
        let warehouse = (await this.warehouses.findMany(true))[0];
        if (!warehouse) {
          warehouse = await this.warehouses.create({ code: 'MAIN', name: 'Main' });
        }
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
    const product = await this.products.findById(dto.productId);
    if (!product) throw new NotFoundException('Product not found.');
    const variantId = await this.resolveStockVariant(product, dto.variantId);
    let row = await this.stock.findByProductWarehouse(dto.productId, dto.warehouseId, variantId);
    if (!row) {
      if (dto.delta <= 0) throw new NotFoundException('Stock record not found.');
      row = await this.stock.create({
        productId: dto.productId,
        variantId,
        warehouseId: dto.warehouseId,
        quantity: 0,
        minStock: 0,
        reorderLevel: 0,
      });
    }

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

  /** Add quantity for one product or one variant. Does not replace an existing balance. */
  async receiveStock(user: AuthenticatedUser, dto: ReceiveInventoryStockDto, meta: AuditMeta) {
    this.assertManage(user);
    const product = await this.products.findById(dto.productId);
    if (!product) throw new NotFoundException('Product not found.');
    if (product.itemType === InventoryItemType.SERVICE) {
      throw new BadRequestException('Services are not stocked.');
    }
    const variantId = await this.resolveStockVariant(product, dto.variantId);
    const warehouse = await this.resolveReceiveWarehouse(dto.warehouseId, dto.site);
    let row = await this.stock.findByProductWarehouse(product.id, warehouse.id, variantId);
    if (!row) {
      row = await this.stock.create({
        productId: product.id,
        variantId,
        warehouseId: warehouse.id,
        quantity: 0,
        minStock: dto.minStock ?? 0,
        reorderLevel: dto.reorderLevel ?? 0,
      });
    } else if (dto.minStock !== undefined || dto.reorderLevel !== undefined) {
      await this.stock.update(row.id, {
        ...(dto.minStock !== undefined ? { minStock: dto.minStock } : {}),
        ...(dto.reorderLevel !== undefined ? { reorderLevel: dto.reorderLevel } : {}),
      });
    }

    if (dto.quantity > 0) {
      await this.adjustStock(
        user,
        {
          productId: product.id,
          variantId: variantId ?? undefined,
          warehouseId: warehouse.id,
          delta: dto.quantity,
          reason: 'Stock received',
          mfgDate: dto.mfgDate,
          expiryDate: dto.expiryDate,
        },
        meta,
      );
    }

    const updated = await this.stock.findById(row.id, true);
    const soonDays = await this.expiringSoonDays(user.tenantId!);
    return updated ? this.mapStockRow(updated, soonDays) : null;
  }

  private async resolveStockVariant(
    product: { id: string; tenantId: string; hasVariants: boolean },
    variantId?: string | null,
  ) {
    if (product.hasVariants) {
      if (!variantId) {
        throw new BadRequestException('Select a variant before changing stock for this product.');
      }
      const variant = await this.prisma.client.inventoryProductVariant.findFirst({
        where: { id: variantId, productId: product.id, tenantId: product.tenantId },
      });
      if (!variant) throw new NotFoundException('Variant not found.');
      return variant.id;
    }
    if (variantId) throw new BadRequestException('This product does not use variants.');
    return null;
  }

  private async resolveReceiveWarehouse(warehouseId?: string, site?: string) {
    if (warehouseId) {
      const warehouse = await this.warehouses.findById(warehouseId);
      if (!warehouse) throw new NotFoundException('Warehouse not found.');
      return warehouse;
    }
    const name = site?.trim();
    if (!name) throw new BadRequestException('Select a warehouse.');
    const existing = await this.warehouses.findByName(name);
    if (existing) return existing;
    return this.warehouses.create({ code: this.warehouseCode(name), name });
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
      const existing = await this.stock.findByProductWarehouse(
        row.productId,
        warehouse.id,
        row.variantId,
      );
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
      } else if (delta < 0 && batchTracked) {
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
