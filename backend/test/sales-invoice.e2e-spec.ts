import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { cleanupTenantUser, disconnectTestDb, seedTenantUser } from './helpers/tenant-seed';

const hasDatabase = Boolean(process.env.DATABASE_URL);
const describeIfDb = hasDatabase ? describe : describe.skip;

describeIfDb('Sales invoice workflow', () => {
  let app: INestApplication;
  let tokenA = '';
  let tokenB = '';
  let tenantAId = '';
  let customerAId = '';
  let warehouseAId = '';
  let productAId = '';
  let invoiceAId = '';
  let ownerPassword = '';
  const emailA = `sales-inv-a-${Date.now()}@sales.test`;
  const emailB = `sales-inv-b-${Date.now()}@sales.test`;

  beforeAll(async () => {
    if (!process.env.REDIS_URL) process.env.REDIS_URL = 'redis://127.0.0.1:6379';

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
    );
    await app.init();

    const seededA = await seedTenantUser({ email: emailA, companyName: 'Invoice Corp A' });
    tenantAId = seededA.tenant.id;
    ownerPassword = seededA.password;
    await seedTenantUser({ email: emailB, companyName: 'Invoice Corp B' });

    const loginA = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: emailA, password: ownerPassword });
    tokenA = (loginA.body.data ?? loginA.body).accessToken;

    const loginB = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: emailB, password: ownerPassword });
    tokenB = (loginB.body.data ?? loginB.body).accessToken;
  });

  afterAll(async () => {
    await cleanupTenantUser(emailA);
    await cleanupTenantUser(emailB);
    await app?.close();
    await disconnectTestDb();
  });

  it('creates customer, product, warehouse, and draft invoice', async () => {
    const cust = await request(app.getHttpServer())
      .post('/api/v1/crm/customers')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        companyName: 'Buyer Inc',
        email: 'buyer@test.com',
        status: 'ACTIVE',
        taxId: '399999999900003',
      });
    customerAId = (cust.body.data ?? cust.body).id;

    const warehouse = await request(app.getHttpServer())
      .post('/api/v1/inventory/warehouses')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ code: 'WH1', name: 'Main Warehouse' });
    warehouseAId = (warehouse.body.data ?? warehouse.body).id;

    const product = await request(app.getHttpServer())
      .post('/api/v1/inventory/products')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ sku: 'SKU-INV-1', name: 'Widget', unitPrice: 100, costPrice: 40 });
    productAId = (product.body.data ?? product.body).id;

    await request(app.getHttpServer())
      .post('/api/v1/inventory/stock/adjust')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ productId: productAId, warehouseId: warehouseAId, delta: 20 });

    const draft = await request(app.getHttpServer())
      .post('/api/v1/sales/invoices')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        customerId: customerAId,
        warehouseId: warehouseAId,
        action: 'draft',
        lines: [
          {
            lineType: 'PRODUCT',
            productId: productAId,
            itemName: 'Widget',
            quantity: 2,
            unitPrice: 100,
            discount: 10,
            taxRate: 18,
          },
        ],
      });
    expect([200, 201]).toContain(draft.status);
    const body = draft.body.data ?? draft.body;
    invoiceAId = body.id;
    expect(body.tenantId).toBe(tenantAId);
    expect(body.status).toBe('DRAFT');
    expect(Number(body.total)).toBeGreaterThan(0);
  });

  it('prevents cross-tenant invoice access', async () => {
    const getOne = await request(app.getHttpServer())
      .get(`/api/v1/sales/invoices/${invoiceAId}`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(getOne.status).toBe(404);
  });

  it('finalizes invoice with stock deduction and payment status', async () => {
    const saved = await request(app.getHttpServer())
      .post('/api/v1/sales/invoices')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        customerId: customerAId,
        warehouseId: warehouseAId,
        action: 'save_paid',
        idempotencyKey: `paid-${Date.now()}`,
        lines: [
          {
            lineType: 'PRODUCT',
            productId: productAId,
            itemName: 'Widget',
            quantity: 1,
            unitPrice: 100,
            discount: 0,
            taxRate: 10,
          },
        ],
      });
    expect([200, 201]).toContain(saved.status);
    const body = saved.body.data ?? saved.body;
    expect(body.status).toBe('PAID');
    expect(Number(body.amountPaid)).toBe(Number(body.total));

    const stock = await request(app.getHttpServer())
      .get('/api/v1/inventory/stock')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(stock.status).toBe(200);
    const rows = stock.body.data ?? stock.body;
    const widget = (rows as Array<{ sku: string; quantity: number }>).find(
      (row) => row.sku === 'SKU-INV-1',
    );
    expect(widget?.quantity).toBe(19);
  });

  it('returns PDF for saved invoice', async () => {
    const pdf = await request(app.getHttpServer())
      .get(`/api/v1/sales/invoices/${invoiceAId}/pdf`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(pdf.status).toBe(200);
    expect(pdf.headers['content-type']).toContain('application/pdf');
    const raw = Buffer.isBuffer(pdf.body) ? pdf.body.toString('utf8') : String(pdf.body);
    expect(raw.startsWith('%PDF')).toBe(true);
  });

  it('rejects duplicate idempotency key reuse with same result', async () => {
    const key = `dup-${Date.now()}`;
    const first = await request(app.getHttpServer())
      .post('/api/v1/sales/invoices')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        customerId: customerAId,
        warehouseId: warehouseAId,
        action: 'draft',
        idempotencyKey: key,
        lines: [{ itemName: 'Custom line', quantity: 1, unitPrice: 50, lineType: 'CUSTOM' }],
      });
    const second = await request(app.getHttpServer())
      .post('/api/v1/sales/invoices')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        customerId: customerAId,
        warehouseId: warehouseAId,
        action: 'draft',
        idempotencyKey: key,
        lines: [{ itemName: 'Custom line', quantity: 1, unitPrice: 50, lineType: 'CUSTOM' }],
      });
    const firstBody = first.body.data ?? first.body;
    const secondBody = second.body.data ?? second.body;
    expect(firstBody.id).toBe(secondBody.id);
  });
});
