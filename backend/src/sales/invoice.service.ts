import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  Prisma,
  SalesInvoiceLineType,
  SalesInvoicePaymentMethod,
  SalesInvoiceStatus,
} from '@velon/database';
import {
  assessZatcaPhase1Readiness,
  buildZatcaTlvBase64,
  calculateInvoiceTotals,
  canReadSales,
  canWriteSales,
  normalizeVelonRole,
  resolveLineVat,
  resolvePaymentStatus,
  shouldDeductStock,
  standardVatRateOn,
} from '@velon/shared';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { resolveTenantCustomerFrom, sendTransactionalMail } from '../common/mail-delivery.util';
import { CrmCustomerRepository } from '../crm/crm.repositories';
import { InventoryBatchService } from '../inventory/inventory-batch.service';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreateSalesInvoiceDto,
  InvoiceProductSearchDto,
  InvoiceQueryDto,
  RecordInvoicePaymentDto,
  SendInvoiceEmailDto,
  UpdateSalesInvoiceDto,
} from './dto/invoice.dto';
import { InvoicePdfService } from './invoice-pdf.service';
import { SalesInvoiceRepository } from './invoice.repositories';

type AuditMeta = { ip?: string; ua?: string };

type ResolvedLine = {
  lineType: SalesInvoiceLineType;
  productId?: string;
  variantId?: string;
  stockId?: string;
  itemName: string;
  sku?: string;
  description?: string;
  uom?: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxTreatment?: string;
  taxRate: number;
  taxAmount: number;
  lineSubtotal: number;
  lineTotal: number;
  position: number;
  tracksStock: boolean;
};

@Injectable()
export class InvoiceService {
  constructor(
    private readonly invoices: SalesInvoiceRepository,
    private readonly customers: CrmCustomerRepository,
    private readonly prisma: PrismaService,
    private readonly batches: InventoryBatchService,
    private readonly pdf: InvoicePdfService,
    private readonly audit: AuditService,
  ) {}

  private assertRead(user: AuthenticatedUser) {
    if (!canReadSales(normalizeVelonRole(user.role))) {
      throw new ForbiddenException('Insufficient permissions.');
    }
  }

  private assertWrite(user: AuthenticatedUser) {
    if (!canWriteSales(normalizeVelonRole(user.role))) {
      throw new ForbiddenException('Insufficient permissions.');
    }
  }

  private requireWorkspace(user: AuthenticatedUser) {
    if (!user.tenantId || !user.workspaceId) {
      throw new BadRequestException('Tenant workspace context is required.');
    }
    return { tenantId: user.tenantId, workspaceId: user.workspaceId };
  }

  async bootstrap(user: AuthenticatedUser) {
    this.assertRead(user);
    const { tenantId, workspaceId } = this.requireWorkspace(user);
    const year = new Date().getFullYear();
    const [workspace, warehouses, companyProfile] = await Promise.all([
      this.prisma.client.workspace.findFirst({
        where: { id: workspaceId, tenantId },
      }),
      this.prisma.client.inventoryWarehouse.findMany({
        where: { tenantId, isActive: true },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, code: true },
      }),
      this.prisma.client.companyProfile.findFirst({
        where: { tenantId },
        select: { logoDataUrl: true, legalName: true },
      }),
    ]);
    if (!workspace) throw new BadRequestException('Workspace does not match tenant context.');

    const previewNumber = `INV-${year}-******`;
    return {
      currency: workspace.currency,
      currencySymbol: workspace.currencySymbol,
      invoiceNumberPreview: previewNumber,
      warehouses,
      hasLogo: Boolean(companyProfile?.logoDataUrl),
      companyName: companyProfile?.legalName ?? workspace.name,
    };
  }

  async searchProducts(user: AuthenticatedUser, query: InvoiceProductSearchDto) {
    this.assertRead(user);
    const { tenantId } = this.requireWorkspace(user);
    const search = query.search?.trim();
    const warehouseId = query.warehouseId;

    const warehouse = await this.prisma.client.inventoryWarehouse.findFirst({
      where: { id: warehouseId, tenantId },
    });
    if (!warehouse) throw new NotFoundException('Warehouse not found.');

    const OR: Prisma.InventoryProductWhereInput[] = [];
    if (search) {
      OR.push(
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { barcode: { contains: search, mode: 'insensitive' } },
        { variants: { some: { label: { contains: search, mode: 'insensitive' } } } },
        { variants: { some: { sku: { contains: search, mode: 'insensitive' } } } },
        { variants: { some: { barcode: { contains: search, mode: 'insensitive' } } } },
      );
    }

    const products = await this.prisma.client.inventoryProduct.findMany({
      where: {
        tenantId,
        status: 'ACTIVE',
        ...(OR.length ? { OR } : {}),
      },
      include: {
        variants: {
          where: { status: 'ACTIVE' },
          orderBy: { sortOrder: 'asc' },
          include: {
            stock: { where: { warehouseId } },
          },
        },
        stock: { where: { warehouseId, variantId: null } },
      },
      orderBy: { name: 'asc' },
      take: 48,
    });

    return products.flatMap((product) => {
      if (product.hasVariants && product.variants.length) {
        return product.variants.map((variant) => {
          const stock = variant.stock[0];
          const available = stock ? stock.quantity - stock.reservedQty : 0;
          return {
            productId: product.id,
            variantId: variant.id as string | null,
            stockId: stock?.id,
            name: `${product.name} — ${variant.label}`,
            sku: variant.sku,
            barcode: variant.barcode,
            unitPrice: Number(variant.salePrice ?? variant.unitPrice ?? product.unitPrice),
            uom: product.uom,
            availableQty: available,
            hasVariants: true,
            itemType: product.itemType,
            taxTreatment: 'STANDARD' as const,
            taxRate: standardVatRateOn(new Date()) ?? 0,
          };
        });
      }

      const stock = product.stock[0];
      const available = stock ? stock.quantity - stock.reservedQty : 0;
      return [
        {
          productId: product.id,
          variantId: null as string | null,
          stockId: stock?.id,
          name: product.name,
          sku: product.sku,
          barcode: product.barcode,
          unitPrice: Number(product.unitPrice),
          uom: product.uom,
          availableQty: available,
          hasVariants: false,
          itemType: product.itemType,
          taxTreatment: 'STANDARD' as const,
          taxRate: standardVatRateOn(new Date()) ?? 0,
        },
      ];
    });
  }

  async list(user: AuthenticatedUser, query: InvoiceQueryDto) {
    this.assertRead(user);
    return this.invoices.findMany(query);
  }

  async getById(user: AuthenticatedUser, id: string) {
    this.assertRead(user);
    const row = await this.invoices.findById(id);
    if (!row) throw new NotFoundException('Invoice not found.');
    return row;
  }

  private async resolveCustomer(
    user: AuthenticatedUser,
    dto: CreateSalesInvoiceDto,
  ): Promise<{
    customerId?: string;
    customerName: string;
    customerPhone?: string;
    customerEmail?: string;
    customerAddress?: string;
    customerTaxId?: string;
    customerNotes?: string;
  }> {
    const { tenantId } = this.requireWorkspace(user);

    if (dto.customerId) {
      const customer = await this.customers.findById(dto.customerId);
      if (!customer) throw new NotFoundException('Customer not found.');
      return {
        customerId: customer.id,
        customerName: customer.companyName,
        customerPhone: dto.customerPhone ?? customer.phone ?? undefined,
        customerEmail: dto.customerEmail ?? customer.email ?? undefined,
        customerAddress: dto.customerAddress ?? customer.address ?? undefined,
        customerTaxId: dto.customerTaxId ?? customer.taxId ?? undefined,
        customerNotes: dto.customerNotes ?? customer.notes ?? undefined,
      };
    }

    if (dto.createCustomer && dto.customerName?.trim()) {
      this.assertWrite(user);
      const created = await this.customers.create({
        customerCode: `C-${Date.now().toString(36).toUpperCase().slice(-8)}`,
        companyName: dto.customerName.trim(),
        email: dto.customerEmail,
        phone: dto.customerPhone,
        address: dto.customerAddress,
        taxId: dto.customerTaxId,
        notes: dto.customerNotes,
        status: 'ACTIVE',
        createdById: user.id,
      });
      return {
        customerId: created.id,
        customerName: created.companyName,
        customerPhone: created.phone ?? undefined,
        customerEmail: created.email ?? undefined,
        customerAddress: created.address ?? undefined,
        customerTaxId: created.taxId ?? undefined,
        customerNotes: created.notes ?? undefined,
      };
    }

    if (!dto.customerName?.trim()) {
      throw new BadRequestException('Customer name is required.');
    }

    return {
      customerName: dto.customerName.trim(),
      customerPhone: dto.customerPhone,
      customerEmail: dto.customerEmail,
      customerAddress: dto.customerAddress,
      customerTaxId: dto.customerTaxId,
      customerNotes: dto.customerNotes,
    };
  }

  private resolveTargetStatus(
    action: CreateSalesInvoiceDto['action'],
    totals: { total: number; balanceDue: number; amountPaid: number },
    dueDate?: Date | null,
  ): SalesInvoiceStatus {
    if (action === 'draft') return SalesInvoiceStatus.DRAFT;
    if (action === 'save_paid' || totals.amountPaid >= totals.total) {
      return SalesInvoiceStatus.PAID;
    }
    const base = resolvePaymentStatus(
      totals.total,
      totals.amountPaid,
      SalesInvoiceStatus.UNPAID,
      dueDate,
    );
    return base as SalesInvoiceStatus;
  }

  private async buildResolvedLines(
    user: AuthenticatedUser,
    dto: CreateSalesInvoiceDto,
    warehouseId: string | undefined,
    issueDate: Date,
  ): Promise<ResolvedLine[]> {
    const { tenantId } = this.requireWorkspace(user);
    const canOverridePrice = canWriteSales(normalizeVelonRole(user.role));
    const hasProductLines = dto.lines.some(
      (line) => (line.lineType ?? SalesInvoiceLineType.PRODUCT) === SalesInvoiceLineType.PRODUCT,
    );
    if (hasProductLines && !warehouseId) {
      throw new BadRequestException('Select a warehouse before adding inventory products.');
    }

    const merged = new Map<string, (typeof dto.lines)[number]>();
    for (const line of dto.lines) {
      const type = line.lineType ?? SalesInvoiceLineType.PRODUCT;
      const key =
        type === SalesInvoiceLineType.PRODUCT && line.productId
          ? `${line.productId}:${line.variantId ?? ''}`
          : `custom:${line.itemName}:${merged.size}`;
      const existing = merged.get(key);
      if (existing && type === SalesInvoiceLineType.PRODUCT) {
        existing.quantity += line.quantity;
      } else {
        merged.set(key, { ...line, lineType: type });
      }
    }

    const resolved: ResolvedLine[] = [];
    let position = 0;
    for (const line of merged.values()) {
      const lineType = line.lineType ?? SalesInvoiceLineType.PRODUCT;
      let itemName = line.itemName;
      let sku = line.sku;
      let uom = line.uom;
      let unitPrice = line.unitPrice;
      let stockId: string | undefined;
      let tracksStock = false;

      if (lineType === SalesInvoiceLineType.PRODUCT) {
        if (!line.productId) throw new BadRequestException('Product lines require productId.');
        const product = await this.prisma.client.inventoryProduct.findFirst({
          where: { id: line.productId, tenantId },
          include: {
            variants: line.variantId ? { where: { id: line.variantId, tenantId } } : false,
          },
        });
        if (!product) throw new NotFoundException('Product not found.');
        tracksStock = product.itemType !== 'SERVICE';

        const variant = line.variantId
          ? await this.prisma.client.inventoryProductVariant.findFirst({
              where: { id: line.variantId, tenantId, productId: product.id },
            })
          : null;
        if (line.variantId && !variant) throw new NotFoundException('Variant not found.');

        const stock = await this.prisma.client.inventoryStock.findFirst({
          where: {
            tenantId,
            warehouseId: warehouseId!,
            productId: product.id,
            variantId: variant?.id ?? null,
          },
        });
        stockId = stock?.id;

        const catalogPrice = variant
          ? Number(variant.salePrice ?? variant.unitPrice ?? product.unitPrice)
          : Number(product.unitPrice);
        if (!canOverridePrice) unitPrice = catalogPrice;

        itemName = variant ? `${product.name} — ${variant.label}` : product.name;
        sku = variant?.sku ?? product.sku;
        uom = product.uom;
      }

      const vat = resolveLineVat({
        treatment: line.taxTreatment,
        explicitRate: line.taxTreatment ? undefined : line.taxRate,
        taxInclusive: dto.pricesIncludeVat === true,
        quantity: line.quantity,
        unitPrice,
        discount: line.discount ?? 0,
        issuedOn: issueDate,
      });

      resolved.push({
        lineType,
        productId: line.productId,
        variantId: line.variantId,
        stockId,
        itemName,
        sku,
        description: line.description,
        uom,
        quantity: line.quantity,
        unitPrice,
        discount: line.discount ?? 0,
        taxTreatment: vat.treatment,
        taxRate: vat.ratePercent,
        taxAmount: vat.taxAmount,
        lineSubtotal: vat.lineSubtotal,
        lineTotal: vat.lineTotal,
        position: position++,
        tracksStock,
      });
    }

    return resolved;
  }

  private async applyStockDeduction(
    tenantId: string,
    lines: ResolvedLine[],
    tx: Prisma.TransactionClient,
  ) {
    const movements = new Map<number, Prisma.InputJsonValue>();
    for (const line of lines) {
      if (!line.tracksStock || !line.stockId) continue;
      const qty = Math.max(0, Math.round(line.quantity));
      if (qty <= 0) continue;
      const { allocations } = await this.batches.allocateAndDeduct(tenantId, line.stockId, qty, tx);
      movements.set(line.position, {
        stockId: line.stockId,
        qty,
        allocations,
      });
    }
    return movements;
  }

  private async reverseStock(
    tenantId: string,
    items: Array<{
      stockId: string | null;
      stockMovement: Prisma.JsonValue | null;
      quantity: unknown;
    }>,
    tx: Prisma.TransactionClient,
  ) {
    for (const item of items) {
      if (!item.stockId || !item.stockMovement || typeof item.stockMovement !== 'object') continue;
      const movement = item.stockMovement as {
        qty?: number;
        allocations?: Array<{ batchId: string; qty: number; unitCost: number }>;
      };
      const qty = movement.qty ?? Math.ceil(Number(item.quantity));
      await this.batches.restoreDeduction(
        tenantId,
        item.stockId,
        qty,
        movement.allocations ?? [],
        tx,
      );
    }
  }

  async create(user: AuthenticatedUser, dto: CreateSalesInvoiceDto, meta: AuditMeta) {
    this.assertWrite(user);
    const { tenantId, workspaceId } = this.requireWorkspace(user);

    if (dto.idempotencyKey) {
      const existing = await this.invoices.findByIdempotencyKey(dto.idempotencyKey);
      if (existing) return existing;
    }

    const workspace = await this.prisma.client.workspace.findFirst({
      where: { id: workspaceId, tenantId },
    });
    if (!workspace) throw new BadRequestException('Workspace does not match tenant context.');

    const customer = await this.resolveCustomer(user, dto);
    const issueDate = dto.issueDate ? new Date(dto.issueDate) : new Date();
    const dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    const warehouseId = dto.warehouseId;

    const resolvedLines = await this.buildResolvedLines(user, dto, warehouseId, issueDate);
    if (
      dto.action !== 'draft' &&
      resolvedLines.some((line) => line.taxTreatment === 'REVIEW_REQUIRED')
    ) {
      throw new BadRequestException(
        'Select a VAT treatment for every line before issuing the invoice. Drafts can be saved for review.',
      );
    }
    const amountPaid = dto.action === 'save_paid' ? undefined : Math.max(0, dto.amountPaid ?? 0);

    const totals = dto.pricesIncludeVat
      ? {
          subtotal: resolvedLines.reduce((sum, line) => sum + line.lineSubtotal, 0),
          taxAmount: resolvedLines.reduce((sum, line) => sum + line.taxAmount, 0),
          total:
            resolvedLines.reduce((sum, line) => sum + line.lineTotal, 0) +
            (dto.shippingCharges ?? 0) +
            (dto.roundingAdjustment ?? 0),
          balanceDue: 0,
        }
      : calculateInvoiceTotals({
          lines: resolvedLines.map((line) => ({
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            discount: line.discount,
            taxRate: line.taxRate,
          })),
          invoiceDiscount: dto.discount ?? 0,
          shippingCharges: dto.shippingCharges ?? 0,
          roundingAdjustment: dto.roundingAdjustment ?? 0,
          amountPaid: amountPaid ?? 0,
        });
    if (dto.pricesIncludeVat) {
      if ((dto.discount ?? 0) > 0) {
        throw new BadRequestException(
          'Put discounts on each line when prices include VAT so the VAT amount stays attributable.',
        );
      }
      totals.balanceDue = Math.max(0, Math.round((totals.total - (amountPaid ?? 0)) * 100) / 100);
      totals.subtotal = Math.round(totals.subtotal * 100) / 100;
      totals.taxAmount = Math.round(totals.taxAmount * 100) / 100;
      totals.total = Math.round(totals.total * 100) / 100;
    }

    let paidAmount = amountPaid ?? 0;
    if (dto.action === 'save_paid') paidAmount = totals.total;

    const finalTotals = dto.pricesIncludeVat
      ? {
          lines: [],
          subtotal: totals.subtotal,
          taxAmount: totals.taxAmount,
          total: totals.total,
          balanceDue: Math.max(0, Math.round((totals.total - paidAmount) * 100) / 100),
        }
      : calculateInvoiceTotals({
          lines: resolvedLines.map((line) => ({
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            discount: line.discount,
            taxRate: line.taxRate,
          })),
          invoiceDiscount: dto.discount ?? 0,
          shippingCharges: dto.shippingCharges ?? 0,
          roundingAdjustment: dto.roundingAdjustment ?? 0,
          amountPaid: paidAmount,
        });

    const status = this.resolveTargetStatus(
      dto.action,
      {
        total: finalTotals.total,
        balanceDue: finalTotals.balanceDue,
        amountPaid: paidAmount,
      },
      dueDate,
    );

    let salespersonName: string | undefined;
    if (dto.salespersonId) {
      const sp = await this.prisma.client.user.findFirst({ where: { id: dto.salespersonId } });
      salespersonName = sp?.name ?? sp?.email ?? undefined;
    }

    const year = issueDate.getFullYear();
    const invoiceNumber = await this.invoices.nextInvoiceNumber(year);
    const deductStock = shouldDeductStock(status);
    if (deductStock) {
      const missing = resolvedLines.filter((line) => line.tracksStock && !line.stockId);
      if (missing.length > 0) {
        throw new BadRequestException(
          `No stock is recorded for ${missing.map((line) => line.itemName).join(', ')} in the selected warehouse.`,
        );
      }
    }
    const profile = await this.prisma.client.companyProfile.findUnique({ where: { tenantId } });
    const sellerName = profile?.legalNameAr?.trim() || profile?.legalName?.trim() || '';
    const vatNumber = profile?.vatRegistrationNumber?.trim() || profile?.taxId?.trim() || '';
    const zatcaTimestamp = issueDate.toISOString();
    const zatcaTotal = finalTotals.total.toFixed(2);
    const zatcaVat = finalTotals.taxAmount.toFixed(2);
    const readiness = assessZatcaPhase1Readiness({
      sellerName,
      vatNumber,
      timestamp: zatcaTimestamp,
      totalWithVat: zatcaTotal,
      vatAmount: zatcaVat,
    });
    const zatcaQrPayload = readiness.readyForPhase1Qr
      ? buildZatcaTlvBase64({
          sellerName,
          vatNumber,
          timestamp: zatcaTimestamp,
          totalWithVat: zatcaTotal,
          vatAmount: zatcaVat,
        })
      : null;
    const zatcaStatus = readiness.readyForPhase1Qr ? 'QR_READY' : 'PENDING_SELLER_VAT';
    const zatcaStatusDetail = readiness.readyForPhase1Qr
      ? 'Phase 1 QR generated locally. This is not a ZATCA clearance or reporting confirmation.'
      : `Phase 1 QR was not generated. Missing: ${readiness.missing.join(', ')}.`;

    const created = await this.prisma.client.$transaction(async (tx) => {
      const stockMovements = deductStock
        ? await this.applyStockDeduction(tenantId, resolvedLines, tx)
        : new Map<number, Prisma.InputJsonValue>();

      const invoice = await tx.salesInvoice.create({
        data: {
          tenantId,
          workspaceId,
          invoiceNumber,
          customerId: customer.customerId,
          customerName: customer.customerName,
          customerPhone: customer.customerPhone,
          customerEmail: customer.customerEmail,
          customerAddress: customer.customerAddress,
          customerTaxId: customer.customerTaxId,
          customerNotes: customer.customerNotes,
          issueDate,
          dueDate,
          status,
          paymentMethod: dto.paymentMethod,
          salespersonId: dto.salespersonId,
          salespersonName,
          referenceNumber: dto.referenceNumber,
          notes: dto.notes,
          footerNotes: dto.footerNotes,
          warehouseId,
          currency: workspace.currency,
          invoiceKind: customer.customerTaxId ? 'TAX_INVOICE' : 'SIMPLIFIED_TAX_INVOICE',
          pricesIncludeVat: dto.pricesIncludeVat === true,
          zatcaUuid: randomUUID(),
          zatcaQrPayload,
          zatcaStatus,
          zatcaStatusDetail,
          subtotal: finalTotals.subtotal,
          discount: dto.discount ?? 0,
          taxAmount: finalTotals.taxAmount,
          shippingCharges: dto.shippingCharges ?? 0,
          roundingAdjustment: dto.roundingAdjustment ?? 0,
          total: finalTotals.total,
          amountPaid: paidAmount,
          balanceDue: finalTotals.balanceDue,
          stockDeductedAt: deductStock ? new Date() : null,
          idempotencyKey: dto.idempotencyKey,
          createdById: user.id,
          items: {
            create: resolvedLines.map((line) => ({
              tenantId,
              lineType: line.lineType,
              productId: line.productId,
              variantId: line.variantId,
              stockId: line.stockId,
              itemName: line.itemName,
              sku: line.sku,
              description: line.description,
              uom: line.uom,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              discount: line.discount,
              taxTreatment: line.taxTreatment,
              taxRate: line.taxRate,
              taxAmount: line.taxAmount,
              lineSubtotal: line.lineSubtotal,
              lineTotal: line.lineTotal,
              position: line.position,
              stockMovement: stockMovements.get(line.position),
            })),
          },
          ...(paidAmount > 0
            ? {
                payments: {
                  create: {
                    tenantId,
                    amount: paidAmount,
                    method: dto.paymentMethod ?? SalesInvoicePaymentMethod.CASH,
                    reference: dto.referenceNumber,
                    recordedById: user.id,
                  },
                },
              }
            : {}),
        },
        include: {
          items: { orderBy: { position: 'asc' } },
          payments: true,
          customer: true,
          warehouse: true,
          salesperson: true,
        },
      });

      return invoice;
    });

    await this.audit.log({
      actorId: user.id,
      tenantId,
      action: 'sales.invoice_created',
      entityType: 'sales_invoice',
      entityId: created.id,
      metadata: {
        invoiceNumber: created.invoiceNumber,
        status: created.status,
        total: created.total,
      },
      ipAddress: meta.ip,
      userAgent: meta.ua,
    });

    return created;
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateSalesInvoiceDto, meta: AuditMeta) {
    this.assertWrite(user);
    const existing = await this.getById(user, id);
    if (existing.status !== SalesInvoiceStatus.DRAFT) {
      throw new BadRequestException('Only draft invoices can be edited.');
    }
    await this.remove(user, id, meta);
    return this.create(user, dto, meta);
  }

  async recordPayment(
    user: AuthenticatedUser,
    id: string,
    dto: RecordInvoicePaymentDto,
    meta: AuditMeta,
  ) {
    this.assertWrite(user);
    const { tenantId } = this.requireWorkspace(user);
    const invoice = await this.getById(user, id);
    if (
      (
        [
          SalesInvoiceStatus.CANCELLED,
          SalesInvoiceStatus.VOID,
          SalesInvoiceStatus.DRAFT,
        ] as string[]
      ).includes(invoice.status)
    ) {
      throw new BadRequestException('Cannot record payment on this invoice.');
    }

    const newPaid = Number(invoice.amountPaid) + dto.amount;
    if (newPaid > Number(invoice.total) + 0.01) {
      throw new BadRequestException('Payment exceeds invoice total.');
    }

    const balanceDue = Math.max(0, Math.round((Number(invoice.total) - newPaid) * 100) / 100);
    const status = resolvePaymentStatus(
      Number(invoice.total),
      newPaid,
      invoice.status,
      invoice.dueDate,
    ) as SalesInvoiceStatus;

    const updated = await this.prisma.client.$transaction(async (tx) => {
      await tx.salesInvoicePayment.create({
        data: {
          tenantId,
          invoiceId: invoice.id,
          amount: dto.amount,
          method: dto.method,
          reference: dto.reference,
          notes: dto.notes,
          recordedById: user.id,
        },
      });
      return tx.salesInvoice.update({
        where: { id: invoice.id },
        data: {
          amountPaid: newPaid,
          balanceDue,
          status,
          paymentMethod: dto.method,
          updatedById: user.id,
        },
        include: {
          items: { orderBy: { position: 'asc' } },
          payments: { orderBy: { paidAt: 'desc' } },
          customer: true,
          warehouse: true,
          salesperson: true,
        },
      });
    });

    await this.audit.log({
      actorId: user.id,
      tenantId,
      action: 'sales.invoice_payment_recorded',
      entityType: 'sales_invoice',
      entityId: invoice.id,
      metadata: { amount: dto.amount, status },
      ipAddress: meta.ip,
      userAgent: meta.ua,
    });

    return updated;
  }

  async cancel(user: AuthenticatedUser, id: string, meta: AuditMeta) {
    return this.changeTerminalStatus(
      user,
      id,
      SalesInvoiceStatus.CANCELLED,
      meta,
      'sales.invoice_cancelled',
    );
  }

  async voidInvoice(user: AuthenticatedUser, id: string, meta: AuditMeta) {
    return this.changeTerminalStatus(
      user,
      id,
      SalesInvoiceStatus.VOID,
      meta,
      'sales.invoice_voided',
    );
  }

  private async changeTerminalStatus(
    user: AuthenticatedUser,
    id: string,
    status: SalesInvoiceStatus,
    meta: AuditMeta,
    action: string,
  ) {
    this.assertWrite(user);
    const { tenantId } = this.requireWorkspace(user);
    const invoice = await this.getById(user, id);
    if (
      ([SalesInvoiceStatus.CANCELLED, SalesInvoiceStatus.VOID] as string[]).includes(invoice.status)
    ) {
      throw new ConflictException('Invoice is already cancelled or void.');
    }

    const updated = await this.prisma.client.$transaction(async (tx) => {
      if (invoice.stockDeductedAt) {
        await this.reverseStock(tenantId, invoice.items, tx);
      }
      return tx.salesInvoice.update({
        where: { id: invoice.id },
        data: { status, stockDeductedAt: null, updatedById: user.id },
        include: {
          items: { orderBy: { position: 'asc' } },
          payments: true,
          customer: true,
          warehouse: true,
          salesperson: true,
        },
      });
    });

    await this.audit.log({
      actorId: user.id,
      tenantId,
      action,
      entityType: 'sales_invoice',
      entityId: invoice.id,
      metadata: { status },
      ipAddress: meta.ip,
      userAgent: meta.ua,
    });

    return updated;
  }

  async remove(user: AuthenticatedUser, id: string, meta: AuditMeta) {
    this.assertWrite(user);
    const { tenantId } = this.requireWorkspace(user);
    const invoice = await this.getById(user, id);
    if (invoice.status !== SalesInvoiceStatus.DRAFT) {
      throw new BadRequestException('Only draft invoices can be deleted.');
    }
    await this.prisma.client.salesInvoice.delete({ where: { id: invoice.id } });
    await this.audit.log({
      actorId: user.id,
      tenantId,
      action: 'sales.invoice_deleted',
      entityType: 'sales_invoice',
      entityId: id,
      metadata: { invoiceNumber: invoice.invoiceNumber },
      ipAddress: meta.ip,
      userAgent: meta.ua,
    });
    return { deleted: true };
  }

  async duplicate(user: AuthenticatedUser, id: string, meta: AuditMeta) {
    const source = await this.getById(user, id);
    return this.create(
      user,
      {
        customerId: source.customerId ?? undefined,
        customerName: source.customerName,
        customerPhone: source.customerPhone ?? undefined,
        customerEmail: source.customerEmail ?? undefined,
        customerAddress: source.customerAddress ?? undefined,
        customerTaxId: source.customerTaxId ?? undefined,
        customerNotes: source.customerNotes ?? undefined,
        warehouseId: source.warehouseId ?? undefined,
        referenceNumber: source.referenceNumber ?? undefined,
        notes: source.notes ?? undefined,
        footerNotes: source.footerNotes ?? undefined,
        discount: Number(source.discount),
        shippingCharges: Number(source.shippingCharges),
        roundingAdjustment: Number(source.roundingAdjustment),
        action: 'draft',
        lines: source.items.map((item) => ({
          lineType: item.lineType,
          productId: item.productId ?? undefined,
          variantId: item.variantId ?? undefined,
          itemName: item.itemName,
          sku: item.sku ?? undefined,
          description: item.description ?? undefined,
          uom: item.uom ?? undefined,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          discount: Number(item.discount),
          taxRate: Number(item.taxRate),
        })),
      },
      meta,
    );
  }

  private async companyContext(tenantId: string) {
    const [profile, tenant] = await Promise.all([
      this.prisma.client.companyProfile.findFirst({ where: { tenantId } }),
      this.prisma.client.tenant.findFirst({
        where: { id: tenantId },
        include: { workspace: true },
      }),
    ]);
    const nationalAddress = [
      [profile?.buildingNumber, profile?.streetName].filter(Boolean).join(' '),
      profile?.district,
      profile?.city,
      profile?.postalCode,
      profile?.additionalNumber ? `Additional ${profile.additionalNumber}` : null,
      profile?.region,
    ]
      .filter((part) => part && part.trim())
      .join(', ');
    return {
      name: profile?.legalName ?? tenant?.name ?? 'Company',
      legalName: profile?.legalName,
      email: profile?.email,
      phone: profile?.phone,
      address: nationalAddress || profile?.address,
      website: profile?.website,
      taxId: profile?.vatRegistrationNumber?.trim() || profile?.taxId,
      commercialRegistrationNumber: profile?.commercialRegistrationNumber,
      logoDataUrl: profile?.logoDataUrl,
      currency: tenant?.workspace?.currency ?? 'SAR',
    };
  }

  async getPdfBuffer(user: AuthenticatedUser, id: string) {
    this.assertRead(user);
    const invoice = await this.getById(user, id);
    const company = await this.companyContext(invoice.tenantId);
    return this.pdf.generate({
      invoiceNumber: invoice.invoiceNumber,
      issueDate: invoice.issueDate.toISOString().slice(0, 10),
      dueDate: invoice.dueDate?.toISOString().slice(0, 10),
      status: invoice.status,
      paymentMethod: invoice.paymentMethod,
      referenceNumber: invoice.referenceNumber,
      salespersonName: invoice.salespersonName,
      currency: invoice.currency,
      subtotal: Number(invoice.subtotal),
      discount: Number(invoice.discount),
      taxAmount: Number(invoice.taxAmount),
      shippingCharges: Number(invoice.shippingCharges),
      roundingAdjustment: Number(invoice.roundingAdjustment),
      total: Number(invoice.total),
      amountPaid: Number(invoice.amountPaid),
      balanceDue: Number(invoice.balanceDue),
      notes: invoice.notes,
      footerNotes: invoice.footerNotes,
      company,
      customer: {
        name: invoice.customerName,
        email: invoice.customerEmail,
        phone: invoice.customerPhone,
        address: invoice.customerAddress,
        taxId: invoice.customerTaxId,
        notes: invoice.customerNotes,
      },
      items: invoice.items.map((item) => ({
        itemName: item.itemName,
        sku: item.sku,
        quantity: Number(item.quantity),
        uom: item.uom,
        unitPrice: Number(item.unitPrice),
        discount: Number(item.discount),
        taxRate: Number(item.taxRate),
        lineTotal: Number(item.lineTotal),
      })),
    });
  }

  async sendEmail(user: AuthenticatedUser, id: string, dto: SendInvoiceEmailDto) {
    this.assertWrite(user);
    const invoice = await this.getById(user, id);
    const to = dto.to ?? invoice.customerEmail;
    if (!to) throw new BadRequestException('Customer email is required to send invoice.');

    const company = await this.companyContext(invoice.tenantId);
    const sender = resolveTenantCustomerFrom({
      companyName: company.name,
      companyEmail: company.email,
    });
    const body = dto.message ?? 'Please find your invoice attached.';
    const pdfBuffer = await this.getPdfBuffer(user, id);
    try {
      const result = await sendTransactionalMail({
        to,
        from: sender.from,
        replyTo: sender.replyTo,
        subject: `Invoice ${invoice.invoiceNumber} from ${company.name}`,
        html: `<p>${body}</p>`,
        text: body,
        attachments: [
          {
            filename: `${invoice.invoiceNumber}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf',
          },
        ],
      });
      if (!result.delivered) {
        return {
          sent: false,
          warning: result.skippedReason ?? 'Email delivery was skipped.',
        };
      }
      return { sent: true, warning: null };
    } catch (err) {
      return {
        sent: false,
        warning: err instanceof Error ? err.message : 'Email delivery failed.',
      };
    }
  }
}
