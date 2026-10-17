import { saudiWorkspaceRegistrationErrors, validateSaudiCompanyIdentifiers } from './saudi-address';

describe('Saudi company identifiers', () => {
  it('accepts a complete optional national address', () => {
    expect(
      validateSaudiCompanyIdentifiers({
        commercialRegistrationNumber: '1010123456',
        vatRegistrationNumber: '399999999900003',
        buildingNumber: '1234',
        postalCode: '12211',
        additionalNumber: '5678',
      }),
    ).toEqual([]);
  });

  it('allows blank optional identifiers', () => {
    expect(validateSaudiCompanyIdentifiers({})).toEqual([]);
  });

  it('rejects a partial VAT number', () => {
    const errors = validateSaudiCompanyIdentifiers({ vatRegistrationNumber: '123' });
    expect(errors[0]).toContain('15 digits');
  });

  it('requires the national address for Saudi registration and keeps CR and VAT conditional', () => {
    const missing = saudiWorkspaceRegistrationErrors({});
    expect(missing.join(' ')).toContain('Building number');
    expect(missing.join(' ')).not.toContain('Commercial Registration');

    const vatMissing = saudiWorkspaceRegistrationErrors({
      vatRegistered: true,
      buildingNumber: '1234',
      streetName: 'King Fahd Road',
      district: 'Al Olaya',
      city: 'Riyadh',
      postalCode: '12211',
      additionalNumber: '5678',
      region: 'Riyadh',
    });
    expect(vatMissing.join(' ')).toContain('VAT registration number is required');

    expect(
      saudiWorkspaceRegistrationErrors({
        commercialRegistrationNumber: '1010123456',
        buildingNumber: '1234',
        streetName: 'King Fahd Road',
        district: 'Al Olaya',
        city: 'Riyadh',
        postalCode: '12211',
        additionalNumber: '5678',
        region: 'RD',
      }),
    ).toEqual([]);
  });
});
