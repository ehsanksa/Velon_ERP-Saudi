import {
  assessEstablishmentFile,
  assessQiwaContract,
  qiwaFindingsBlock,
  qiwaTotalWage,
  saudizationPercent,
  type QiwaContractTerms,
} from './hr-qiwa.rules';

function terms(overrides: Partial<QiwaContractTerms> = {}): QiwaContractTerms {
  return {
    contractType: 'FIXED_TERM',
    identityType: 'NATIONAL_ID',
    nationalId: '1098765432',
    employeeNameEn: 'Sara Alharbi',
    nationality: 'Saudi Arabia',
    occupationTitle: 'Accountant',
    startDate: '2026-10-01',
    endDate: '2027-09-30',
    probationDays: 90,
    dailyHours: 8,
    weeklyHours: 48,
    wageBasis: 'MONTHLY',
    basicWage: 5000,
    housingAllowance: 1250,
    transportAllowance: 500,
    otherAllowances: 0,
    noticePeriodDays: 60,
    gosiRegistered: true,
    listedOnQiwa: true,
    hasAnotherOpenContract: false,
    ...overrides,
  };
}

const runningEstablishment = {
  status: 'ACTIVE' as const,
  nameEn: 'Velon Trading',
  laborOfficeId: '1',
  sequenceNumber: '123456',
  commercialRegistrationNumber: '1010123456',
  unifiedNumber: '7001234567',
};

describe('Qiwa contract rules', () => {
  it('sums wage components in halalas', () => {
    expect(
      qiwaTotalWage({
        basicWage: 10.1,
        housingAllowance: 0.2,
        transportAllowance: 0.3,
        otherAllowances: 0.4,
      }),
    ).toBe(11);
  });

  it('computes Saudization from the Qiwa headcount snapshot', () => {
    expect(saudizationPercent(3, 7)).toBe(30);
    expect(saudizationPercent(0, 0)).toBeNull();
  });

  it('accepts a fixed-term contract that matches the Contract Management fields', () => {
    const findings = assessQiwaContract({
      terms: terms(),
      establishment: runningEstablishment,
      purpose: 'authenticate',
    });
    expect(qiwaFindingsBlock(findings)).toBe(false);
  });

  it('rejects an Iqama stored as a national ID', () => {
    const findings = assessQiwaContract({
      terms: terms({ identityType: 'NATIONAL_ID', nationalId: '2123456789' }),
      establishment: runningEstablishment,
      purpose: 'draft',
    });
    expect(findings.some((finding) => finding.code === 'identity.national')).toBe(true);
  });

  it('rejects a national ID stored as an Iqama', () => {
    const findings = assessQiwaContract({
      terms: terms({
        identityType: 'IQAMA',
        nationalId: '1098765432',
        nationality: 'Saudi Arabia',
      }),
      establishment: runningEstablishment,
      purpose: 'draft',
    });
    expect(findings.some((finding) => finding.code === 'identity.iqama')).toBe(true);
  });

  it('requires an end date on a fixed-term contract and forbids one on an indefinite contract', () => {
    const missingEnd = assessQiwaContract({
      terms: terms({ endDate: null }),
      establishment: runningEstablishment,
      purpose: 'draft',
    });
    const indefiniteWithEnd = assessQiwaContract({
      terms: terms({ contractType: 'INDEFINITE', endDate: '2027-09-30' }),
      establishment: runningEstablishment,
      purpose: 'draft',
    });
    expect(missingEnd.some((finding) => finding.code === 'contract.end')).toBe(true);
    expect(indefiniteWithEnd.some((finding) => finding.code === 'contract.indefiniteEnd')).toBe(
      true,
    );
  });

  it('blocks hours and probation outside the Labor Law limits', () => {
    const findings = assessQiwaContract({
      terms: terms({ dailyHours: 9, weeklyHours: 54, probationDays: 200 }),
      establishment: runningEstablishment,
      purpose: 'draft',
    });
    expect(findings.map((finding) => finding.code)).toEqual(
      expect.arrayContaining(['contract.dailyHours', 'contract.weeklyHours', 'contract.probation']),
    );
  });

  it('warns when probation is extended past 90 days and still within 180', () => {
    const findings = assessQiwaContract({
      terms: terms({ probationDays: 120 }),
      establishment: runningEstablishment,
      purpose: 'draft',
    });
    const finding = findings.find((item) => item.code === 'contract.probationExtension');
    expect(finding?.severity).toBe('warning');
    expect(qiwaFindingsBlock(findings)).toBe(false);
  });

  it('requires 60 days notice on an indefinite monthly contract', () => {
    const findings = assessQiwaContract({
      terms: terms({
        contractType: 'INDEFINITE',
        endDate: null,
        wageBasis: 'MONTHLY',
        noticePeriodDays: 30,
      }),
      establishment: runningEstablishment,
      purpose: 'draft',
    });
    expect(findings.some((finding) => finding.code === 'contract.notice')).toBe(true);
  });

  it('rejects a second open contract and a stopped establishment', () => {
    const findings = assessQiwaContract({
      terms: terms({ hasAnotherOpenContract: true }),
      establishment: { ...runningEstablishment, status: 'SUSPENDED' },
      purpose: 'authenticate',
    });
    expect(qiwaFindingsBlock(findings)).toBe(true);
    expect(findings.some((finding) => finding.code === 'contract.alreadyOpen')).toBe(true);
    expect(findings.some((finding) => finding.code === 'establishment.notRunning')).toBe(true);
  });

  it('requires the labor-office file before an establishment is marked active', () => {
    const findings = assessEstablishmentFile(
      {
        status: 'ACTIVE',
        nameEn: 'Velon Trading',
        laborOfficeId: '',
        sequenceNumber: '',
        commercialRegistrationNumber: '123',
      },
      'save',
    );
    expect(findings.map((finding) => finding.code)).toEqual(
      expect.arrayContaining([
        'establishment.cr',
        'establishment.laborOfficeRequired',
        'establishment.sequenceRequired',
      ]),
    );
  });
});
