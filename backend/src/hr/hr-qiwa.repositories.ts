import { Injectable } from '@nestjs/common';
import { Prisma, QiwaContractStatus } from '@velon/database';
import { TenantScopedRepository } from '../common/repositories/tenant-scoped.repository';
import { PrismaService } from '../prisma/prisma.service';
import { OPEN_QIWA_CONTRACT_STATUSES } from './hr-qiwa.rules';

const contractListInclude = {
  employee: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      employeeCode: true,
      status: true,
      baseSalary: true,
      currency: true,
      hireDate: true,
      workLocation: true,
      identityType: true,
      nationalId: true,
      nationality: true,
    },
  },
  establishment: {
    select: {
      id: true,
      nameEn: true,
      nameAr: true,
      status: true,
      laborOfficeId: true,
      sequenceNumber: true,
      commercialRegistrationNumber: true,
      unifiedNumber: true,
    },
  },
} satisfies Prisma.HrQiwaContractInclude;

const contractDetailInclude = {
  ...contractListInclude,
  events: {
    orderBy: { createdAt: 'asc' as const },
    include: { actor: { select: { id: true, name: true, email: true } } },
  },
} satisfies Prisma.HrQiwaContractInclude;

export type QiwaContractListRow = Prisma.HrQiwaContractGetPayload<{
  include: typeof contractListInclude;
}>;
export type QiwaContractDetailRow = Prisma.HrQiwaContractGetPayload<{
  include: typeof contractDetailInclude;
}>;

@Injectable()
export class HrQiwaEstablishmentRepository extends TenantScopedRepository {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  findPrimary() {
    return this.prisma.client.hrQiwaEstablishment.findFirst({
      where: this.where({ isPrimary: true }),
      orderBy: { createdAt: 'asc' },
    });
  }

  create(data: Omit<Prisma.HrQiwaEstablishmentUncheckedCreateInput, 'tenantId'>) {
    return this.prisma.client.hrQiwaEstablishment.create({
      data: { ...data, tenantId: this.tenantId },
    });
  }

  update(id: string, data: Prisma.HrQiwaEstablishmentUncheckedUpdateInput) {
    return this.prisma.client.hrQiwaEstablishment.update({ where: { id }, data });
  }
}

@Injectable()
export class HrQiwaContractRepository extends TenantScopedRepository {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  count() {
    return this.prisma.client.hrQiwaContract.count({ where: this.where() });
  }

  findMany(opts: { status?: QiwaContractStatus; employeeId?: string }) {
    return this.prisma.client.hrQiwaContract.findMany({
      where: this.where({
        ...(opts.status ? { status: opts.status } : {}),
        ...(opts.employeeId ? { employeeId: opts.employeeId } : {}),
      }),
      include: contractListInclude,
      orderBy: { updatedAt: 'desc' },
    });
  }

  findById(id: string) {
    return this.prisma.client.hrQiwaContract.findFirst({
      where: this.where({ id }),
      include: contractDetailInclude,
    });
  }

  findOpenForEmployee(employeeId: string, excludeId?: string) {
    return this.prisma.client.hrQiwaContract.findFirst({
      where: this.where({
        employeeId,
        status: { in: [...OPEN_QIWA_CONTRACT_STATUSES] as QiwaContractStatus[] },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      }),
      select: { id: true, referenceCode: true, status: true },
    });
  }

  create(data: Omit<Prisma.HrQiwaContractUncheckedCreateInput, 'tenantId'>) {
    return this.prisma.client.hrQiwaContract.create({
      data: { ...data, tenantId: this.tenantId },
      include: contractDetailInclude,
    });
  }

  update(id: string, data: Prisma.HrQiwaContractUncheckedUpdateInput) {
    return this.prisma.client.hrQiwaContract.update({
      where: { id },
      data,
      include: contractDetailInclude,
    });
  }

  delete(id: string) {
    return this.prisma.client.hrQiwaContract.delete({ where: { id } });
  }

  addEvent(data: Omit<Prisma.HrQiwaContractEventUncheckedCreateInput, 'tenantId'>) {
    return this.prisma.client.hrQiwaContractEvent.create({
      data: { ...data, tenantId: this.tenantId },
    });
  }
}
