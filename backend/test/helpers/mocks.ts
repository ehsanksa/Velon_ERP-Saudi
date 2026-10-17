import type { AuditService } from '../../src/audit/audit.service';
import type { VelonLogger } from '../../src/common/logger.service';
import type { PrismaService } from '../../src/prisma/prisma.service';
import type { RedisService } from '../../src/redis/redis.service';

type MockModel = {
  findUnique: jest.Mock;
  findUniqueOrThrow: jest.Mock;
  findFirst: jest.Mock;
  findMany: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
  updateMany: jest.Mock;
  upsert: jest.Mock;
  delete: jest.Mock;
  deleteMany: jest.Mock;
  count: jest.Mock;
};

function model(): MockModel {
  return {
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    upsert: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    count: jest.fn().mockResolvedValue(0),
  };
}

/** Deep partial mock of Prisma client models used by services. */
export function createMockPrismaClient(overrides: Record<string, unknown> = {}) {
  const client: Record<string, unknown> = {
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    user: model(),
    refreshToken: model(),
    tenant: model(),
    tenantMembership: model(),
    tenantInvitation: model(),
    workspace: model(),
    auditLog: model(),
    crmQuotation: model(),
    salesOrder: model(),
    purchaseRequest: model(),
    purchaseOrder: model(),
    supplier: model(),
    inventoryProduct: model(),
    inventoryStock: model(),
    siteContentBlock: model(),
    subscription: model(),
    ...overrides,
  };

  client.$transaction = jest.fn(async (arg: unknown) => {
    if (typeof arg === 'function') {
      return (arg as (tx: unknown) => Promise<unknown>)(client);
    }
    if (Array.isArray(arg)) {
      return Promise.all(arg);
    }
    return arg;
  });

  return client as MockPrismaClient;
}

export type MockPrismaClient = {
  $connect: jest.Mock;
  $disconnect: jest.Mock;
  $queryRaw: jest.Mock;
  $transaction: jest.Mock;
  user: MockModel;
  refreshToken: MockModel;
  tenant: MockModel;
  tenantMembership: MockModel;
  tenantInvitation: MockModel;
  workspace: MockModel;
  auditLog: MockModel;
  crmQuotation: MockModel;
  salesOrder: MockModel;
  purchaseRequest: MockModel;
  purchaseOrder: MockModel;
  supplier: MockModel;
  inventoryProduct: MockModel;
  inventoryStock: MockModel;
  siteContentBlock: MockModel;
  subscription: MockModel;
  [key: string]: unknown;
};

export function createMockPrisma(client?: MockPrismaClient): PrismaService {
  return { client: client ?? createMockPrismaClient() } as unknown as PrismaService;
}

export function createMockAudit(): {
  log: jest.Mock;
  logLogin: jest.Mock;
  logLogout: jest.Mock;
  listRecent: jest.Mock;
} {
  return {
    log: jest.fn().mockResolvedValue({ id: 'audit-1' }),
    logLogin: jest.fn().mockResolvedValue({ id: 'audit-1' }),
    logLogout: jest.fn().mockResolvedValue({ id: 'audit-1' }),
    listRecent: jest.fn().mockResolvedValue([]),
  };
}

export function createMockRedis(): {
  getRevision: jest.Mock;
  bumpRevision: jest.Mock;
  publish: jest.Mock;
  client: { ping: jest.Mock };
} {
  return {
    getRevision: jest.fn().mockResolvedValue(1),
    bumpRevision: jest.fn().mockResolvedValue(2),
    publish: jest.fn().mockResolvedValue(undefined),
    client: { ping: jest.fn().mockResolvedValue('PONG') },
  };
}

export function createMockLogger(): VelonLogger {
  return {
    auth: jest.fn(),
    authFailure: jest.fn(),
    dbFailure: jest.fn(),
    apiFailure: jest.fn(),
  } as unknown as VelonLogger;
}

/** Generic repository mock with common CRUD methods. */
export function createRepoMock(
  methods: string[] = [
    'findMany',
    'findById',
    'findByIdAny',
    'create',
    'update',
    'delete',
    'count',
  ],
): Record<string, jest.Mock> {
  const repo: Record<string, jest.Mock> = {};
  for (const method of methods) {
    repo[method] = jest.fn();
  }
  return repo;
}
