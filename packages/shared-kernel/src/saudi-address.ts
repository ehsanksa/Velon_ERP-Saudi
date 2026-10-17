/** Administrative regions of the Kingdom of Saudi Arabia. */
export const SAUDI_REGIONS = [
  { code: 'RD', nameEn: 'Riyadh', nameAr: 'الرياض' },
  { code: 'MK', nameEn: 'Makkah', nameAr: 'مكة المكرمة' },
  { code: 'MD', nameEn: 'Madinah', nameAr: 'المدينة المنورة' },
  { code: 'QS', nameEn: 'Qassim', nameAr: 'القصيم' },
  { code: 'EP', nameEn: 'Eastern Province', nameAr: 'المنطقة الشرقية' },
  { code: 'AS', nameEn: 'Asir', nameAr: 'عسير' },
  { code: 'TB', nameEn: 'Tabuk', nameAr: 'تبوك' },
  { code: 'HA', nameEn: 'Hail', nameAr: 'حائل' },
  { code: 'NB', nameEn: 'Northern Borders', nameAr: 'الحدود الشمالية' },
  { code: 'JZ', nameEn: 'Jazan', nameAr: 'جازان' },
  { code: 'NJ', nameEn: 'Najran', nameAr: 'نجران' },
  { code: 'BA', nameEn: 'Al Bahah', nameAr: 'الباحة' },
  { code: 'JF', nameEn: 'Al Jawf', nameAr: 'الجوف' },
] as const;

export type SaudiCompanyIdentifiers = {
  commercialRegistrationNumber?: string | null;
  vatRegistrationNumber?: string | null;
  buildingNumber?: string | null;
  postalCode?: string | null;
  additionalNumber?: string | null;
};

export type SaudiWorkspaceRegistration = SaudiCompanyIdentifiers & {
  vatRegistered?: boolean;
  streetName?: string | null;
  district?: string | null;
  city?: string | null;
  region?: string | null;
};

/** Signup rules for a Saudi workspace. CR and VAT stay conditional; the national address does not. */
export function saudiWorkspaceRegistrationErrors(input: SaudiWorkspaceRegistration): string[] {
  const errors = validateSaudiCompanyIdentifiers(input);
  const required: Array<[string | null | undefined, string]> = [
    [
      input.buildingNumber,
      'Building number is required for the Saudi national address (4 digits).',
    ],
    [input.streetName, 'Street name is required for the Saudi national address.'],
    [input.district, 'District is required for the Saudi national address.'],
    [input.city, 'City is required for the Saudi national address.'],
    [input.postalCode, 'Postal code is required for the Saudi national address (5 digits).'],
    [
      input.additionalNumber,
      'Additional number is required for the Saudi national address (4 digits).',
    ],
    [input.region, 'Region is required for the Saudi national address.'],
  ];
  for (const [value, message] of required) {
    if (!value?.trim()) errors.push(message);
  }
  const region = input.region?.trim();
  if (
    region &&
    !SAUDI_REGIONS.some(
      (row) => row.code === region || row.nameEn === region || row.nameAr === region,
    )
  ) {
    errors.push('Select a region of Saudi Arabia.');
  }
  if (input.vatRegistered && !input.vatRegistrationNumber?.trim()) {
    errors.push('VAT registration number is required when the business is VAT registered.');
  }
  return errors;
}

export function saudiRegionName(region: string | null | undefined): string | null {
  const value = region?.trim();
  if (!value) return null;
  const match = SAUDI_REGIONS.find(
    (row) => row.code === value || row.nameEn === value || row.nameAr === value,
  );
  return match?.nameEn ?? null;
}

export function validateSaudiCompanyIdentifiers(input: SaudiCompanyIdentifiers): string[] {
  const errors: string[] = [];
  const cr = input.commercialRegistrationNumber?.trim();
  if (cr && !/^\d{10}$/.test(cr)) {
    errors.push('Commercial Registration number must be 10 digits when provided.');
  }
  const vat = input.vatRegistrationNumber?.trim();
  if (vat && !/^\d{15}$/.test(vat)) {
    errors.push('VAT registration number must be 15 digits when provided.');
  }
  const building = input.buildingNumber?.trim();
  if (building && !/^\d{4}$/.test(building)) {
    errors.push('National address building number must be 4 digits when provided.');
  }
  const postal = input.postalCode?.trim();
  if (postal && !/^\d{5}$/.test(postal)) {
    errors.push('Postal code must be 5 digits when provided.');
  }
  const additional = input.additionalNumber?.trim();
  if (additional && !/^\d{4}$/.test(additional)) {
    errors.push('National address additional number must be 4 digits when provided.');
  }
  return errors;
}
