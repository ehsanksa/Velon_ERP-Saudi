import { apiFetch } from '@/lib/api/client';

export type QiwaEstablishmentStatus = 'DRAFT' | 'ACTIVE' | 'SUSPENDED' | 'CLOSED';
export type QiwaNitaqatBand =
  | 'PLATINUM'
  | 'HIGH_GREEN'
  | 'MID_GREEN'
  | 'LOW_GREEN'
  | 'YELLOW'
  | 'RED'
  | 'UNKNOWN';
export type QiwaContractStatus =
  | 'DRAFT'
  | 'READY'
  | 'PENDING_EMPLOYEE'
  | 'AMENDMENT_REQUESTED'
  | 'REJECTED'
  | 'DOCUMENTED'
  | 'ENFORCEABLE'
  | 'UPDATE_PENDING'
  | 'TERMINATED'
  | 'EXPIRED';
export type QiwaContractType = 'FIXED_TERM' | 'INDEFINITE';
export type QiwaIdentityType = 'NATIONAL_ID' | 'IQAMA';
export type QiwaWageBasis = 'MONTHLY' | 'OTHER';

export type QiwaFinding = {
  code: string;
  severity: 'error' | 'warning';
  message: string;
};

export type QiwaEstablishment = {
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
  saudizationPercent: number | null;
  nitaqatRecordedAt: string | null;
  saudizationCertificateExpiresAt: string | null;
  notes: string | null;
};

export type QiwaContractSummary = {
  id: string;
  referenceCode: string;
  status: QiwaContractStatus;
  contractType: QiwaContractType;
  identityType: QiwaIdentityType;
  nationalId: string;
  employeeNameEn: string;
  nationality: string;
  occupationTitle: string;
  startDate: string | null;
  endDate: string | null;
  totalWage: number;
  currency: string;
  qiwaContractNumber: string | null;
  executionNumber: string | null;
  employeeId: string;
  employeeCode: string;
  updatedAt: string;
};

export type QiwaContractDetail = QiwaContractSummary & {
  employeeNameAr: string | null;
  jobTitle: string | null;
  probationDays: number;
  dailyHours: number;
  weeklyHours: number;
  workLocation: string | null;
  wageBasis: QiwaWageBasis;
  basicWage: number;
  housingAllowance: number;
  transportAllowance: number;
  otherAllowances: number;
  noticePeriodDays: number;
  additionalTerms: string | null;
  gosiRegistered: boolean;
  listedOnQiwa: boolean;
  amendmentNote: string | null;
  terminationReason: string | null;
  sentToEmployeeAt: string | null;
  documentedAt: string | null;
  terminatedAt: string | null;
  events: {
    id: string;
    type: string;
    fromStatus: QiwaContractStatus | null;
    toStatus: QiwaContractStatus | null;
    note: string | null;
    createdAt: string;
    actorName: string | null;
  }[];
  findings: QiwaFinding[];
  submissionPackage: unknown;
};

export type QiwaEmployeeOption = {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  status: string;
  hireDate: string | null;
  workLocation: string | null;
  baseSalary: number;
  currency: string;
  identityType: QiwaIdentityType | null;
  nationalId: string | null;
  nationality: string | null;
};

export type QiwaOverview = {
  guidelines: { steps: string[]; links: { label: string; href: string }[] };
  establishment: QiwaEstablishment | null;
  establishmentFindings: QiwaFinding[];
  counts: Record<string, number>;
  compliance: {
    undocumented: { employeeId: string; employeeCode: string; name: string }[];
    awaitingEmployee: { contractId: string; referenceCode: string; name: string; since: string }[];
    endingSoon: {
      contractId: string;
      referenceCode: string;
      name: string;
      endDate: string | null;
    }[];
    wageMismatches: {
      contractId: string;
      referenceCode: string;
      name: string;
      contractWage: number;
      employeeSalary: number;
    }[];
  };
  contracts: QiwaContractSummary[];
  employees: QiwaEmployeeOption[];
};

export type QiwaContractInput = {
  employeeId: string;
  contractType: QiwaContractType;
  identityType: QiwaIdentityType;
  nationalId: string;
  employeeNameEn?: string;
  employeeNameAr?: string;
  nationality: string;
  occupationTitle: string;
  jobTitle?: string;
  startDate: string;
  endDate?: string;
  probationDays?: number;
  dailyHours?: number;
  weeklyHours?: number;
  workLocation?: string;
  wageBasis?: QiwaWageBasis;
  basicWage: number;
  housingAllowance?: number;
  transportAllowance?: number;
  otherAllowances?: number;
  noticePeriodDays?: number;
  additionalTerms?: string;
  gosiRegistered?: boolean;
  listedOnQiwa?: boolean;
};

export const QIWA_STATUS_LABEL: Record<QiwaContractStatus, string> = {
  DRAFT: 'Draft',
  READY: 'Ready for Qiwa',
  PENDING_EMPLOYEE: 'Awaiting employee',
  AMENDMENT_REQUESTED: 'Amendment requested',
  REJECTED: 'Rejected',
  DOCUMENTED: 'Documented',
  ENFORCEABLE: 'Enforceable',
  UPDATE_PENDING: 'Update awaiting employee',
  TERMINATED: 'Terminated',
  EXPIRED: 'Expired',
};

export const QIWA_NITAQAT_LABEL: Record<QiwaNitaqatBand, string> = {
  PLATINUM: 'Platinum',
  HIGH_GREEN: 'High green',
  MID_GREEN: 'Mid green',
  LOW_GREEN: 'Low green',
  YELLOW: 'Yellow',
  RED: 'Red',
  UNKNOWN: 'Not recorded',
};

export function loadQiwaOverview() {
  return apiFetch<QiwaOverview>('/hr/qiwa/overview');
}

export function saveQiwaEstablishment(data: {
  nameEn: string;
  nameAr?: string;
  laborOfficeId?: string;
  sequenceNumber?: string;
  commercialRegistrationNumber?: string;
  unifiedNumber?: string;
  economicActivity?: string;
  status?: QiwaEstablishmentStatus;
  notes?: string;
}) {
  return apiFetch<{ establishment: QiwaEstablishment; findings: QiwaFinding[] }>(
    '/hr/qiwa/establishment',
    { method: 'POST', body: JSON.stringify(data) },
  );
}

export function recordQiwaNitaqat(data: {
  nitaqatBand: QiwaNitaqatBand;
  saudiCount?: number;
  nonSaudiCount?: number;
  saudizationCertificateExpiresAt?: string;
}) {
  return apiFetch<QiwaEstablishment>('/hr/qiwa/establishment/nitaqat', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function createQiwaContract(data: QiwaContractInput) {
  return apiFetch<QiwaContractDetail>('/hr/qiwa/contracts', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateQiwaContract(id: string, data: Partial<QiwaContractInput>) {
  return apiFetch<QiwaContractDetail>(`/hr/qiwa/contracts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function getQiwaContract(id: string) {
  return apiFetch<QiwaContractDetail>(`/hr/qiwa/contracts/${id}`);
}

export function validateQiwaContract(id: string) {
  return apiFetch<{ contract: QiwaContractDetail; findings: QiwaFinding[] }>(
    `/hr/qiwa/contracts/${id}/validate`,
    { method: 'POST' },
  );
}

export function sendQiwaContract(id: string) {
  return apiFetch<QiwaContractDetail>(`/hr/qiwa/contracts/${id}/send`, { method: 'POST' });
}

export function recordQiwaEmployeeResponse(
  id: string,
  data: {
    decision: 'APPROVED' | 'REJECTED' | 'AMENDMENT';
    note?: string;
    qiwaContractNumber?: string;
  },
) {
  return apiFetch<QiwaContractDetail>(`/hr/qiwa/contracts/${id}/employee-response`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function recordQiwaExecutionNumber(id: string, executionNumber: string) {
  return apiFetch<QiwaContractDetail>(`/hr/qiwa/contracts/${id}/execution-number`, {
    method: 'POST',
    body: JSON.stringify({ executionNumber }),
  });
}

export function requestQiwaContractUpdate(id: string, data: Partial<QiwaContractInput>) {
  return apiFetch<QiwaContractDetail>(`/hr/qiwa/contracts/${id}/request-update`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function terminateQiwaContract(id: string, reason: string, terminatedOn?: string) {
  return apiFetch<QiwaContractDetail>(`/hr/qiwa/contracts/${id}/terminate`, {
    method: 'POST',
    body: JSON.stringify({ reason, terminatedOn }),
  });
}

export function expireQiwaContract(id: string) {
  return apiFetch<QiwaContractDetail>(`/hr/qiwa/contracts/${id}/expire`, { method: 'POST' });
}

export function deleteQiwaContract(id: string) {
  return apiFetch<{ deleted: boolean }>(`/hr/qiwa/contracts/${id}`, { method: 'DELETE' });
}
