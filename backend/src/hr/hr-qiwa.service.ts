import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  HrEmploymentStatus,
  Prisma,
  QiwaContractEventType,
  QiwaContractStatus,
  QiwaContractType,
  QiwaEstablishmentStatus,
  QiwaIdentityType,
  QiwaNitaqatBand,
  QiwaWageBasis,
} from '@velon/database';
import { normalizeVelonRole, VelonRole } from '@velon/shared';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import type {
  CreateHrQiwaContractDto,
  HrQiwaEmployeeResponseDto,
  HrQiwaExecutionNumberDto,
  HrQiwaTerminateDto,
  RecordHrQiwaNitaqatDto,
  UpdateHrQiwaContractDto,
  UpsertHrQiwaEstablishmentDto,
} from './dto/hr-qiwa.dto';
import {
  HrQiwaContractRepository,
  HrQiwaEstablishmentRepository,
  type QiwaContractDetailRow,
} from './hr-qiwa.repositories';
import {
  assessEstablishmentFile,
  assessQiwaContract,
  buildQiwaSubmissionPackage,
  DOCUMENTED_QIWA_CONTRACT_STATUSES,
  QIWA_AUTHENTICATION_STEPS,
  QIWA_LINKS,
  qiwaFindingsBlock,
  qiwaTotalWage,
  saudizationPercent,
  type QiwaContractTerms,
  type QiwaEstablishmentCheck,
  type QiwaFinding,
} from './hr-qiwa.rules';
import { HrEmployeeRepository } from './hr.repositories';

const EDITABLE: QiwaContractStatus[] = [
  QiwaContractStatus.DRAFT,
  QiwaContractStatus.READY,
  QiwaContractStatus.REJECTED,
  QiwaContractStatus.AMENDMENT_REQUESTED,
];

const AWAITING_EMPLOYEE: QiwaContractStatus[] = [
  QiwaContractStatus.PENDING_EMPLOYEE,
  QiwaContractStatus.UPDATE_PENDING,
];

function parseDate(value: string): Date {
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
}

function dateOnly(value: Date | null | undefined): string | null {
  if (!value) return null;
  return value.toISOString().slice(0, 10);
}

function money(value: Prisma.Decimal | number | string | null | undefined): number {
  if (value == null) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value);
  return value.toNumber();
}

function blank(value?: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function todayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function addDays(value: Date, days: number): Date {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

@Injectable()
export class HrQiwaService {
  constructor(
    private readonly establishments: HrQiwaEstablishmentRepository,
    private readonly contracts: HrQiwaContractRepository,
    private readonly employees: HrEmployeeRepository,
    private readonly audit: AuditService,
  ) {}

  async overview(user: AuthenticatedUser) {
    this.assertRead(user);
    const [establishment, contracts, employees] = await Promise.all([
      this.establishments.findPrimary(),
      this.contracts.findMany({}),
      this.employees.findMany({}),
    ]);
    const counts = Object.values(QiwaContractStatus).reduce<Record<string, number>>(
      (acc, status) => {
        acc[status] = 0;
        return acc;
      },
      {},
    );
    for (const contract of contracts) counts[contract.status] += 1;

    const documented = new Set<string>(DOCUMENTED_QIWA_CONTRACT_STATUSES);
    const horizon = addDays(todayUtc(), 30);
    const undocumented = employees
      .filter(
        (employee) =>
          (employee.status === HrEmploymentStatus.ACTIVE ||
            employee.status === HrEmploymentStatus.PROBATION) &&
          !contracts.some(
            (contract) => contract.employeeId === employee.id && documented.has(contract.status),
          ),
      )
      .map((employee) => ({
        employeeId: employee.id,
        employeeCode: employee.employeeCode,
        name: `${employee.firstName} ${employee.lastName}`,
      }));

    const awaitingEmployee = contracts
      .filter((contract) => AWAITING_EMPLOYEE.includes(contract.status))
      .map((contract) => ({
        contractId: contract.id,
        referenceCode: contract.referenceCode,
        name: contract.employeeNameEn,
        since: contract.sentToEmployeeAt?.toISOString() ?? contract.updatedAt.toISOString(),
      }));

    const endingSoon = contracts
      .filter(
        (contract) =>
          contract.contractType === QiwaContractType.FIXED_TERM &&
          (contract.status === QiwaContractStatus.DOCUMENTED ||
            contract.status === QiwaContractStatus.ENFORCEABLE) &&
          contract.endDate &&
          contract.endDate >= todayUtc() &&
          contract.endDate <= horizon,
      )
      .map((contract) => ({
        contractId: contract.id,
        referenceCode: contract.referenceCode,
        name: contract.employeeNameEn,
        endDate: dateOnly(contract.endDate),
      }));

    const wageMismatches = contracts
      .filter((contract) => {
        const salary = money(contract.employee.baseSalary);
        if (salary <= 0) return false;
        if (
          contract.status !== QiwaContractStatus.DOCUMENTED &&
          contract.status !== QiwaContractStatus.ENFORCEABLE &&
          contract.status !== QiwaContractStatus.PENDING_EMPLOYEE &&
          contract.status !== QiwaContractStatus.UPDATE_PENDING
        ) {
          return false;
        }
        const total = money(contract.totalWage);
        const basic = money(contract.basicWage);
        return Math.abs(total - salary) > 0.009 && Math.abs(basic - salary) > 0.009;
      })
      .map((contract) => ({
        contractId: contract.id,
        referenceCode: contract.referenceCode,
        name: contract.employeeNameEn,
        contractWage: money(contract.totalWage),
        employeeSalary: money(contract.employee.baseSalary),
      }));

    return {
      guidelines: { steps: QIWA_AUTHENTICATION_STEPS, links: QIWA_LINKS },
      establishment: establishment ? this.presentEstablishment(establishment) : null,
      establishmentFindings: assessEstablishmentFile(
        establishment ? this.establishmentCheck(establishment) : null,
        establishment?.status === QiwaEstablishmentStatus.ACTIVE ? 'authenticate' : 'save',
      ),
      counts,
      compliance: { undocumented, awaitingEmployee, endingSoon, wageMismatches },
      contracts: contracts.map((contract) => this.presentSummary(contract)),
      employees: employees
        .filter(
          (employee) =>
            employee.status !== HrEmploymentStatus.TERMINATED &&
            employee.status !== HrEmploymentStatus.RESIGNED,
        )
        .map((employee) => ({
          id: employee.id,
          employeeCode: employee.employeeCode,
          firstName: employee.firstName,
          lastName: employee.lastName,
          status: employee.status,
          hireDate: dateOnly(employee.hireDate),
          workLocation: employee.workLocation,
          baseSalary: money(employee.baseSalary),
          currency: employee.currency,
          identityType: employee.identityType,
          nationalId: employee.nationalId,
          nationality: employee.nationality,
        })),
    };
  }

  async saveEstablishment(user: AuthenticatedUser, dto: UpsertHrQiwaEstablishmentDto) {
    this.assertWrite(user);
    const existing = await this.establishments.findPrimary();
    const next = {
      status: dto.status ?? existing?.status ?? QiwaEstablishmentStatus.DRAFT,
      nameEn: dto.nameEn.trim(),
      laborOfficeId: blank(dto.laborOfficeId ?? existing?.laborOfficeId),
      sequenceNumber: blank(dto.sequenceNumber ?? existing?.sequenceNumber),
      commercialRegistrationNumber: blank(
        dto.commercialRegistrationNumber ?? existing?.commercialRegistrationNumber,
      ),
      unifiedNumber: blank(dto.unifiedNumber ?? existing?.unifiedNumber),
    };
    const findings = assessEstablishmentFile(next, 'save');
    this.throwIfBlocked(findings);
    const data = {
      nameEn: next.nameEn,
      nameAr: dto.nameAr !== undefined ? blank(dto.nameAr) : existing?.nameAr,
      laborOfficeId: next.laborOfficeId,
      sequenceNumber: next.sequenceNumber,
      commercialRegistrationNumber: next.commercialRegistrationNumber,
      unifiedNumber: next.unifiedNumber,
      economicActivity:
        dto.economicActivity !== undefined
          ? blank(dto.economicActivity)
          : existing?.economicActivity,
      status: next.status,
      notes: dto.notes !== undefined ? blank(dto.notes) : existing?.notes,
      isPrimary: true,
      updatedById: user.id,
    };
    const saved = existing
      ? await this.establishments.update(existing.id, data)
      : await this.establishments.create({ ...data, createdById: user.id });
    await this.audit.log({
      actorId: user.id,
      tenantId: this.tenantId(user),
      action: 'hr.qiwa.establishment.saved',
      entityType: 'hr_qiwa_establishment',
      entityId: saved.id,
      metadata: { status: saved.status },
    });
    return {
      establishment: this.presentEstablishment(saved),
      findings: assessEstablishmentFile(this.establishmentCheck(saved), 'save'),
    };
  }

  async recordNitaqat(user: AuthenticatedUser, dto: RecordHrQiwaNitaqatDto) {
    this.assertWrite(user);
    const existing = await this.establishments.findPrimary();
    if (!existing) {
      throw new BadRequestException('Save the establishment file before recording Nitaqat.');
    }
    const percent =
      dto.saudiCount != null && dto.nonSaudiCount != null
        ? saudizationPercent(dto.saudiCount, dto.nonSaudiCount)
        : (dto.saudizationPercent ?? null);
    const saved = await this.establishments.update(existing.id, {
      nitaqatBand: dto.nitaqatBand,
      saudiCount: dto.saudiCount ?? existing.saudiCount,
      nonSaudiCount: dto.nonSaudiCount ?? existing.nonSaudiCount,
      saudizationPercent: percent,
      nitaqatRecordedAt: new Date(),
      saudizationCertificateExpiresAt: dto.saudizationCertificateExpiresAt
        ? parseDate(dto.saudizationCertificateExpiresAt)
        : existing.saudizationCertificateExpiresAt,
      updatedById: user.id,
    });
    await this.audit.log({
      actorId: user.id,
      tenantId: this.tenantId(user),
      action: 'hr.qiwa.nitaqat.recorded',
      entityType: 'hr_qiwa_establishment',
      entityId: saved.id,
      metadata: { nitaqatBand: saved.nitaqatBand },
    });
    return this.presentEstablishment(saved);
  }

  async listContracts(
    user: AuthenticatedUser,
    query: { status?: QiwaContractStatus; employeeId?: string },
  ) {
    this.assertRead(user);
    const rows = await this.contracts.findMany(query);
    return rows.map((row) => this.presentSummary(row));
  }

  async getContract(user: AuthenticatedUser, id: string) {
    this.assertRead(user);
    return this.reload(id);
  }

  async createContract(user: AuthenticatedUser, dto: CreateHrQiwaContractDto) {
    this.assertWrite(user);
    const employee = await this.employees.findById(dto.employeeId);
    if (!employee) throw new NotFoundException('Employee not found.');
    const establishment = await this.establishments.findPrimary();
    if (!establishment) {
      throw new BadRequestException('Save the Qiwa establishment file before creating a contract.');
    }
    const open = await this.contracts.findOpenForEmployee(employee.id);
    if (open) {
      throw new BadRequestException(
        `This employee already has open Qiwa contract ${open.referenceCode}.`,
      );
    }
    const wages = this.wagesFrom(dto, null);
    const referenceCode = `QC-${String((await this.contracts.count()) + 1).padStart(5, '0')}`;
    const created = await this.contracts.create({
      establishmentId: establishment.id,
      employeeId: employee.id,
      referenceCode,
      status: QiwaContractStatus.DRAFT,
      contractType: dto.contractType,
      identityType: dto.identityType,
      nationalId: dto.nationalId.trim(),
      employeeNameEn: (dto.employeeNameEn ?? `${employee.firstName} ${employee.lastName}`).trim(),
      employeeNameAr: blank(dto.employeeNameAr),
      nationality: dto.nationality.trim(),
      occupationTitle: dto.occupationTitle.trim(),
      jobTitle: blank(dto.jobTitle) ?? dto.occupationTitle.trim(),
      startDate: parseDate(dto.startDate),
      endDate:
        dto.contractType === QiwaContractType.INDEFINITE
          ? null
          : dto.endDate
            ? parseDate(dto.endDate)
            : null,
      probationDays: dto.probationDays ?? 90,
      dailyHours: dto.dailyHours ?? 8,
      weeklyHours: dto.weeklyHours ?? 48,
      workLocation: blank(dto.workLocation) ?? employee.workLocation,
      wageBasis: dto.wageBasis ?? QiwaWageBasis.MONTHLY,
      ...wages,
      currency: 'SAR',
      noticePeriodDays: dto.noticePeriodDays ?? 60,
      additionalTerms: blank(dto.additionalTerms),
      gosiRegistered: dto.gosiRegistered ?? false,
      listedOnQiwa: dto.listedOnQiwa ?? false,
      createdById: user.id,
      updatedById: user.id,
    });
    await this.contracts.addEvent({
      contractId: created.id,
      type: QiwaContractEventType.CREATED,
      toStatus: QiwaContractStatus.DRAFT,
      note: 'Contract prepared in Velon for Qiwa Contract Management.',
      actorId: user.id,
    });
    await this.employees.update(employee.id, {
      identityType: dto.identityType,
      nationalId: dto.nationalId.trim(),
      nationality: dto.nationality.trim(),
    });
    await this.audit.log({
      actorId: user.id,
      tenantId: this.tenantId(user),
      action: 'hr.qiwa.contract.created',
      entityType: 'hr_qiwa_contract',
      entityId: created.id,
      metadata: { referenceCode },
    });
    return this.reload(created.id);
  }

  async updateContract(user: AuthenticatedUser, id: string, dto: UpdateHrQiwaContractDto) {
    this.assertWrite(user);
    const current = await this.requireContract(id);
    if (!EDITABLE.includes(current.status)) {
      throw new BadRequestException(
        'A documented contract is changed with an update request, so the employee can approve it on Qiwa.',
      );
    }
    await this.applyTerms(
      user,
      current,
      dto,
      QiwaContractStatus.DRAFT,
      QiwaContractEventType.UPDATED,
    );
    return this.reload(id);
  }

  async validateContract(user: AuthenticatedUser, id: string) {
    this.assertWrite(user);
    const current = await this.requireContract(id);
    if (!EDITABLE.includes(current.status)) {
      throw new BadRequestException('Only a draft or returned contract can be checked.');
    }
    const findings = await this.findingsFor(current, 'authenticate');
    if (qiwaFindingsBlock(findings) && current.status === QiwaContractStatus.READY) {
      await this.contracts.update(id, {
        status: QiwaContractStatus.DRAFT,
        updatedById: user.id,
      });
    } else if (!qiwaFindingsBlock(findings)) {
      await this.contracts.update(id, {
        status: QiwaContractStatus.READY,
        updatedById: user.id,
      });
      await this.contracts.addEvent({
        contractId: id,
        type: QiwaContractEventType.VALIDATED,
        fromStatus: current.status,
        toStatus: QiwaContractStatus.READY,
        note: 'Terms match the Qiwa Contract Management checks and can be entered on Qiwa.',
        actorId: user.id,
      });
    }
    const contract = await this.reload(id);
    return { contract, findings };
  }

  async sendToEmployee(user: AuthenticatedUser, id: string) {
    this.assertWrite(user);
    const current = await this.requireContract(id);
    if (current.status !== QiwaContractStatus.READY) {
      throw new BadRequestException('Check the contract against Qiwa rules before sending it.');
    }
    const findings = await this.findingsFor(current, 'authenticate');
    this.throwIfBlocked(findings);
    await this.contracts.update(id, {
      status: QiwaContractStatus.PENDING_EMPLOYEE,
      sentToEmployeeAt: new Date(),
      updatedById: user.id,
    });
    await this.contracts.addEvent({
      contractId: id,
      type: QiwaContractEventType.SENT_TO_EMPLOYEE,
      fromStatus: current.status,
      toStatus: QiwaContractStatus.PENDING_EMPLOYEE,
      note: 'Sent to the employee. Approval happens in Qiwa Individuals.',
      actorId: user.id,
    });
    await this.audit.log({
      actorId: user.id,
      tenantId: this.tenantId(user),
      action: 'hr.qiwa.contract.sent',
      entityType: 'hr_qiwa_contract',
      entityId: id,
      metadata: { referenceCode: current.referenceCode },
    });
    return this.reload(id);
  }

  async recordEmployeeResponse(
    user: AuthenticatedUser,
    id: string,
    dto: HrQiwaEmployeeResponseDto,
  ) {
    this.assertWrite(user);
    const current = await this.requireContract(id);
    if (!AWAITING_EMPLOYEE.includes(current.status)) {
      throw new BadRequestException('This contract is not waiting for the employee.');
    }
    if (dto.decision === 'APPROVED') {
      const qiwaContractNumber = dto.qiwaContractNumber?.trim();
      if (!qiwaContractNumber) {
        throw new BadRequestException(
          'Enter the contract number shown on Qiwa after the employee approves.',
        );
      }
      await this.contracts.update(id, {
        status: QiwaContractStatus.DOCUMENTED,
        qiwaContractNumber,
        documentedAt: new Date(),
        amendmentNote: null,
        updatedById: user.id,
      });
      await this.contracts.addEvent({
        contractId: id,
        type: QiwaContractEventType.EMPLOYEE_APPROVED,
        fromStatus: current.status,
        toStatus: QiwaContractStatus.DOCUMENTED,
        note: dto.note?.trim() || `Documented on Qiwa as ${qiwaContractNumber}.`,
        actorId: user.id,
      });
    } else if (dto.decision === 'REJECTED') {
      await this.contracts.update(id, {
        status: QiwaContractStatus.REJECTED,
        updatedById: user.id,
      });
      await this.contracts.addEvent({
        contractId: id,
        type: QiwaContractEventType.EMPLOYEE_REJECTED,
        fromStatus: current.status,
        toStatus: QiwaContractStatus.REJECTED,
        note: dto.note?.trim() || 'Employee rejected the contract on Qiwa.',
        actorId: user.id,
      });
    } else {
      const note = dto.note?.trim();
      if (!note) {
        throw new BadRequestException('Record what the employee asked to change.');
      }
      await this.contracts.update(id, {
        status: QiwaContractStatus.AMENDMENT_REQUESTED,
        amendmentNote: note,
        updatedById: user.id,
      });
      await this.contracts.addEvent({
        contractId: id,
        type: QiwaContractEventType.AMENDMENT_REQUESTED,
        fromStatus: current.status,
        toStatus: QiwaContractStatus.AMENDMENT_REQUESTED,
        note,
        actorId: user.id,
      });
    }
    return this.reload(id);
  }

  async recordExecutionNumber(user: AuthenticatedUser, id: string, dto: HrQiwaExecutionNumberDto) {
    this.assertWrite(user);
    const current = await this.requireContract(id);
    if (
      current.status !== QiwaContractStatus.DOCUMENTED &&
      current.status !== QiwaContractStatus.ENFORCEABLE
    ) {
      throw new BadRequestException(
        'An execution number is recorded after both parties have documented the contract.',
      );
    }
    const executionNumber = dto.executionNumber.trim();
    await this.contracts.update(id, {
      status: QiwaContractStatus.ENFORCEABLE,
      executionNumber,
      updatedById: user.id,
    });
    await this.contracts.addEvent({
      contractId: id,
      type: QiwaContractEventType.EXECUTION_RECORDED,
      fromStatus: current.status,
      toStatus: QiwaContractStatus.ENFORCEABLE,
      note: `Ministry of Justice execution number ${executionNumber}.`,
      actorId: user.id,
    });
    return this.reload(id);
  }

  async requestUpdate(user: AuthenticatedUser, id: string, dto: UpdateHrQiwaContractDto) {
    this.assertWrite(user);
    const current = await this.requireContract(id);
    if (
      current.status !== QiwaContractStatus.DOCUMENTED &&
      current.status !== QiwaContractStatus.ENFORCEABLE
    ) {
      throw new BadRequestException('Only a documented contract can be sent back for an update.');
    }
    const open = await this.contracts.findOpenForEmployee(current.employeeId, current.id);
    const findings = assessQiwaContract({
      terms: this.termsFromMerged(current, dto, Boolean(open)),
      establishment: this.establishmentCheck(current.establishment),
      purpose: 'authenticate',
    });
    this.throwIfBlocked(findings);
    const previousExecution = current.executionNumber;
    await this.applyTerms(
      user,
      current,
      dto,
      QiwaContractStatus.UPDATE_PENDING,
      QiwaContractEventType.UPDATE_SUBMITTED,
      previousExecution
        ? `Updated terms need the employee's approval on Qiwa. Previous execution number ${previousExecution} was cleared until the new terms are documented.`
        : "Updated terms need the employee's approval on Qiwa.",
      { executionNumber: null, sentToEmployeeAt: new Date() },
    );
    return this.reload(id);
  }

  async terminate(user: AuthenticatedUser, id: string, dto: HrQiwaTerminateDto) {
    this.assertWrite(user);
    const current = await this.requireContract(id);
    const allowed: QiwaContractStatus[] = [
      QiwaContractStatus.PENDING_EMPLOYEE,
      QiwaContractStatus.AMENDMENT_REQUESTED,
      QiwaContractStatus.DOCUMENTED,
      QiwaContractStatus.ENFORCEABLE,
      QiwaContractStatus.UPDATE_PENDING,
    ];
    if (!allowed.includes(current.status)) {
      throw new BadRequestException('This contract is not an active Qiwa relationship.');
    }
    await this.contracts.update(id, {
      status: QiwaContractStatus.TERMINATED,
      terminationReason: dto.reason.trim(),
      terminatedAt: dto.terminatedOn ? parseDate(dto.terminatedOn) : new Date(),
      updatedById: user.id,
    });
    await this.contracts.addEvent({
      contractId: id,
      type: QiwaContractEventType.TERMINATED,
      fromStatus: current.status,
      toStatus: QiwaContractStatus.TERMINATED,
      note: dto.reason.trim(),
      actorId: user.id,
    });
    return this.reload(id);
  }

  async expire(user: AuthenticatedUser, id: string) {
    this.assertWrite(user);
    const current = await this.requireContract(id);
    if (current.contractType !== QiwaContractType.FIXED_TERM || !current.endDate) {
      throw new BadRequestException('Only a fixed-term contract can expire.');
    }
    if (
      current.status !== QiwaContractStatus.DOCUMENTED &&
      current.status !== QiwaContractStatus.ENFORCEABLE
    ) {
      throw new BadRequestException('Expire a contract after it has been documented.');
    }
    if (current.endDate > todayUtc()) {
      throw new BadRequestException('This fixed-term contract has not reached its end date.');
    }
    await this.contracts.update(id, {
      status: QiwaContractStatus.EXPIRED,
      updatedById: user.id,
    });
    await this.contracts.addEvent({
      contractId: id,
      type: QiwaContractEventType.EXPIRED,
      fromStatus: current.status,
      toStatus: QiwaContractStatus.EXPIRED,
      note: `Fixed term ended on ${dateOnly(current.endDate)}.`,
      actorId: user.id,
    });
    return this.reload(id);
  }

  async deleteContract(user: AuthenticatedUser, id: string) {
    this.assertWrite(user);
    const current = await this.requireContract(id);
    if (
      current.status !== QiwaContractStatus.DRAFT &&
      current.status !== QiwaContractStatus.REJECTED
    ) {
      throw new BadRequestException('Only a draft or rejected contract can be removed.');
    }
    await this.contracts.delete(id);
    await this.audit.log({
      actorId: user.id,
      tenantId: this.tenantId(user),
      action: 'hr.qiwa.contract.deleted',
      entityType: 'hr_qiwa_contract',
      entityId: id,
      metadata: { referenceCode: current.referenceCode },
    });
    return { deleted: true };
  }

  private async applyTerms(
    user: AuthenticatedUser,
    current: QiwaContractDetailRow,
    dto: UpdateHrQiwaContractDto,
    status: QiwaContractStatus,
    eventType: QiwaContractEventType,
    note = 'Contract terms updated.',
    extra: Prisma.HrQiwaContractUncheckedUpdateInput = {},
  ) {
    const contractType = dto.contractType ?? current.contractType;
    const wages = this.wagesFrom(dto, current);
    await this.contracts.update(current.id, {
      contractType,
      identityType: dto.identityType ?? current.identityType,
      nationalId: dto.nationalId?.trim() ?? current.nationalId,
      employeeNameEn: dto.employeeNameEn?.trim() || current.employeeNameEn,
      employeeNameAr:
        dto.employeeNameAr !== undefined ? blank(dto.employeeNameAr) : current.employeeNameAr,
      nationality: dto.nationality?.trim() || current.nationality,
      occupationTitle: dto.occupationTitle?.trim() || current.occupationTitle,
      jobTitle: dto.jobTitle !== undefined ? blank(dto.jobTitle) : current.jobTitle,
      startDate: dto.startDate ? parseDate(dto.startDate) : current.startDate,
      endDate:
        contractType === QiwaContractType.INDEFINITE
          ? null
          : dto.endDate
            ? parseDate(dto.endDate)
            : current.endDate,
      probationDays: dto.probationDays ?? current.probationDays,
      dailyHours: dto.dailyHours ?? money(current.dailyHours),
      weeklyHours: dto.weeklyHours ?? money(current.weeklyHours),
      workLocation: dto.workLocation !== undefined ? blank(dto.workLocation) : current.workLocation,
      wageBasis: dto.wageBasis ?? current.wageBasis,
      ...wages,
      noticePeriodDays: dto.noticePeriodDays ?? current.noticePeriodDays,
      additionalTerms:
        dto.additionalTerms !== undefined ? blank(dto.additionalTerms) : current.additionalTerms,
      gosiRegistered: dto.gosiRegistered ?? current.gosiRegistered,
      listedOnQiwa: dto.listedOnQiwa ?? current.listedOnQiwa,
      status,
      updatedById: user.id,
      ...extra,
    });
    await this.contracts.addEvent({
      contractId: current.id,
      type: eventType,
      fromStatus: current.status,
      toStatus: status,
      note,
      actorId: user.id,
    });
    if (dto.identityType || dto.nationalId || dto.nationality) {
      await this.employees.update(current.employeeId, {
        ...(dto.identityType ? { identityType: dto.identityType } : {}),
        ...(dto.nationalId ? { nationalId: dto.nationalId.trim() } : {}),
        ...(dto.nationality ? { nationality: dto.nationality.trim() } : {}),
      });
    }
  }

  private wagesFrom(
    dto: {
      basicWage?: number;
      housingAllowance?: number;
      transportAllowance?: number;
      otherAllowances?: number;
    },
    current: QiwaContractDetailRow | null,
  ) {
    const parts = {
      basicWage: dto.basicWage ?? (current ? money(current.basicWage) : 0),
      housingAllowance: dto.housingAllowance ?? (current ? money(current.housingAllowance) : 0),
      transportAllowance:
        dto.transportAllowance ?? (current ? money(current.transportAllowance) : 0),
      otherAllowances: dto.otherAllowances ?? (current ? money(current.otherAllowances) : 0),
    };
    return { ...parts, totalWage: qiwaTotalWage(parts) };
  }

  private async findingsFor(
    row: QiwaContractDetailRow,
    purpose: 'draft' | 'authenticate',
  ): Promise<QiwaFinding[]> {
    const open = await this.contracts.findOpenForEmployee(row.employeeId, row.id);
    return assessQiwaContract({
      terms: this.termsFrom(row, Boolean(open)),
      establishment: this.establishmentCheck(row.establishment),
      purpose,
    });
  }

  private termsFrom(
    row: QiwaContractDetailRow,
    hasAnotherOpenContract: boolean,
  ): QiwaContractTerms {
    return this.termsFromMerged(row, {}, hasAnotherOpenContract);
  }

  private termsFromMerged(
    row: QiwaContractDetailRow,
    dto: UpdateHrQiwaContractDto,
    hasAnotherOpenContract: boolean,
  ): QiwaContractTerms {
    const wages = this.wagesFrom(dto, row);
    const contractType = dto.contractType ?? row.contractType;
    return {
      contractType,
      identityType: dto.identityType ?? row.identityType,
      nationalId: dto.nationalId?.trim() ?? row.nationalId,
      employeeNameEn: dto.employeeNameEn?.trim() || row.employeeNameEn,
      nationality: dto.nationality?.trim() || row.nationality,
      occupationTitle: dto.occupationTitle?.trim() || row.occupationTitle,
      startDate: dto.startDate?.slice(0, 10) ?? dateOnly(row.startDate) ?? '',
      endDate:
        contractType === QiwaContractType.INDEFINITE
          ? null
          : dto.endDate
            ? dto.endDate.slice(0, 10)
            : dateOnly(row.endDate),
      probationDays: dto.probationDays ?? row.probationDays,
      dailyHours: dto.dailyHours ?? money(row.dailyHours),
      weeklyHours: dto.weeklyHours ?? money(row.weeklyHours),
      wageBasis: dto.wageBasis ?? row.wageBasis,
      basicWage: wages.basicWage,
      housingAllowance: wages.housingAllowance,
      transportAllowance: wages.transportAllowance,
      otherAllowances: wages.otherAllowances,
      noticePeriodDays: dto.noticePeriodDays ?? row.noticePeriodDays,
      gosiRegistered: dto.gosiRegistered ?? row.gosiRegistered,
      listedOnQiwa: dto.listedOnQiwa ?? row.listedOnQiwa,
      hireDate: dateOnly(row.employee.hireDate),
      hasAnotherOpenContract,
    };
  }

  private establishmentCheck(row: {
    status: QiwaEstablishmentStatus;
    nameEn: string;
    laborOfficeId: string | null;
    sequenceNumber: string | null;
    commercialRegistrationNumber: string | null;
    unifiedNumber: string | null;
  }): QiwaEstablishmentCheck {
    return {
      status: row.status,
      nameEn: row.nameEn,
      laborOfficeId: row.laborOfficeId,
      sequenceNumber: row.sequenceNumber,
      commercialRegistrationNumber: row.commercialRegistrationNumber,
      unifiedNumber: row.unifiedNumber,
    };
  }

  private async requireContract(id: string) {
    const row = await this.contracts.findById(id);
    if (!row) throw new NotFoundException('Qiwa contract not found.');
    return row;
  }

  private async reload(id: string) {
    const row = await this.requireContract(id);
    const findings = await this.findingsFor(row, 'authenticate');
    return {
      ...this.presentSummary(row),
      employeeNameAr: row.employeeNameAr,
      jobTitle: row.jobTitle,
      probationDays: row.probationDays,
      dailyHours: money(row.dailyHours),
      weeklyHours: money(row.weeklyHours),
      workLocation: row.workLocation,
      wageBasis: row.wageBasis,
      basicWage: money(row.basicWage),
      housingAllowance: money(row.housingAllowance),
      transportAllowance: money(row.transportAllowance),
      otherAllowances: money(row.otherAllowances),
      noticePeriodDays: row.noticePeriodDays,
      additionalTerms: row.additionalTerms,
      gosiRegistered: row.gosiRegistered,
      listedOnQiwa: row.listedOnQiwa,
      amendmentNote: row.amendmentNote,
      terminationReason: row.terminationReason,
      sentToEmployeeAt: row.sentToEmployeeAt?.toISOString() ?? null,
      documentedAt: row.documentedAt?.toISOString() ?? null,
      terminatedAt: row.terminatedAt?.toISOString() ?? null,
      events: row.events.map((event) => ({
        id: event.id,
        type: event.type,
        fromStatus: event.fromStatus,
        toStatus: event.toStatus,
        note: event.note,
        createdAt: event.createdAt.toISOString(),
        actorName: event.actor?.name || event.actor?.email || null,
      })),
      findings,
      submissionPackage: buildQiwaSubmissionPackage({
        establishment: row.establishment,
        employeeNameEn: row.employeeNameEn,
        employeeNameAr: row.employeeNameAr,
        identityType: row.identityType,
        nationalId: row.nationalId,
        nationality: row.nationality,
        listedOnQiwa: row.listedOnQiwa,
        gosiRegistered: row.gosiRegistered,
        contractType: row.contractType,
        occupationTitle: row.occupationTitle,
        jobTitle: row.jobTitle,
        startDate: dateOnly(row.startDate) ?? '',
        endDate: dateOnly(row.endDate),
        probationDays: row.probationDays,
        dailyHours: money(row.dailyHours),
        weeklyHours: money(row.weeklyHours),
        workLocation: row.workLocation,
        wageBasis: row.wageBasis,
        basicWage: money(row.basicWage),
        housingAllowance: money(row.housingAllowance),
        transportAllowance: money(row.transportAllowance),
        otherAllowances: money(row.otherAllowances),
        totalWage: money(row.totalWage),
        noticePeriodDays: row.noticePeriodDays,
        additionalTerms: row.additionalTerms,
      }),
    };
  }

  private presentSummary(row: {
    id: string;
    referenceCode: string;
    status: QiwaContractStatus;
    contractType: QiwaContractType;
    identityType: QiwaIdentityType;
    nationalId: string;
    employeeNameEn: string;
    nationality: string;
    occupationTitle: string;
    startDate: Date;
    endDate: Date | null;
    totalWage: Prisma.Decimal;
    currency: string;
    qiwaContractNumber: string | null;
    executionNumber: string | null;
    employeeId: string;
    updatedAt: Date;
    employee: { employeeCode: string; firstName: string; lastName: string };
  }) {
    return {
      id: row.id,
      referenceCode: row.referenceCode,
      status: row.status,
      contractType: row.contractType,
      identityType: row.identityType,
      nationalId: row.nationalId,
      employeeNameEn: row.employeeNameEn,
      nationality: row.nationality,
      occupationTitle: row.occupationTitle,
      startDate: dateOnly(row.startDate),
      endDate: dateOnly(row.endDate),
      totalWage: money(row.totalWage),
      currency: row.currency,
      qiwaContractNumber: row.qiwaContractNumber,
      executionNumber: row.executionNumber,
      employeeId: row.employeeId,
      employeeCode: row.employee.employeeCode,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private presentEstablishment(row: {
    id: string;
    nameEn: string;
    nameAr: string | null;
    laborOfficeId: string | null;
    sequenceNumber: string | null;
    commercialRegistrationNumber: string | null;
    unifiedNumber: string | null;
    economicActivity: string | null;
    status: QiwaEstablishmentStatus;
    nitaqatBand: QiwaNitaqatBand;
    saudiCount: number | null;
    nonSaudiCount: number | null;
    saudizationPercent: Prisma.Decimal | null;
    nitaqatRecordedAt: Date | null;
    saudizationCertificateExpiresAt: Date | null;
    notes: string | null;
  }) {
    return {
      id: row.id,
      nameEn: row.nameEn,
      nameAr: row.nameAr,
      laborOfficeId: row.laborOfficeId,
      sequenceNumber: row.sequenceNumber,
      commercialRegistrationNumber: row.commercialRegistrationNumber,
      unifiedNumber: row.unifiedNumber,
      economicActivity: row.economicActivity,
      status: row.status,
      nitaqatBand: row.nitaqatBand,
      saudiCount: row.saudiCount,
      nonSaudiCount: row.nonSaudiCount,
      saudizationPercent: row.saudizationPercent == null ? null : money(row.saudizationPercent),
      nitaqatRecordedAt: row.nitaqatRecordedAt?.toISOString() ?? null,
      saudizationCertificateExpiresAt: dateOnly(row.saudizationCertificateExpiresAt),
      notes: row.notes,
    };
  }

  private throwIfBlocked(findings: QiwaFinding[]) {
    const errors = findings.filter((finding) => finding.severity === 'error');
    if (errors.length) {
      throw new BadRequestException(errors.map((finding) => finding.message).join(' '));
    }
  }

  private assertRead(user: AuthenticatedUser) {
    const role = normalizeVelonRole(user.role);
    if (
      role !== VelonRole.TENANT_OWNER &&
      role !== VelonRole.TENANT_ADMIN &&
      role !== VelonRole.DEPARTMENT_ADMIN &&
      role !== VelonRole.USER
    ) {
      throw new ForbiddenException('HR access denied.');
    }
  }

  private assertWrite(user: AuthenticatedUser) {
    const role = normalizeVelonRole(user.role);
    if (
      role !== VelonRole.TENANT_OWNER &&
      role !== VelonRole.TENANT_ADMIN &&
      role !== VelonRole.DEPARTMENT_ADMIN
    ) {
      throw new ForbiddenException('Insufficient permissions to modify HR records.');
    }
  }

  private tenantId(user: AuthenticatedUser) {
    if (!user.tenantId) throw new ForbiddenException('Tenant context is required.');
    return user.tenantId;
  }
}
