import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { ReportsQueryDto } from './dto/reports-query.dto';
import { resolveReportPeriod, type ResolvedReportPeriod } from './report-date-range.util';

export type PosSaleLineMeta = {
  name: string;
  qty: number;
  unitPrice: number;
  unitCost?: number;
  discount?: number;
  inventoryId?: string;
  warehouseId?: string;
  batchAllocations?: Array<{
    batchId: string;
    qty: number;
    mfgDate: string;
    expiryDate: string;
    unitCost: number;
  }>;
};

export type PosSaleAuditMeta = {
  total?: number;
  grossTotal?: number;
  discountTotal?: number;
  taxTotal?: number;
  cogsTotal?: number;
  returnsTotal?: number;
  lineCount?: number;
  inventoryRowsTouched?: number;
  customerName?: string;
  warehouseId?: string;
  status?: 'paid' | 'due' | 'voided' | 'cancelled';
  lines?: PosSaleLineMeta[];
};

export type SalesReportTotals = {
  grossSales: number;
  discounts: number;
  returns: number;
  netSales: number;
  cogs: number;
  grossProfit: number;
  expenses: number;
  netProfit: number;
  taxTotal: number;
  ticketCount: number;
};

@Injectable()
export class WorkspaceReportsService {
  constructor(private readonly prisma: PrismaService) {}

  parsePosMeta(metadata: unknown): PosSaleAuditMeta {
    if (!metadata || typeof metadata !== 'object') return {};
    return metadata as PosSaleAuditMeta;
  }

  resolvePeriod(timezone: string, query?: ReportsQueryDto): ResolvedReportPeriod {
    try {
      return resolveReportPeriod({
        preset: query?.preset,
        startDate: query?.startDate,
        endDate: query?.endDate,
        timeZone: timezone,
      });
    } catch (err) {
      throw new BadRequestException(err instanceof Error ? err.message : 'Invalid report period.');
    }
  }

  async issuedInvoicesInPeriod(
    tenantId: string,
    period: ResolvedReportPeriod,
    warehouseId?: string,
  ) {
    return this.prisma.client.salesInvoice.findMany({
      where: {
        tenantId,
        status: { in: ['UNPAID', 'PARTIALLY_PAID', 'PAID', 'OVERDUE'] },
        issueDate: {
          gte: new Date(`${period.startDate}T00:00:00.000Z`),
          lte: new Date(`${period.endDate}T00:00:00.000Z`),
        },
        ...(warehouseId ? { warehouseId } : {}),
      },
      include: {
        items: { include: { product: true, variant: true } },
      },
      orderBy: { issueDate: 'desc' },
    });
  }

  async posSalesInPeriod(tenantId: string, period: ResolvedReportPeriod, warehouseId?: string) {
    const rows = await this.prisma.client.auditLog.findMany({
      where: {
        tenantId,
        action: { in: ['pos.sale_paid', 'pos.sale_due', 'pos.sale_return'] },
        createdAt: { gte: period.start, lte: period.end },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!warehouseId) return rows;

    return rows.filter((row) => {
      const meta = this.parsePosMeta(row.metadata);
      if (meta.warehouseId === warehouseId) return true;
      return meta.lines?.some((l) => l.warehouseId === warehouseId) ?? false;
    });
  }

  summarizePosSales(
    rows: Awaited<ReturnType<WorkspaceReportsService['posSalesInPeriod']>>,
    expenses = 0,
  ): SalesReportTotals & {
    paidTotal: number;
    dueTotal: number;
    invoices: Array<{
      id: string;
      customer: string;
      amount: number;
      status: 'paid' | 'due' | 'return';
      date: string;
      at: string;
      lineCount: number;
      grossAmount: number;
      discount: number;
      cogs: number;
    }>;
    productSales: Array<{ name: string; qty: number; revenue: number; cogs: number }>;
    customerSales: Array<{ customer: string; revenue: number }>;
    paymentMethods: Array<{ method: string; amount: number }>;
    dailyTrend: Array<{ period: string; revenue: number; netSales: number }>;
  } {
    let grossSales = 0;
    let discounts = 0;
    let returns = 0;
    let cogs = 0;
    let taxTotal = 0;
    let paidTotal = 0;
    let dueTotal = 0;

    const productMap = new Map<string, { qty: number; revenue: number; cogs: number }>();
    const customerMap = new Map<string, number>();
    const dailyMap = new Map<string, { revenue: number; netSales: number }>();

    const invoices = rows
      .filter((row) => {
        const meta = this.parsePosMeta(row.metadata);
        return meta.status !== 'voided' && meta.status !== 'cancelled';
      })
      .map((row) => {
        const meta = this.parsePosMeta(row.metadata);
        const isReturn = row.action === 'pos.sale_return';
        const lines = meta.lines ?? [];

        let lineGross = 0;
        let lineDiscount = 0;
        let lineCogs = 0;

        for (const line of lines) {
          const gross = line.qty * line.unitPrice;
          const disc = line.discount ?? 0;
          const cost = (line.unitCost ?? 0) * line.qty;
          lineGross += gross;
          lineDiscount += disc;
          lineCogs += cost;

          const key = line.name;
          const cur = productMap.get(key) ?? { qty: 0, revenue: 0, cogs: 0 };
          cur.qty += line.qty;
          cur.revenue += gross - disc;
          cur.cogs += cost;
          productMap.set(key, cur);
        }

        const ticketGross = meta.grossTotal ?? lineGross ?? Number(meta.total ?? 0);
        const ticketDiscount = meta.discountTotal ?? lineDiscount;
        const ticketCogs = meta.cogsTotal ?? lineCogs;
        const ticketTax = meta.taxTotal ?? 0;
        const netTicket = isReturn ? -(ticketGross - ticketDiscount) : ticketGross - ticketDiscount;

        if (isReturn) {
          returns += ticketGross - ticketDiscount;
        } else {
          grossSales += ticketGross;
          discounts += ticketDiscount;
          cogs += ticketCogs;
          taxTotal += ticketTax;
        }

        const paid = row.action === 'pos.sale_paid';
        if (paid && !isReturn) paidTotal += netTicket;
        else if (!isReturn) dueTotal += netTicket;

        const customer = meta.customerName ?? 'Walk-in';
        customerMap.set(customer, (customerMap.get(customer) ?? 0) + netTicket);

        const day = row.createdAt.toISOString().slice(0, 10);
        const dayCur = dailyMap.get(day) ?? { revenue: 0, netSales: 0 };
        dayCur.revenue += ticketGross;
        dayCur.netSales += netTicket;
        dailyMap.set(day, dayCur);

        return {
          id: row.entityId ?? row.id,
          customer,
          amount: Math.round(netTicket * 100) / 100,
          status: isReturn ? ('return' as const) : paid ? ('paid' as const) : ('due' as const),
          date: day,
          at: row.createdAt.toISOString(),
          lineCount: meta.lineCount ?? lines.length,
          grossAmount: Math.round(ticketGross * 100) / 100,
          discount: Math.round(ticketDiscount * 100) / 100,
          cogs: Math.round(ticketCogs * 100) / 100,
        };
      });

    const netSales = Math.round((grossSales - discounts - returns) * 100) / 100;
    const grossProfit = Math.round((netSales - cogs) * 100) / 100;
    const netProfit = Math.round((grossProfit - expenses) * 100) / 100;

    return this.packSalesSummary({
      grossSales,
      discounts,
      returns,
      netSales,
      cogs,
      grossProfit,
      expenses,
      netProfit,
      taxTotal,
      ticketCount: invoices.length,
      paidTotal,
      dueTotal,
      invoices,
      productMap,
      customerMap,
      dailyMap,
    });
  }

  /**
   * Adds issued sales invoices (not drafts, voids, or cancellations) onto a POS summary.
   * Invoice totals are the recorded sale; payments and balances come from the invoice row.
   */
  mergeIssuedInvoices(
    summary: ReturnType<WorkspaceReportsService['summarizePosSales']>,
    invoices: Array<{
      id: string;
      invoiceNumber: string;
      customerName: string;
      status: string;
      issueDate: Date;
      subtotal: unknown;
      discount: unknown;
      taxAmount: unknown;
      total: unknown;
      amountPaid: unknown;
      balanceDue: unknown;
      paymentMethod?: string | null;
      items: Array<{
        itemName: string;
        quantity: unknown;
        unitPrice: unknown;
        discount: unknown;
        lineSubtotal: unknown;
        product?: { costPrice: unknown } | null;
        variant?: { costPrice: unknown } | null;
      }>;
    }>,
  ): ReturnType<WorkspaceReportsService['summarizePosSales']> {
    let grossSales = summary.grossSales;
    let discounts = summary.discounts;
    let cogs = summary.cogs;
    let taxTotal = summary.taxTotal;
    let paidTotal = summary.paidTotal;
    let dueTotal = summary.dueTotal;
    const productMap = new Map(summary.productSales.map((row) => [row.name, { ...row }]));
    const customerMap = new Map(summary.customerSales.map((row) => [row.customer, row.revenue]));
    const dailyMap = new Map(
      summary.dailyTrend.map((row) => [
        row.period,
        { revenue: row.revenue, netSales: row.netSales },
      ]),
    );
    const paymentMap = new Map(summary.paymentMethods.map((row) => [row.method, row.amount]));
    const mergedInvoices = [...summary.invoices];

    for (const invoice of invoices) {
      const subtotal = Number(invoice.subtotal);
      const headerDiscount = Number(invoice.discount);
      const lineDiscount = invoice.items.reduce((sum, item) => sum + Number(item.discount), 0);
      const tax = Number(invoice.taxAmount);
      const total = Number(invoice.total);
      const paid = Number(invoice.amountPaid);
      const due = Number(invoice.balanceDue);
      let ticketCogs = 0;

      for (const item of invoice.items) {
        const qty = Number(item.quantity);
        const costPrice = item.variant
          ? Number(item.variant.costPrice)
          : Number(item.product?.costPrice ?? 0);
        const cost = costPrice * qty;
        ticketCogs += cost;
        const current = productMap.get(item.itemName) ?? {
          name: item.itemName,
          qty: 0,
          revenue: 0,
          cogs: 0,
        };
        current.qty += qty;
        current.revenue += Number(item.lineSubtotal);
        current.cogs += cost;
        productMap.set(item.itemName, current);
      }

      grossSales += subtotal + headerDiscount + lineDiscount;
      discounts += headerDiscount + lineDiscount;
      cogs += ticketCogs;
      taxTotal += tax;
      paidTotal += paid;
      dueTotal += due;

      const customer = invoice.customerName || 'Customer';
      customerMap.set(customer, (customerMap.get(customer) ?? 0) + total);
      const day = invoice.issueDate.toISOString().slice(0, 10);
      const dayCur = dailyMap.get(day) ?? { revenue: 0, netSales: 0 };
      dayCur.revenue += total;
      dayCur.netSales += total;
      dailyMap.set(day, dayCur);

      const method = invoice.paymentMethod?.replace(/_/g, ' ') || 'Invoice';
      paymentMap.set(method, (paymentMap.get(method) ?? 0) + paid);

      const paidStatus = invoice.status === 'PAID';
      mergedInvoices.push({
        id: invoice.invoiceNumber || invoice.id,
        customer,
        amount: Math.round(total * 100) / 100,
        status: paidStatus ? 'paid' : due > 0 ? 'due' : 'paid',
        date: day,
        at: invoice.issueDate.toISOString(),
        lineCount: invoice.items.length,
        grossAmount: Math.round((subtotal + headerDiscount + lineDiscount) * 100) / 100,
        discount: Math.round((headerDiscount + lineDiscount) * 100) / 100,
        cogs: Math.round(ticketCogs * 100) / 100,
      });
    }

    const invoiceGrandTotal = invoices.reduce((sum, invoice) => sum + Number(invoice.total), 0);
    const invoiceExTax = invoices.reduce((sum, invoice) => sum + Number(invoice.subtotal), 0);
    const netSales =
      Math.round(
        (grossSales - discounts - summary.returns + (invoiceGrandTotal - invoiceExTax)) * 100,
      ) / 100;
    const grossProfit = Math.round((netSales - cogs) * 100) / 100;
    const netProfit = Math.round((grossProfit - summary.expenses) * 100) / 100;

    return {
      grossSales: Math.round(grossSales * 100) / 100,
      discounts: Math.round(discounts * 100) / 100,
      returns: summary.returns,
      netSales,
      cogs: Math.round(cogs * 100) / 100,
      grossProfit,
      expenses: summary.expenses,
      netProfit,
      taxTotal: Math.round(taxTotal * 100) / 100,
      ticketCount: mergedInvoices.length,
      paidTotal: Math.round(paidTotal * 100) / 100,
      dueTotal: Math.round(dueTotal * 100) / 100,
      invoices: mergedInvoices,
      productSales: [...productMap.values()].map((row) => ({
        name: row.name,
        qty: row.qty,
        revenue: Math.round(row.revenue * 100) / 100,
        cogs: Math.round(row.cogs * 100) / 100,
      })),
      customerSales: [...customerMap.entries()].map(([customer, revenue]) => ({
        customer,
        revenue: Math.round(revenue * 100) / 100,
      })),
      paymentMethods: [...paymentMap.entries()]
        .map(([method, amount]) => ({ method, amount: Math.round(amount * 100) / 100 }))
        .filter((row) => row.amount > 0),
      dailyTrend: [...dailyMap.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([period, value]) => ({
          period,
          revenue: Math.round(value.revenue * 100) / 100,
          netSales: Math.round(value.netSales * 100) / 100,
        })),
    };
  }

  private packSalesSummary(input: {
    grossSales: number;
    discounts: number;
    returns: number;
    netSales: number;
    cogs: number;
    grossProfit: number;
    expenses: number;
    netProfit: number;
    taxTotal: number;
    ticketCount: number;
    paidTotal: number;
    dueTotal: number;
    invoices: ReturnType<WorkspaceReportsService['summarizePosSales']>['invoices'];
    productMap: Map<string, { qty: number; revenue: number; cogs: number }>;
    customerMap: Map<string, number>;
    dailyMap: Map<string, { revenue: number; netSales: number }>;
  }) {
    const round = (value: number) => Math.round(value * 100) / 100;
    return {
      grossSales: round(input.grossSales),
      discounts: round(input.discounts),
      returns: round(input.returns),
      netSales: input.netSales,
      cogs: round(input.cogs),
      grossProfit: input.grossProfit,
      expenses: round(input.expenses),
      netProfit: input.netProfit,
      taxTotal: round(input.taxTotal),
      ticketCount: input.ticketCount,
      paidTotal: round(input.paidTotal),
      dueTotal: round(input.dueTotal),
      invoices: input.invoices,
      productSales: [...input.productMap.entries()].map(([name, value]) => ({
        name,
        qty: value.qty,
        revenue: round(value.revenue),
        cogs: round(value.cogs),
      })),
      customerSales: [...input.customerMap.entries()].map(([customer, revenue]) => ({
        customer,
        revenue: round(revenue),
      })),
      paymentMethods: [
        { method: 'Cash / Paid', amount: round(input.paidTotal) },
        { method: 'Due / Credit', amount: round(input.dueTotal) },
      ].filter((row) => row.amount > 0),
      dailyTrend: [...input.dailyMap.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([period, value]) => ({
          period,
          revenue: round(value.revenue),
          netSales: round(value.netSales),
        })),
    };
  }

  buildExportPayload(input: {
    companyName: string;
    reportName: string;
    period: ResolvedReportPeriod;
    currency: string;
    branchName?: string;
    totals: SalesReportTotals;
    rows: Array<Record<string, string | number>>;
    filters: Record<string, string>;
  }) {
    return {
      header: {
        companyName: input.companyName,
        reportName: input.reportName,
        periodLabel: input.period.label,
        startDate: input.period.startDate,
        endDate: input.period.endDate,
        generatedAt: new Date().toISOString(),
        branch: input.branchName,
        currency: input.currency,
        filters: input.filters,
      },
      totals: input.totals,
      rows: input.rows,
    };
  }
}
