import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  HrEmploymentStatus,
  HrExpenseClaimStatus,
  HrJobOpeningStatus,
  HrLeaveRequestStatus,
  HrPayrollRunStatus,
} from '@velon/database';
import { normalizeVelonRole, VelonRole } from '@velon/shared';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreateHrApplicantDto,
  CreateHrDesignationDto,
  CreateHrEmployeeDto,
  CreateHrExpenseClaimDto,
  CreateHrJobOpeningDto,
  CreateHrLeaveRequestDto,
  CreateHrLeaveTypeDto,
  CreateHrPayrollRunDto,
  CreateHrSalaryComponentDto,
  CreateHrSalaryStructureDto,
  HrAttendanceCheckInDto,
  HrAttendanceCheckOutDto,
  HrAttendanceQueryDto,
  HrDesignationQueryDto,
  HrEmployeeQueryDto,
  HrExpenseClaimQueryDto,
  HrJobOpeningQueryDto,
  HrLeaveRequestQueryDto,
  HrPayrollRunQueryDto,
  RejectHrExpenseClaimDto,
  RejectHrLeaveRequestDto,
  UpdateHrApplicantStatusDto,
  UpdateHrDesignationDto,
  UpdateHrEmployeeDto,
  UpdateHrExpenseClaimDto,
  UpdateHrJobOpeningDto,
  UpdateHrLeaveTypeDto,
  UpdateHrSalaryComponentDto,
  UpdateHrSalaryStructureDto,
} from './dto/hr.dto';
import {
  HrApplicantRepository,
  HrAttendanceRecordRepository,
  HrDesignationRepository,
  HrEmployeeRepository,
  HrExpenseClaimRepository,
  HrJobOpeningRepository,
  HrLeaveBalanceRepository,
  HrLeaveRequestRepository,
  HrLeaveTypeRepository,
  HrPayrollRunRepository,
  HrPayslipRepository,
  HrSalaryComponentRepository,
  HrSalaryStructureRepository,
} from './hr.repositories';
import { PayslipPdfService } from './payslip-pdf.service';

function parseDate(value: string): Date {
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
}

function todayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

@Injectable()
export class HrService {
  constructor(
    private readonly designations: HrDesignationRepository,
    private readonly employees: HrEmployeeRepository,
    private readonly leaveTypes: HrLeaveTypeRepository,
    private readonly leaveRequests: HrLeaveRequestRepository,
    private readonly leaveBalances: HrLeaveBalanceRepository,
    private readonly attendance: HrAttendanceRecordRepository,
    private readonly jobOpenings: HrJobOpeningRepository,
    private readonly applicants: HrApplicantRepository,
    private readonly salaryComponents: HrSalaryComponentRepository,
    private readonly salaryStructures: HrSalaryStructureRepository,
    private readonly payrollRuns: HrPayrollRunRepository,
    private readonly payslips: HrPayslipRepository,
    private readonly expenseClaims: HrExpenseClaimRepository,
    private readonly prisma: PrismaService,
    private readonly payslipPdf: PayslipPdfService,
  ) {}

  private role(user: AuthenticatedUser) {
    return normalizeVelonRole(user.role);
  }

  private assertRead(user: AuthenticatedUser) {
    const r = this.role(user);
    if (
      r !== VelonRole.TENANT_OWNER &&
      r !== VelonRole.TENANT_ADMIN &&
      r !== VelonRole.DEPARTMENT_ADMIN &&
      r !== VelonRole.USER
    ) {
      throw new ForbiddenException('HR access denied.');
    }
  }

  private assertWrite(user: AuthenticatedUser) {
    const r = this.role(user);
    if (
      r !== VelonRole.TENANT_OWNER &&
      r !== VelonRole.TENANT_ADMIN &&
      r !== VelonRole.DEPARTMENT_ADMIN
    ) {
      throw new ForbiddenException('Insufficient permissions to modify HR records.');
    }
  }

  private assertApprove(user: AuthenticatedUser) {
    const r = this.role(user);
    if (r !== VelonRole.TENANT_OWNER && r !== VelonRole.TENANT_ADMIN) {
      throw new ForbiddenException('Approval permissions required.');
    }
  }

  private async companyContext(tenantId: string) {
    const [tenant, profile] = await Promise.all([
      this.prisma.client.tenant.findFirst({
        where: { id: tenantId },
        select: { name: true },
      }),
      this.prisma.client.companyProfile.findFirst({
        where: { tenantId },
        select: {
          legalName: true,
          email: true,
          phone: true,
          address: true,
        },
      }),
    ]);
    return {
      name: profile?.legalName ?? tenant?.name ?? 'Company',
      legalName: profile?.legalName,
      email: profile?.email,
      phone: profile?.phone,
      address: profile?.address,
    };
  }

  // ─── Metrics ───────────────────────────────────────────────

  async getMetrics(user: AuthenticatedUser) {
    this.assertRead(user);
    const [headcountByStatus, pendingLeave, openJobs] = await Promise.all([
      this.employees.countByStatus(),
      this.leaveRequests.countPending(),
      this.jobOpenings.countOpen(),
    ]);
    return {
      headcountByStatus: headcountByStatus.map((row) => ({
        status: row.status,
        count: row._count,
      })),
      pendingLeaveRequests: pendingLeave,
      openJobOpenings: openJobs,
    };
  }

  // ─── Designations ──────────────────────────────────────────

  listDesignations(user: AuthenticatedUser, query: HrDesignationQueryDto) {
    this.assertRead(user);
    return this.designations.findMany(query.search);
  }

  async getDesignation(user: AuthenticatedUser, id: string) {
    this.assertRead(user);
    const row = await this.designations.findById(id);
    if (!row) throw new NotFoundException('Designation not found.');
    return row;
  }

  createDesignation(user: AuthenticatedUser, dto: CreateHrDesignationDto) {
    this.assertWrite(user);
    return this.designations.create({
      name: dto.name.trim(),
      description: dto.description?.trim() || null,
      level: dto.level ?? 1,
    });
  }

  async updateDesignation(user: AuthenticatedUser, id: string, dto: UpdateHrDesignationDto) {
    this.assertWrite(user);
    await this.getDesignation(user, id);
    return this.designations.update(id, {
      ...(dto.name != null ? { name: dto.name.trim() } : {}),
      ...(dto.description !== undefined ? { description: dto.description?.trim() || null } : {}),
      ...(dto.level != null ? { level: dto.level } : {}),
    });
  }

  async deleteDesignation(user: AuthenticatedUser, id: string) {
    this.assertWrite(user);
    await this.getDesignation(user, id);
    return this.designations.delete(id);
  }

  // ─── Employees ─────────────────────────────────────────────

  listEmployees(user: AuthenticatedUser, query: HrEmployeeQueryDto) {
    this.assertRead(user);
    return this.employees.findMany({
      search: query.search,
      status: query.status,
      departmentId: query.departmentId,
    });
  }

  async getEmployee(user: AuthenticatedUser, id: string) {
    this.assertRead(user);
    const row = await this.employees.findById(id);
    if (!row) throw new NotFoundException('Employee not found.');
    return row;
  }

  async createEmployee(user: AuthenticatedUser, dto: CreateHrEmployeeDto) {
    this.assertWrite(user);
    const employeeCode = await this.employees.nextEmployeeCode();
    return this.employees.create({
      employeeCode,
      firstName: dto.firstName.trim(),
      lastName: dto.lastName.trim(),
      email: dto.email?.trim().toLowerCase() || null,
      phone: dto.phone?.trim() || null,
      dateOfBirth: dto.dateOfBirth ? parseDate(dto.dateOfBirth) : null,
      hireDate: parseDate(dto.hireDate),
      probationEndDate: dto.probationEndDate ? parseDate(dto.probationEndDate) : null,
      status: dto.status ?? HrEmploymentStatus.ACTIVE,
      departmentId: dto.departmentId || null,
      designationId: dto.designationId || null,
      managerId: dto.managerId || null,
      userId: dto.userId || null,
      branchName: dto.branchName?.trim() || null,
      workLocation: dto.workLocation?.trim() || null,
      currency: dto.currency ?? 'USD',
      baseSalary: dto.baseSalary ?? 0,
      salaryStructureId: dto.salaryStructureId || null,
      bankAccountName: dto.bankAccountName?.trim() || null,
      bankAccountNumber: dto.bankAccountNumber?.trim() || null,
      bankName: dto.bankName?.trim() || null,
      notes: dto.notes?.trim() || null,
      createdById: user.id,
    });
  }

  async updateEmployee(user: AuthenticatedUser, id: string, dto: UpdateHrEmployeeDto) {
    this.assertWrite(user);
    await this.getEmployee(user, id);
    return this.employees.update(id, {
      ...(dto.firstName != null ? { firstName: dto.firstName.trim() } : {}),
      ...(dto.lastName != null ? { lastName: dto.lastName.trim() } : {}),
      ...(dto.email !== undefined ? { email: dto.email?.trim().toLowerCase() || null } : {}),
      ...(dto.phone !== undefined ? { phone: dto.phone?.trim() || null } : {}),
      ...(dto.hireDate ? { hireDate: parseDate(dto.hireDate) } : {}),
      ...(dto.dateOfBirth !== undefined
        ? { dateOfBirth: dto.dateOfBirth ? parseDate(dto.dateOfBirth) : null }
        : {}),
      ...(dto.probationEndDate !== undefined
        ? { probationEndDate: dto.probationEndDate ? parseDate(dto.probationEndDate) : null }
        : {}),
      ...(dto.terminationDate !== undefined
        ? { terminationDate: dto.terminationDate ? parseDate(dto.terminationDate) : null }
        : {}),
      ...(dto.status != null ? { status: dto.status } : {}),
      ...(dto.departmentId !== undefined ? { departmentId: dto.departmentId || null } : {}),
      ...(dto.designationId !== undefined ? { designationId: dto.designationId || null } : {}),
      ...(dto.managerId !== undefined ? { managerId: dto.managerId || null } : {}),
      ...(dto.userId !== undefined ? { userId: dto.userId || null } : {}),
      ...(dto.branchName !== undefined ? { branchName: dto.branchName?.trim() || null } : {}),
      ...(dto.workLocation !== undefined ? { workLocation: dto.workLocation?.trim() || null } : {}),
      ...(dto.currency != null ? { currency: dto.currency } : {}),
      ...(dto.baseSalary != null ? { baseSalary: dto.baseSalary } : {}),
      ...(dto.salaryStructureId !== undefined
        ? { salaryStructureId: dto.salaryStructureId || null }
        : {}),
      ...(dto.bankAccountName !== undefined
        ? { bankAccountName: dto.bankAccountName?.trim() || null }
        : {}),
      ...(dto.bankAccountNumber !== undefined
        ? { bankAccountNumber: dto.bankAccountNumber?.trim() || null }
        : {}),
      ...(dto.bankName !== undefined ? { bankName: dto.bankName?.trim() || null } : {}),
      ...(dto.notes !== undefined ? { notes: dto.notes?.trim() || null } : {}),
    });
  }

  async deleteEmployee(user: AuthenticatedUser, id: string) {
    this.assertWrite(user);
    await this.getEmployee(user, id);
    const qiwaContracts = await this.prisma.client.hrQiwaContract.count({
      where: { tenantId: user.tenantId, employeeId: id },
    });
    if (qiwaContracts > 0) {
      throw new BadRequestException(
        'This employee has Qiwa contract records. End those contracts before deleting the employee.',
      );
    }
    return this.employees.delete(id);
  }

  // ─── Leave types ───────────────────────────────────────────

  listLeaveTypes(user: AuthenticatedUser) {
    this.assertRead(user);
    return this.leaveTypes.findMany();
  }

  async getLeaveType(user: AuthenticatedUser, id: string) {
    this.assertRead(user);
    const row = await this.leaveTypes.findById(id);
    if (!row) throw new NotFoundException('Leave type not found.');
    return row;
  }

  createLeaveType(user: AuthenticatedUser, dto: CreateHrLeaveTypeDto) {
    this.assertWrite(user);
    return this.leaveTypes.create({
      name: dto.name.trim(),
      code: dto.code.trim().toUpperCase(),
      paid: dto.paid ?? true,
      annualAllowance: dto.annualAllowance ?? 0,
      accrualEnabled: dto.accrualEnabled ?? false,
    });
  }

  async updateLeaveType(user: AuthenticatedUser, id: string, dto: UpdateHrLeaveTypeDto) {
    this.assertWrite(user);
    await this.getLeaveType(user, id);
    return this.leaveTypes.update(id, {
      ...(dto.name != null ? { name: dto.name.trim() } : {}),
      ...(dto.code != null ? { code: dto.code.trim().toUpperCase() } : {}),
      ...(dto.paid != null ? { paid: dto.paid } : {}),
      ...(dto.annualAllowance != null ? { annualAllowance: dto.annualAllowance } : {}),
      ...(dto.accrualEnabled != null ? { accrualEnabled: dto.accrualEnabled } : {}),
    });
  }

  async deleteLeaveType(user: AuthenticatedUser, id: string) {
    this.assertWrite(user);
    await this.getLeaveType(user, id);
    return this.leaveTypes.delete(id);
  }

  // ─── Leave requests ────────────────────────────────────────

  listLeaveRequests(user: AuthenticatedUser, query: HrLeaveRequestQueryDto) {
    this.assertRead(user);
    return this.leaveRequests.findMany({
      employeeId: query.employeeId,
      status: query.status,
    });
  }

  async createLeaveRequest(user: AuthenticatedUser, dto: CreateHrLeaveRequestDto) {
    this.assertRead(user);
    const employee = await this.employees.findByIdAny(dto.employeeId);
    if (!employee) throw new NotFoundException('Employee not found.');
    const leaveType = await this.leaveTypes.findById(dto.leaveTypeId);
    if (!leaveType) throw new NotFoundException('Leave type not found.');
    if (parseDate(dto.endDate) < parseDate(dto.startDate)) {
      throw new BadRequestException('End date must be on or after start date.');
    }
    const row = await this.leaveRequests.create({
      employeeId: dto.employeeId,
      leaveTypeId: dto.leaveTypeId,
      startDate: parseDate(dto.startDate),
      endDate: parseDate(dto.endDate),
      days: dto.days,
      reason: dto.reason?.trim() || null,
      status: HrLeaveRequestStatus.PENDING,
      requestedById: user.id,
    });
    const year = parseDate(dto.startDate).getUTCFullYear();
    const balance = await this.leaveBalances.findByEmployeeYear(dto.employeeId, year);
    const existing = balance.find((b) => b.leaveTypeId === dto.leaveTypeId);
    await this.leaveBalances.upsert({
      employeeId: dto.employeeId,
      leaveTypeId: dto.leaveTypeId,
      year,
      entitled: existing ? Number(existing.entitled) : Number(leaveType.annualAllowance),
      used: existing ? Number(existing.used) : 0,
      pending: (existing ? Number(existing.pending) : 0) + dto.days,
    });
    return row;
  }

  async approveLeaveRequest(user: AuthenticatedUser, id: string) {
    this.assertApprove(user);
    const row = await this.leaveRequests.findById(id);
    if (!row) throw new NotFoundException('Leave request not found.');
    if (row.status !== HrLeaveRequestStatus.PENDING) {
      throw new BadRequestException('Only pending leave requests can be approved.');
    }
    const updated = await this.leaveRequests.update(id, {
      status: HrLeaveRequestStatus.APPROVED,
      approvedById: user.id,
      decidedAt: new Date(),
    });
    const year = row.startDate.getUTCFullYear();
    const balance = await this.leaveBalances.findByEmployeeYear(row.employeeId, year);
    const existing = balance.find((b) => b.leaveTypeId === row.leaveTypeId);
    if (existing) {
      await this.leaveBalances.upsert({
        employeeId: row.employeeId,
        leaveTypeId: row.leaveTypeId,
        year,
        entitled: Number(existing.entitled),
        used: Number(existing.used) + Number(row.days),
        pending: Math.max(0, Number(existing.pending) - Number(row.days)),
      });
    }
    return updated;
  }

  async rejectLeaveRequest(user: AuthenticatedUser, id: string, dto: RejectHrLeaveRequestDto) {
    this.assertApprove(user);
    const row = await this.leaveRequests.findById(id);
    if (!row) throw new NotFoundException('Leave request not found.');
    if (row.status !== HrLeaveRequestStatus.PENDING) {
      throw new BadRequestException('Only pending leave requests can be rejected.');
    }
    const updated = await this.leaveRequests.update(id, {
      status: HrLeaveRequestStatus.REJECTED,
      approvedById: user.id,
      decidedAt: new Date(),
      reason: dto.reason?.trim() || row.reason,
    });
    const year = row.startDate.getUTCFullYear();
    const balance = await this.leaveBalances.findByEmployeeYear(row.employeeId, year);
    const existing = balance.find((b) => b.leaveTypeId === row.leaveTypeId);
    if (existing) {
      await this.leaveBalances.upsert({
        employeeId: row.employeeId,
        leaveTypeId: row.leaveTypeId,
        year,
        entitled: Number(existing.entitled),
        used: Number(existing.used),
        pending: Math.max(0, Number(existing.pending) - Number(row.days)),
      });
    }
    return updated;
  }

  // ─── Attendance ────────────────────────────────────────────

  listAttendance(user: AuthenticatedUser, query: HrAttendanceQueryDto) {
    this.assertRead(user);
    return this.attendance.findMany({
      employeeId: query.employeeId,
      from: query.from ? parseDate(query.from) : undefined,
      to: query.to ? parseDate(query.to) : undefined,
    });
  }

  async checkIn(user: AuthenticatedUser, dto: HrAttendanceCheckInDto) {
    this.assertRead(user);
    const employee = await this.employees.findByIdAny(dto.employeeId);
    if (!employee) throw new NotFoundException('Employee not found.');
    return this.attendance.upsertCheckIn({
      employeeId: dto.employeeId,
      workDate: todayUtc(),
      checkInAt: new Date(),
      shiftId: dto.shiftId,
      latitude: dto.latitude,
      longitude: dto.longitude,
      notes: dto.notes?.trim(),
    });
  }

  async checkOut(user: AuthenticatedUser, dto: HrAttendanceCheckOutDto) {
    this.assertRead(user);
    const employee = await this.employees.findByIdAny(dto.employeeId);
    if (!employee) throw new NotFoundException('Employee not found.');
    const workDate = todayUtc();
    const record = await this.attendance.findByEmployeeDate(dto.employeeId, workDate);
    if (!record) {
      throw new BadRequestException('No check-in record found for today.');
    }
    if (record.checkOutAt) {
      throw new BadRequestException('Already checked out for today.');
    }
    return this.attendance.update(record.id, {
      checkOutAt: new Date(),
      ...(dto.notes ? { notes: dto.notes.trim() } : {}),
    });
  }

  // ─── Job openings ──────────────────────────────────────────

  listJobOpenings(user: AuthenticatedUser, query: HrJobOpeningQueryDto) {
    this.assertRead(user);
    return this.jobOpenings.findMany({ search: query.search, status: query.status });
  }

  async getJobOpening(user: AuthenticatedUser, id: string) {
    this.assertRead(user);
    const row = await this.jobOpenings.findById(id);
    if (!row) throw new NotFoundException('Job opening not found.');
    return row;
  }

  createJobOpening(user: AuthenticatedUser, dto: CreateHrJobOpeningDto) {
    this.assertWrite(user);
    const status = dto.status ?? HrJobOpeningStatus.DRAFT;
    return this.jobOpenings.create({
      title: dto.title.trim(),
      departmentId: dto.departmentId || null,
      description: dto.description?.trim() || null,
      location: dto.location?.trim() || null,
      status,
      openings: dto.openings ?? 1,
      publishedAt: status === HrJobOpeningStatus.OPEN ? new Date() : null,
    });
  }

  async updateJobOpening(user: AuthenticatedUser, id: string, dto: UpdateHrJobOpeningDto) {
    this.assertWrite(user);
    const existing = await this.getJobOpening(user, id);
    const status = dto.status ?? existing.status;
    return this.jobOpenings.update(id, {
      ...(dto.title != null ? { title: dto.title.trim() } : {}),
      ...(dto.departmentId !== undefined ? { departmentId: dto.departmentId || null } : {}),
      ...(dto.description !== undefined ? { description: dto.description?.trim() || null } : {}),
      ...(dto.location !== undefined ? { location: dto.location?.trim() || null } : {}),
      ...(dto.status != null ? { status: dto.status } : {}),
      ...(dto.openings != null ? { openings: dto.openings } : {}),
      ...(dto.status === HrJobOpeningStatus.OPEN && !existing.publishedAt
        ? { publishedAt: new Date() }
        : {}),
      ...(status === HrJobOpeningStatus.CLOSED || status === HrJobOpeningStatus.FILLED
        ? { closedAt: new Date() }
        : {}),
    });
  }

  async deleteJobOpening(user: AuthenticatedUser, id: string) {
    this.assertWrite(user);
    await this.getJobOpening(user, id);
    return this.jobOpenings.delete(id);
  }

  // ─── Applicants ────────────────────────────────────────────

  listApplicants(user: AuthenticatedUser, jobOpeningId: string) {
    this.assertRead(user);
    return this.applicants.findByJob(jobOpeningId);
  }

  async createApplicant(user: AuthenticatedUser, jobOpeningId: string, dto: CreateHrApplicantDto) {
    this.assertRead(user);
    await this.getJobOpening(user, jobOpeningId);
    return this.applicants.create({
      jobOpeningId,
      firstName: dto.firstName.trim(),
      lastName: dto.lastName.trim(),
      email: dto.email.trim().toLowerCase(),
      phone: dto.phone?.trim() || null,
      resumeText: dto.resumeText?.trim() || null,
      notes: dto.notes?.trim() || null,
    });
  }

  async updateApplicantStatus(
    user: AuthenticatedUser,
    id: string,
    dto: UpdateHrApplicantStatusDto,
  ) {
    this.assertWrite(user);
    const row = await this.applicants.findById(id);
    if (!row) throw new NotFoundException('Applicant not found.');
    return this.applicants.update(id, {
      status: dto.status,
      ...(dto.score != null ? { score: dto.score } : {}),
      ...(dto.notes !== undefined ? { notes: dto.notes?.trim() || null } : {}),
    });
  }

  // ─── Salary components ─────────────────────────────────────

  listSalaryComponents(user: AuthenticatedUser) {
    this.assertRead(user);
    return this.salaryComponents.findMany();
  }

  async getSalaryComponent(user: AuthenticatedUser, id: string) {
    this.assertRead(user);
    const row = await this.salaryComponents.findById(id);
    if (!row) throw new NotFoundException('Salary component not found.');
    return row;
  }

  createSalaryComponent(user: AuthenticatedUser, dto: CreateHrSalaryComponentDto) {
    this.assertWrite(user);
    return this.salaryComponents.create({
      name: dto.name.trim(),
      code: dto.code.trim().toUpperCase(),
      type: dto.type,
      taxable: dto.taxable ?? true,
    });
  }

  async updateSalaryComponent(
    user: AuthenticatedUser,
    id: string,
    dto: UpdateHrSalaryComponentDto,
  ) {
    this.assertWrite(user);
    await this.getSalaryComponent(user, id);
    return this.salaryComponents.update(id, {
      ...(dto.name != null ? { name: dto.name.trim() } : {}),
      ...(dto.code != null ? { code: dto.code.trim().toUpperCase() } : {}),
      ...(dto.type != null ? { type: dto.type } : {}),
      ...(dto.taxable != null ? { taxable: dto.taxable } : {}),
    });
  }

  async deleteSalaryComponent(user: AuthenticatedUser, id: string) {
    this.assertWrite(user);
    await this.getSalaryComponent(user, id);
    return this.salaryComponents.delete(id);
  }

  // ─── Salary structures ─────────────────────────────────────

  listSalaryStructures(user: AuthenticatedUser) {
    this.assertRead(user);
    return this.salaryStructures.findMany();
  }

  async getSalaryStructure(user: AuthenticatedUser, id: string) {
    this.assertRead(user);
    const row = await this.salaryStructures.findById(id);
    if (!row) throw new NotFoundException('Salary structure not found.');
    return row;
  }

  async createSalaryStructure(user: AuthenticatedUser, dto: CreateHrSalaryStructureDto) {
    this.assertWrite(user);
    const row = await this.salaryStructures.create({
      name: dto.name.trim(),
      description: dto.description?.trim() || null,
      currency: dto.currency ?? 'USD',
      isDefault: dto.isDefault ?? false,
    });
    if (dto.items?.length) {
      return this.salaryStructures.replaceItems(
        row.id,
        dto.items.map((item) => ({
          componentId: item.componentId,
          amount: item.amount ?? 0,
          percentage: item.percentage ?? null,
          formula: item.formula?.trim() || null,
        })),
      );
    }
    return row;
  }

  async updateSalaryStructure(
    user: AuthenticatedUser,
    id: string,
    dto: UpdateHrSalaryStructureDto,
  ) {
    this.assertWrite(user);
    await this.getSalaryStructure(user, id);
    await this.salaryStructures.update(id, {
      ...(dto.name != null ? { name: dto.name.trim() } : {}),
      ...(dto.description !== undefined ? { description: dto.description?.trim() || null } : {}),
      ...(dto.currency != null ? { currency: dto.currency } : {}),
      ...(dto.isDefault != null ? { isDefault: dto.isDefault } : {}),
    });
    if (dto.items) {
      return this.salaryStructures.replaceItems(
        id,
        dto.items.map((item) => ({
          componentId: item.componentId,
          amount: item.amount ?? 0,
          percentage: item.percentage ?? null,
          formula: item.formula?.trim() || null,
        })),
      );
    }
    return this.getSalaryStructure(user, id);
  }

  async deleteSalaryStructure(user: AuthenticatedUser, id: string) {
    this.assertWrite(user);
    await this.getSalaryStructure(user, id);
    return this.salaryStructures.delete(id);
  }

  // ─── Payroll ───────────────────────────────────────────────

  listPayrollRuns(user: AuthenticatedUser, query: HrPayrollRunQueryDto) {
    this.assertRead(user);
    return this.payrollRuns.findMany({ status: query.status });
  }

  createPayrollRun(user: AuthenticatedUser, dto: CreateHrPayrollRunDto) {
    this.assertWrite(user);
    if (parseDate(dto.periodEnd) < parseDate(dto.periodStart)) {
      throw new BadRequestException('Period end must be on or after period start.');
    }
    return this.payrollRuns.create({
      name: dto.name.trim(),
      periodStart: parseDate(dto.periodStart),
      periodEnd: parseDate(dto.periodEnd),
      currency: dto.currency ?? 'USD',
      status: HrPayrollRunStatus.DRAFT,
    });
  }

  async processPayrollRun(user: AuthenticatedUser, id: string) {
    this.assertWrite(user);
    const run = await this.payrollRuns.findById(id);
    if (!run) throw new NotFoundException('Payroll run not found.');
    if (run.status === HrPayrollRunStatus.COMPLETED) {
      throw new BadRequestException('Payroll run is already completed.');
    }
    if (run.status === HrPayrollRunStatus.CANCELLED) {
      throw new BadRequestException('Cannot process a cancelled payroll run.');
    }

    await this.payrollRuns.update(id, { status: HrPayrollRunStatus.PROCESSING });
    await this.payslips.deleteByRun(id);

    const employees = await this.employees.findActiveForPayroll();
    const company = await this.companyContext(user.tenantId!);

    for (const employee of employees) {
      const grossPay = Number(employee.baseSalary);
      const deductions = 0;
      const netPay = grossPay;
      const payslip = await this.payslips.create({
        payrollRunId: id,
        employeeId: employee.id,
        grossPay,
        deductions,
        netPay,
        currency: run.currency,
        linesJson: [{ label: 'Base Salary', amount: grossPay, type: 'EARNING' }],
      });

      const pdfBuffer = await this.payslipPdf.generate({
        payslipId: payslip.id,
        payrollRunName: run.name,
        periodStart: run.periodStart.toISOString().slice(0, 10),
        periodEnd: run.periodEnd.toISOString().slice(0, 10),
        currency: run.currency,
        grossPay,
        deductions,
        netPay,
        company,
        employee: {
          name: `${employee.firstName} ${employee.lastName}`,
          employeeCode: employee.employeeCode,
          email: employee.email,
          department: employee.department?.name ?? null,
          designation: employee.designation?.name ?? null,
        },
      });

      await this.payslips.update(payslip.id, { pdfContent: new Uint8Array(pdfBuffer) });
    }

    return this.payrollRuns.update(id, {
      status: HrPayrollRunStatus.COMPLETED,
      processedById: user.id,
      processedAt: new Date(),
    });
  }

  listPayslipsByRun(user: AuthenticatedUser, runId: string) {
    this.assertRead(user);
    return this.payslips.findByRun(runId);
  }

  async getPayslipPdf(user: AuthenticatedUser, id: string) {
    this.assertRead(user);
    const payslip = await this.payslips.findById(id);
    if (!payslip) throw new NotFoundException('Payslip not found.');
    if (!payslip.pdfContent) {
      return {
        message: 'PDF not generated yet',
        payslip: {
          id: payslip.id,
          payrollRunId: payslip.payrollRunId,
          employeeId: payslip.employeeId,
          grossPay: Number(payslip.grossPay),
          deductions: Number(payslip.deductions),
          netPay: Number(payslip.netPay),
          currency: payslip.currency,
        },
      };
    }
    return {
      buffer: Buffer.from(payslip.pdfContent),
      fileName: `payslip-${payslip.id.slice(0, 8)}.pdf`,
    };
  }

  // ─── Expense claims ────────────────────────────────────────

  listExpenseClaims(user: AuthenticatedUser, query: HrExpenseClaimQueryDto) {
    this.assertRead(user);
    return this.expenseClaims.findMany({
      employeeId: query.employeeId,
      status: query.status,
    });
  }

  async getExpenseClaim(user: AuthenticatedUser, id: string) {
    this.assertRead(user);
    const row = await this.expenseClaims.findById(id);
    if (!row) throw new NotFoundException('Expense claim not found.');
    return row;
  }

  async createExpenseClaim(user: AuthenticatedUser, dto: CreateHrExpenseClaimDto) {
    this.assertRead(user);
    const employee = await this.employees.findByIdAny(dto.employeeId);
    if (!employee) throw new NotFoundException('Employee not found.');
    return this.expenseClaims.create({
      employeeId: dto.employeeId,
      title: dto.title.trim(),
      amount: dto.amount,
      currency: dto.currency ?? 'USD',
      notes: dto.notes?.trim() || null,
      status: HrExpenseClaimStatus.DRAFT,
      requestedById: user.id,
    });
  }

  async updateExpenseClaim(user: AuthenticatedUser, id: string, dto: UpdateHrExpenseClaimDto) {
    this.assertRead(user);
    const row = await this.getExpenseClaim(user, id);
    if (row.status !== HrExpenseClaimStatus.DRAFT) {
      throw new BadRequestException('Only draft expense claims can be edited.');
    }
    return this.expenseClaims.update(id, {
      ...(dto.title != null ? { title: dto.title.trim() } : {}),
      ...(dto.amount != null ? { amount: dto.amount } : {}),
      ...(dto.currency != null ? { currency: dto.currency } : {}),
      ...(dto.notes !== undefined ? { notes: dto.notes?.trim() || null } : {}),
    });
  }

  async submitExpenseClaim(user: AuthenticatedUser, id: string) {
    this.assertRead(user);
    const row = await this.getExpenseClaim(user, id);
    if (row.status !== HrExpenseClaimStatus.DRAFT) {
      throw new BadRequestException('Only draft expense claims can be submitted.');
    }
    return this.expenseClaims.update(id, { status: HrExpenseClaimStatus.SUBMITTED });
  }

  async approveExpenseClaim(user: AuthenticatedUser, id: string) {
    this.assertApprove(user);
    const row = await this.getExpenseClaim(user, id);
    if (row.status !== HrExpenseClaimStatus.SUBMITTED) {
      throw new BadRequestException('Only submitted expense claims can be approved.');
    }
    return this.expenseClaims.update(id, {
      status: HrExpenseClaimStatus.APPROVED,
      approvedById: user.id,
      decidedAt: new Date(),
    });
  }

  async rejectExpenseClaim(user: AuthenticatedUser, id: string, dto: RejectHrExpenseClaimDto) {
    this.assertApprove(user);
    const row = await this.getExpenseClaim(user, id);
    if (row.status !== HrExpenseClaimStatus.SUBMITTED) {
      throw new BadRequestException('Only submitted expense claims can be rejected.');
    }
    return this.expenseClaims.update(id, {
      status: HrExpenseClaimStatus.REJECTED,
      approvedById: user.id,
      decidedAt: new Date(),
      notes: dto.notes?.trim() || row.notes,
    });
  }

  async deleteExpenseClaim(user: AuthenticatedUser, id: string) {
    this.assertWrite(user);
    const row = await this.getExpenseClaim(user, id);
    if (row.status !== HrExpenseClaimStatus.DRAFT) {
      throw new BadRequestException('Only draft expense claims can be deleted.');
    }
    return this.expenseClaims.delete(id);
  }
}
