import { Injectable } from '@nestjs/common';
import { Prisma } from '@velon/database';
import { TenantScopedRepository } from '../common/repositories/tenant-scoped.repository';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InventoryCategoryRepository extends TenantScopedRepository {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  findMany() {
    return this.prisma.client.inventoryCategory.findMany({
      where: this.where(),
      orderBy: { name: 'asc' },
    });
  }

  findById(id: string) {
    return this.prisma.client.inventoryCategory.findFirst({ where: this.where({ id }) });
  }

  create(data: Omit<Prisma.InventoryCategoryUncheckedCreateInput, 'tenantId'>) {
    return this.prisma.client.inventoryCategory.create({
      data: { ...data, tenantId: this.tenantId },
    });
  }

  update(id: string, data: Prisma.InventoryCategoryUncheckedUpdateInput) {
    return this.prisma.client.inventoryCategory.update({ where: { id }, data });
  }

  delete(id: string) {
    return this.prisma.client.inventoryCategory.delete({ where: { id } });
  }
}

@Injectable()
export class InventoryProductRepository extends TenantScopedRepository {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  findMany(opts?: { search?: string; status?: string }) {
    const OR: Prisma.InventoryProductWhereInput[] = [];
    const q = opts?.search?.trim();
    if (q) {
      OR.push(
        { name: { contains: q, mode: 'insensitive' } },
        { sku: { contains: q, mode: 'insensitive' } },
        { barcode: { contains: q, mode: 'insensitive' } },
      );
    }
    return this.prisma.client.inventoryProduct.findMany({
      where: {
        ...this.where(opts?.status ? { status: opts.status as never } : {}),
        ...(OR.length ? { OR } : {}),
      },
      include: { category: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  findById(id: string) {
    return this.prisma.client.inventoryProduct.findFirst({
      where: this.where({ id }),
      include: { category: true, stock: { include: { warehouse: true } } },
    });
  }

  findBySku(sku: string) {
    return this.prisma.client.inventoryProduct.findFirst({
      where: this.where({ sku }),
    });
  }

  findBySkus(skus: string[]) {
    if (skus.length === 0) return Promise.resolve([]);
    return this.prisma.client.inventoryProduct.findMany({
      where: this.where({ sku: { in: skus } }),
      select: { id: true, sku: true, name: true, status: true, itemType: true },
    });
  }

  count() {
    return this.prisma.client.inventoryProduct.count({ where: this.where() });
  }

  create(data: Omit<Prisma.InventoryProductUncheckedCreateInput, 'tenantId'>) {
    return this.prisma.client.inventoryProduct.create({
      data: { ...data, tenantId: this.tenantId },
      include: { category: true },
    });
  }

  update(id: string, data: Prisma.InventoryProductUncheckedUpdateInput) {
    return this.prisma.client.inventoryProduct.update({
      where: { id },
      data,
      include: { category: true },
    });
  }
}

@Injectable()
export class InventoryWarehouseRepository extends TenantScopedRepository {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  findMany(activeOnly = false) {
    return this.prisma.client.inventoryWarehouse.findMany({
      where: this.where(activeOnly ? { isActive: true } : {}),
      include: { manager: { select: { id: true, name: true, email: true } } },
      orderBy: { name: 'asc' },
    });
  }

  findById(id: string) {
    return this.prisma.client.inventoryWarehouse.findFirst({
      where: this.where({ id }),
      include: { manager: { select: { id: true, name: true, email: true } } },
    });
  }

  findByCode(code: string) {
    return this.prisma.client.inventoryWarehouse.findFirst({
      where: this.where({ code }),
    });
  }

  findByName(name: string) {
    return this.prisma.client.inventoryWarehouse.findFirst({
      where: this.where({ name: { equals: name, mode: Prisma.QueryMode.insensitive } }),
    });
  }

  count(activeOnly = false) {
    return this.prisma.client.inventoryWarehouse.count({
      where: this.where(activeOnly ? { isActive: true } : {}),
    });
  }

  create(data: Omit<Prisma.InventoryWarehouseUncheckedCreateInput, 'tenantId'>) {
    return this.prisma.client.inventoryWarehouse.create({
      data: { ...data, tenantId: this.tenantId },
      include: { manager: { select: { id: true, name: true, email: true } } },
    });
  }

  update(id: string, data: Prisma.InventoryWarehouseUncheckedUpdateInput) {
    return this.prisma.client.inventoryWarehouse.update({
      where: { id },
      data,
      include: { manager: { select: { id: true, name: true, email: true } } },
    });
  }
}

@Injectable()
export class InventoryStockRepository extends TenantScopedRepository {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  findMany(opts?: { includeBatches?: boolean }) {
    return this.prisma.client.inventoryStock.findMany({
      where: this.where(),
      include: {
        product: true,
        warehouse: true,
        variant: true,
        ...(opts?.includeBatches
          ? { batches: { where: { quantity: { gt: 0 } }, orderBy: { expiryDate: 'asc' } } }
          : {}),
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  findById(id: string, includeBatches = false) {
    return this.prisma.client.inventoryStock.findFirst({
      where: this.where({ id }),
      include: {
        product: true,
        warehouse: true,
        variant: true,
        ...(includeBatches
          ? { batches: { where: { quantity: { gt: 0 } }, orderBy: { expiryDate: 'asc' } } }
          : {}),
      },
    });
  }

  findByProductWarehouse(productId: string, warehouseId: string, variantId?: string | null) {
    return this.prisma.client.inventoryStock.findFirst({
      where: this.where({
        productId,
        warehouseId,
        variantId: variantId ?? null,
      }),
      include: { product: true, warehouse: true, variant: true },
    });
  }

  create(data: Omit<Prisma.InventoryStockUncheckedCreateInput, 'tenantId'>) {
    return this.prisma.client.inventoryStock.create({
      data: { ...data, tenantId: this.tenantId },
      include: { product: true, warehouse: true, variant: true },
    });
  }

  update(id: string, data: Prisma.InventoryStockUncheckedUpdateInput) {
    return this.prisma.client.inventoryStock.update({
      where: { id },
      data,
      include: { product: true, warehouse: true, variant: true },
    });
  }
}

export const INVENTORY_REPOSITORIES = [
  InventoryCategoryRepository,
  InventoryProductRepository,
  InventoryWarehouseRepository,
  InventoryStockRepository,
];
