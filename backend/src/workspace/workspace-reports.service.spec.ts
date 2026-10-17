import { WorkspaceReportsService } from './workspace-reports.service';

describe('WorkspaceReportsService', () => {
  const service = new WorkspaceReportsService({} as never);

  it('calculates net sales, COGS, and gross profit from POS audit metadata', () => {
    const rows = [
      {
        id: '1',
        entityId: 'POS-1',
        action: 'pos.sale_paid',
        createdAt: new Date('2026-06-15T12:00:00Z'),
        metadata: {
          grossTotal: 100,
          discountTotal: 10,
          cogsTotal: 40,
          customerName: 'Walk-in',
          lines: [{ name: 'Widget', qty: 2, unitPrice: 50, unitCost: 20, discount: 10 }],
        },
      },
    ] as never;

    const summary = service.summarizePosSales(rows, 5);
    expect(summary.grossSales).toBe(100);
    expect(summary.discounts).toBe(10);
    expect(summary.netSales).toBe(90);
    expect(summary.cogs).toBe(40);
    expect(summary.grossProfit).toBe(50);
    expect(summary.netProfit).toBe(45);
  });

  it('adds issued invoice totals, payments, and cost onto the sales summary', () => {
    const base = service.summarizePosSales([], 0);
    const merged = service.mergeIssuedInvoices(base, [
      {
        id: 'inv1',
        invoiceNumber: 'INV-1',
        customerName: 'Buyer',
        status: 'PAID',
        issueDate: new Date('2026-10-17T00:00:00.000Z'),
        subtotal: 100,
        discount: 0,
        taxAmount: 15,
        total: 115,
        amountPaid: 115,
        balanceDue: 0,
        paymentMethod: 'CASH',
        items: [
          {
            itemName: 'Widget',
            quantity: 1,
            unitPrice: 100,
            discount: 0,
            lineSubtotal: 100,
            product: { costPrice: 40 },
          },
        ],
      },
    ]);
    expect(merged.netSales).toBe(115);
    expect(merged.paidTotal).toBe(115);
    expect(merged.dueTotal).toBe(0);
    expect(merged.cogs).toBe(40);
    expect(merged.invoices[0]?.id).toBe('INV-1');
    expect(merged.productSales[0]).toMatchObject({ name: 'Widget', qty: 1, cogs: 40 });
  });
});
