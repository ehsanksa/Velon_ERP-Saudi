import { ForbiddenException } from '@nestjs/common';
import { InventoryItemType, InventoryProductStatus, InventoryUom } from '@velon/database';
import { IDS, META, tenantOwner, tenantUser } from '../../test/helpers/fixtures';
import { createMockAudit, createRepoMock } from '../../test/helpers/mocks';
import { InventoryImportService } from './inventory-import.service';

describe('InventoryImportService', () => {
  const categories = createRepoMock(['findMany', 'create']);
  const products = createRepoMock(['findBySkus', 'create', 'update', 'count']);
  const warehouses = createRepoMock(['findMany', 'create']);
  const stock = createRepoMock(['findByProductWarehouse', 'create']);
  const audit = createMockAudit();

  let service: InventoryImportService;

  beforeEach(() => {
    jest.clearAllMocks();
    categories.findMany.mockResolvedValue([{ id: 'cat-1', name: 'General' }]);
    warehouses.findMany.mockResolvedValue([{ id: IDS.warehouse, name: 'Main' }]);
    products.findBySkus.mockResolvedValue([]);
    products.count.mockResolvedValue(0);
    products.create.mockImplementation(async (data: Record<string, unknown>) => ({
      id: 'prod-new',
      ...data,
    }));
    stock.findByProductWarehouse.mockResolvedValue(null);
    service = new InventoryImportService(
      categories as never,
      products as never,
      warehouses as never,
      stock as never,
      audit as never,
    );
  });

  it('forbids users without inventory write access', async () => {
    await expect(service.validate(tenantUser(), [{ name: 'Widget' }])).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('returns a UTF-8 BOM template with product and service samples', () => {
    const tpl = service.getTemplate();
    expect(tpl.csv.startsWith('\uFEFF')).toBe(true);
    expect(tpl.columns).toContain('itemType');
    expect(tpl.sampleRows.some((r) => r.itemType === 'SERVICE')).toBe(true);
  });

  it('validates product and service rows (dry-run)', async () => {
    const preview = await service.validate(tenantOwner(), [
      {
        sku: 'SKU-1',
        name: 'Widget',
        itemType: 'PRODUCT',
        category: 'General',
        uom: 'EACH',
        unitPrice: '10',
        warehouse: 'Main',
        quantity: '5',
      },
      {
        sku: 'SVC-1',
        name: 'Support',
        itemType: 'SERVICE',
        category: 'General',
        unitPrice: '100',
        warehouse: 'Main',
        quantity: '2',
      },
    ]);

    expect(preview.errorCount).toBe(0);
    expect(preview.createCount).toBe(2);
    expect(preview.rows[1].itemType).toBe(InventoryItemType.SERVICE);
    expect(preview.rows[1].quantity).toBe(0);
    expect(preview.warningCount).toBeGreaterThan(0);
  });

  it('rejects unknown categories unless createMissingCategories is on', async () => {
    const preview = await service.validate(tenantOwner(), [
      { name: 'Widget', category: 'Unknown' },
    ]);
    expect(preview.errorCount).toBe(1);
    expect(preview.issues[0].field).toBe('category');
  });

  it('rejects duplicate SKUs unless updateExisting is enabled', async () => {
    products.findBySkus.mockResolvedValue([
      { id: 'existing', sku: 'SKU-1', name: 'Old', status: 'ACTIVE', itemType: 'PRODUCT' },
    ]);
    const blocked = await service.validate(tenantOwner(), [{ sku: 'SKU-1', name: 'New name' }]);
    expect(blocked.errorCount).toBe(1);

    const allowed = await service.validate(tenantOwner(), [{ sku: 'SKU-1', name: 'New name' }], {
      updateExisting: true,
    });
    expect(allowed.errorCount).toBe(0);
    expect(allowed.updateCount).toBe(1);
  });

  it('executes import and stages items as inactive when requested', async () => {
    const result = await service.execute(
      tenantOwner(),
      [
        {
          sku: 'SKU-NEW',
          name: 'Imported Widget',
          itemType: 'PRODUCT',
          category: 'General',
          unitPrice: '12.5',
          warehouse: 'Main',
          quantity: '3',
        },
      ],
      { stageForApproval: true },
      META,
    );

    expect(result.created).toBe(1);
    expect(products.create).toHaveBeenCalledWith(
      expect.objectContaining({
        sku: 'SKU-NEW',
        name: 'Imported Widget',
        itemType: InventoryItemType.PRODUCT,
        status: InventoryProductStatus.INACTIVE,
        unitPrice: 12.5,
        uom: InventoryUom.EACH,
      }),
    );
    expect(stock.create).toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'inventory.products_imported' }),
    );
  });

  it('does not create stock for services', async () => {
    const result = await service.execute(tenantOwner(), [
      {
        sku: 'SVC-NEW',
        name: 'Consulting',
        itemType: 'SERVICE',
        category: 'General',
        unitPrice: '500',
        warehouse: 'Main',
        quantity: '9',
      },
    ]);

    expect(result.created).toBe(1);
    expect(products.create).toHaveBeenCalledWith(
      expect.objectContaining({
        itemType: InventoryItemType.SERVICE,
        batchTracked: false,
      }),
    );
    expect(stock.create).not.toHaveBeenCalled();
  });
});
