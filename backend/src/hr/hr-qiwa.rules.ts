/**
 * Checks for the HRSD Contract Management service on Qiwa.
 * Qiwa authenticates the contract. This module only decides whether the
 * establishment file and terms are ready to take to that service.
 *
 * Sources:
 * - https://www.hrsd.gov.sa/en/ministry-services/services/%D8%A5%D8%AF%D8%A7%D8%B1%D8%A9-%D8%A7%D9%84%D8%B9%D9%82%D9%88%D8%AF
 * - https://www.hrsd.gov.sa/sites/default/files/2023-02/E75506.pdf
 * - https://www.hrsd.gov.sa/sites/default/files/2025-10/aldlyl-ala-rshady-lmbadrt--qd-al-ml-almwthq-sndana-tnfydhyana---en.pdf
 * - Saudi Labor Law: probation (Art. 53), working hours (Art. 98), notice (Art. 75)
 */

export const QIWA_LINKS = [
  { label: 'Qiwa', href: 'https://qiwa.sa/en' },
  { label: 'Qiwa sign-in (Nafath)', href: 'https://sso.qiwa.sa' },
  {
    label: 'HRSD Contract Management',
    href: 'https://www.hrsd.gov.sa/en/ministry-services/services/%D8%A5%D8%AF%D8%A7%D8%B1%D8%A9-%D8%A7%D9%84%D8%B9%D9%82%D9%88%D8%AF',
  },
  {
    label: 'Enforceable contract guideline',
    href: 'https://www.hrsd.gov.sa/sites/default/files/2025-10/aldlyl-ala-rshady-lmbadrt--qd-al-ml-almwthq-sndana-tnfydhyana---en.pdf',
  },
] as const;

export const QIWA_AUTHENTICATION_STEPS = [
  'Sign in to Qiwa Business with Nafath and select the establishment.',
  'Open Contract Management and Documentation.',
  'Confirm the establishment is running.',
  'Add the employee with identity number, profession, and wage if they are not already on the file.',
  'Enter the contract: profession, duration, working hours, and financial obligations.',
  'Send the contract to the employee. They approve, reject, or request an amendment in Qiwa Individuals.',
  'When both parties agree, record the contract as documented. The Ministry treats that contract as authenticated.',
  'If Qiwa issues a Ministry of Justice execution number, record it here. That makes the contract an enforceable instrument.',
] as const;

export const OPEN_QIWA_CONTRACT_STATUSES = [
  'DRAFT',
  'READY',
  'PENDING_EMPLOYEE',
  'AMENDMENT_REQUESTED',
  'DOCUMENTED',
  'ENFORCEABLE',
  'UPDATE_PENDING',
] as const;

export const DOCUMENTED_QIWA_CONTRACT_STATUSES = [
  'DOCUMENTED',
  'ENFORCEABLE',
  'UPDATE_PENDING',
] as const;

export type QiwaFinding = {
  code: string;
  severity: 'error' | 'warning';
  message: string;
};

export type QiwaEstablishmentCheck = {
  status: 'DRAFT' | 'ACTIVE' | 'SUSPENDED' | 'CLOSED';
  nameEn: string;
  laborOfficeId?: string | null;
  sequenceNumber?: string | null;
  commercialRegistrationNumber?: string | null;
  unifiedNumber?: string | null;
};

export type QiwaContractTerms = {
  contractType: 'FIXED_TERM' | 'INDEFINITE';
  identityType: 'NATIONAL_ID' | 'IQAMA';
  nationalId: string;
  employeeNameEn: string;
  nationality: string;
  occupationTitle: string;
  startDate: string;
  endDate?: string | null;
  probationDays: number;
  dailyHours: number;
  weeklyHours: number;
  wageBasis: 'MONTHLY' | 'OTHER';
  basicWage: number;
  housingAllowance: number;
  transportAllowance: number;
  otherAllowances: number;
  statedTotalWage?: number | null;
  noticePeriodDays: number;
  gosiRegistered: boolean;
  listedOnQiwa: boolean;
  hireDate?: string | null;
  hasAnotherOpenContract: boolean;
};

const MONEY = 0.009;

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function qiwaTotalWage(parts: {
  basicWage: number;
  housingAllowance: number;
  transportAllowance: number;
  otherAllowances: number;
}): number {
  return roundMoney(
    parts.basicWage + parts.housingAllowance + parts.transportAllowance + parts.otherAllowances,
  );
}

export function saudizationPercent(saudiCount: number, nonSaudiCount: number): number | null {
  const total = saudiCount + nonSaudiCount;
  if (!Number.isFinite(total) || total <= 0) return null;
  return Math.round((saudiCount / total) * 10000) / 100;
}

function push(
  findings: QiwaFinding[],
  severity: QiwaFinding['severity'],
  code: string,
  message: string,
) {
  findings.push({ severity, code, message });
}

export function assessEstablishmentFile(
  input: QiwaEstablishmentCheck | null,
  purpose: 'save' | 'authenticate',
): QiwaFinding[] {
  const findings: QiwaFinding[] = [];
  if (!input) {
    push(
      findings,
      'error',
      'establishment.missing',
      'Save the establishment file before preparing a Qiwa contract.',
    );
    return findings;
  }

  const name = input.nameEn.trim();
  if (name.length < 2) {
    push(findings, 'error', 'establishment.name', 'Enter the establishment name in English.');
  }

  const office = input.laborOfficeId?.trim() ?? '';
  const sequence = input.sequenceNumber?.trim() ?? '';
  const cr = input.commercialRegistrationNumber?.trim() ?? '';
  const unified = input.unifiedNumber?.trim() ?? '';

  if (office && !/^\d{1,4}$/.test(office)) {
    push(
      findings,
      'error',
      'establishment.laborOffice',
      'Labor office number must be 1 to 4 digits, as shown on the Qiwa establishment file.',
    );
  }
  if (sequence && !/^\d{1,10}$/.test(sequence)) {
    push(
      findings,
      'error',
      'establishment.sequence',
      'Establishment sequence number must contain digits only.',
    );
  }
  if (cr && !/^\d{10}$/.test(cr)) {
    push(findings, 'error', 'establishment.cr', 'Commercial registration must be 10 digits.');
  }
  if (unified && !/^700\d{7}$/.test(unified)) {
    push(
      findings,
      'error',
      'establishment.unified',
      'The unified number is 10 digits and starts with 700.',
    );
  }

  const activating = purpose === 'authenticate' || input.status === 'ACTIVE';
  if (activating) {
    if (input.status !== 'ACTIVE') {
      push(
        findings,
        'error',
        'establishment.notRunning',
        'Qiwa only authenticates contracts for a running establishment. Set the file to active.',
      );
    }
    if (!office) {
      push(
        findings,
        'error',
        'establishment.laborOfficeRequired',
        'Labor office number is required on an active Qiwa file.',
      );
    }
    if (!sequence) {
      push(
        findings,
        'error',
        'establishment.sequenceRequired',
        'Establishment sequence number is required on an active Qiwa file.',
      );
    }
    if (!cr) {
      push(
        findings,
        'error',
        'establishment.crRequired',
        'Commercial registration is required on an active Qiwa file.',
      );
    }
  }

  return findings;
}

export function assessQiwaContract(input: {
  terms: QiwaContractTerms;
  establishment: QiwaEstablishmentCheck | null;
  purpose: 'draft' | 'authenticate';
}): QiwaFinding[] {
  const findings: QiwaFinding[] = [];
  const terms = input.terms;

  if (input.purpose === 'authenticate') {
    findings.push(...assessEstablishmentFile(input.establishment, 'authenticate'));
  }

  const nationalId = terms.nationalId.trim();
  if (!/^\d{10}$/.test(nationalId)) {
    push(
      findings,
      'error',
      'identity.format',
      'Identity number must be 10 digits (national ID or Iqama).',
    );
  } else if (terms.identityType === 'NATIONAL_ID' && !nationalId.startsWith('1')) {
    push(
      findings,
      'error',
      'identity.national',
      'A Saudi national ID starts with 1. Use Iqama for a number that starts with 2.',
    );
  } else if (terms.identityType === 'IQAMA' && !nationalId.startsWith('2')) {
    push(
      findings,
      'error',
      'identity.iqama',
      'An Iqama number starts with 2. Use national ID for a number that starts with 1.',
    );
  }

  if (terms.employeeNameEn.trim().length < 2) {
    push(
      findings,
      'error',
      'employee.name',
      'Enter the employee name as it should appear on the contract.',
    );
  }
  if (terms.nationality.trim().length < 2) {
    push(findings, 'error', 'employee.nationality', 'Enter the employee nationality.');
  }
  if (
    terms.identityType === 'NATIONAL_ID' &&
    terms.nationality.trim() &&
    !/saudi/i.test(terms.nationality)
  ) {
    push(
      findings,
      'warning',
      'employee.nationality',
      'A national ID is for a Saudi national. Confirm the nationality before authenticating on Qiwa.',
    );
  }
  if (terms.occupationTitle.trim().length < 2) {
    push(
      findings,
      'error',
      'contract.occupation',
      'Enter the profession. Qiwa uses it as the occupation on the authenticated contract.',
    );
  }

  if (terms.hasAnotherOpenContract) {
    push(
      findings,
      'error',
      'contract.alreadyOpen',
      'This employee already has an open Qiwa contract. Qiwa does not authenticate a second valid contract for the same employee.',
    );
  }

  const start = terms.startDate.slice(0, 10);
  const end = terms.endDate?.slice(0, 10) || '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) {
    push(findings, 'error', 'contract.start', 'Enter the contract start date.');
  }
  if (terms.contractType === 'FIXED_TERM') {
    if (!end) {
      push(findings, 'error', 'contract.end', 'A fixed-term contract needs an end date.');
    } else if (end < start) {
      push(
        findings,
        'error',
        'contract.endOrder',
        'The end date must be on or after the start date.',
      );
    }
  } else if (end) {
    push(
      findings,
      'error',
      'contract.indefiniteEnd',
      'An indefinite contract on Qiwa has no end date. Clear it, or change the contract to fixed-term.',
    );
  }

  if (terms.probationDays < 0 || terms.probationDays > 180) {
    push(
      findings,
      'error',
      'contract.probation',
      'Probation cannot exceed 180 days. The Labor Law allows 90 days, extendable in writing up to 180.',
    );
  } else if (terms.probationDays > 90) {
    push(
      findings,
      'warning',
      'contract.probationExtension',
      'Probation above 90 days needs a written extension and still cannot pass 180 days.',
    );
  }

  if (terms.dailyHours <= 0 || terms.dailyHours > 8) {
    push(
      findings,
      'error',
      'contract.dailyHours',
      'Daily working hours must be greater than 0 and no more than 8.',
    );
  }
  if (terms.weeklyHours <= 0 || terms.weeklyHours > 48) {
    push(
      findings,
      'error',
      'contract.weeklyHours',
      'Weekly working hours must be greater than 0 and no more than 48.',
    );
  } else if (terms.weeklyHours + MONEY < terms.dailyHours) {
    push(
      findings,
      'error',
      'contract.hoursMismatch',
      'Weekly hours cannot be lower than the daily hours.',
    );
  }

  const wages = [
    terms.basicWage,
    terms.housingAllowance,
    terms.transportAllowance,
    terms.otherAllowances,
  ];
  if (wages.some((amount) => !Number.isFinite(amount) || amount < 0)) {
    push(findings, 'error', 'wage.negative', 'Wage components cannot be negative.');
  }
  const total = qiwaTotalWage(terms);
  if (total <= 0) {
    push(
      findings,
      'error',
      'wage.total',
      'Enter the financial obligations. Qiwa requires a wage greater than zero.',
    );
  }
  if (
    terms.statedTotalWage != null &&
    Number.isFinite(terms.statedTotalWage) &&
    Math.abs(roundMoney(terms.statedTotalWage) - total) > MONEY
  ) {
    push(
      findings,
      'error',
      'wage.sum',
      'Total wage must equal basic wage plus housing, transport, and other allowances.',
    );
  }

  if (
    terms.contractType === 'INDEFINITE' &&
    terms.wageBasis === 'MONTHLY' &&
    terms.noticePeriodDays < 60
  ) {
    push(
      findings,
      'error',
      'contract.notice',
      'An indefinite contract paid monthly needs at least 60 days written notice.',
    );
  } else if (
    terms.contractType === 'INDEFINITE' &&
    terms.wageBasis === 'OTHER' &&
    terms.noticePeriodDays < 30
  ) {
    push(
      findings,
      'error',
      'contract.notice',
      'An indefinite contract that is not paid monthly needs at least 30 days written notice.',
    );
  } else if (terms.noticePeriodDays < 0 || terms.noticePeriodDays > 365) {
    push(
      findings,
      'error',
      'contract.noticeRange',
      'Notice period must be between 0 and 365 days.',
    );
  }

  if (!terms.listedOnQiwa) {
    push(
      findings,
      'warning',
      'employee.qiwaFile',
      'Add the employee on the Qiwa establishment file before creating the contract there.',
    );
  }
  if (!terms.gosiRegistered) {
    push(
      findings,
      'warning',
      'employee.gosi',
      'GOSI registration is a separate obligation. A mismatch often stops the employee from appearing on Qiwa.',
    );
  }

  if (terms.hireDate && terms.hireDate.slice(0, 10) !== start) {
    push(
      findings,
      'warning',
      'contract.hireDate',
      'The contract start date differs from the employee hire date. Qiwa should match the date work actually starts.',
    );
  }

  return findings;
}

export function qiwaFindingsBlock(findings: QiwaFinding[]): boolean {
  return findings.some((finding) => finding.severity === 'error');
}

export type QiwaSubmissionPackage = {
  service: 'HRSD Contract Management';
  platform: 'Qiwa';
  establishment: {
    nameEn: string;
    nameAr: string | null;
    laborOfficeId: string | null;
    sequenceNumber: string | null;
    commercialRegistrationNumber: string | null;
    unifiedNumber: string | null;
  };
  employee: {
    nameEn: string;
    nameAr: string | null;
    identityType: 'NATIONAL_ID' | 'IQAMA';
    nationalId: string;
    nationality: string;
    listedOnEstablishmentFile: boolean;
    gosiRegistered: boolean;
  };
  contract: {
    type: 'FIXED_TERM' | 'INDEFINITE';
    occupation: string;
    jobTitle: string | null;
    startDate: string;
    endDate: string | null;
    probationDays: number;
    dailyHours: number;
    weeklyHours: number;
    workLocation: string | null;
    wageBasis: 'MONTHLY' | 'OTHER';
    basicWage: number;
    housingAllowance: number;
    transportAllowance: number;
    otherAllowances: number;
    totalWage: number;
    currency: 'SAR';
    noticePeriodDays: number;
    additionalTerms: string | null;
  };
  authentication: {
    employeeChannel: 'Qiwa Individuals';
    steps: readonly string[];
  };
};

export function buildQiwaSubmissionPackage(input: {
  establishment: {
    nameEn: string;
    nameAr?: string | null;
    laborOfficeId?: string | null;
    sequenceNumber?: string | null;
    commercialRegistrationNumber?: string | null;
    unifiedNumber?: string | null;
  };
  employeeNameEn: string;
  employeeNameAr?: string | null;
  identityType: 'NATIONAL_ID' | 'IQAMA';
  nationalId: string;
  nationality: string;
  listedOnQiwa: boolean;
  gosiRegistered: boolean;
  contractType: 'FIXED_TERM' | 'INDEFINITE';
  occupationTitle: string;
  jobTitle?: string | null;
  startDate: string;
  endDate?: string | null;
  probationDays: number;
  dailyHours: number;
  weeklyHours: number;
  workLocation?: string | null;
  wageBasis: 'MONTHLY' | 'OTHER';
  basicWage: number;
  housingAllowance: number;
  transportAllowance: number;
  otherAllowances: number;
  totalWage: number;
  noticePeriodDays: number;
  additionalTerms?: string | null;
}): QiwaSubmissionPackage {
  return {
    service: 'HRSD Contract Management',
    platform: 'Qiwa',
    establishment: {
      nameEn: input.establishment.nameEn,
      nameAr: input.establishment.nameAr ?? null,
      laborOfficeId: input.establishment.laborOfficeId ?? null,
      sequenceNumber: input.establishment.sequenceNumber ?? null,
      commercialRegistrationNumber: input.establishment.commercialRegistrationNumber ?? null,
      unifiedNumber: input.establishment.unifiedNumber ?? null,
    },
    employee: {
      nameEn: input.employeeNameEn,
      nameAr: input.employeeNameAr ?? null,
      identityType: input.identityType,
      nationalId: input.nationalId,
      nationality: input.nationality,
      listedOnEstablishmentFile: input.listedOnQiwa,
      gosiRegistered: input.gosiRegistered,
    },
    contract: {
      type: input.contractType,
      occupation: input.occupationTitle,
      jobTitle: input.jobTitle ?? null,
      startDate: input.startDate,
      endDate: input.endDate ?? null,
      probationDays: input.probationDays,
      dailyHours: input.dailyHours,
      weeklyHours: input.weeklyHours,
      workLocation: input.workLocation ?? null,
      wageBasis: input.wageBasis,
      basicWage: input.basicWage,
      housingAllowance: input.housingAllowance,
      transportAllowance: input.transportAllowance,
      otherAllowances: input.otherAllowances,
      totalWage: input.totalWage,
      currency: 'SAR',
      noticePeriodDays: input.noticePeriodDays,
      additionalTerms: input.additionalTerms ?? null,
    },
    authentication: {
      employeeChannel: 'Qiwa Individuals',
      steps: QIWA_AUTHENTICATION_STEPS,
    },
  };
}
