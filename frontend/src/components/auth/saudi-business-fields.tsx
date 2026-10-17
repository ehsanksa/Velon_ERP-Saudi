import { SAUDI_REGIONS, saudiWorkspaceRegistrationErrors } from '@velon/shared';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { useLocale, useT } from '@/lib/i18n/locale-context';

export type SaudiBusinessValue = {
  legalNameAr: string;
  commercialRegistrationNumber: string;
  vatRegistered: boolean;
  vatRegistrationNumber: string;
  buildingNumber: string;
  streetName: string;
  district: string;
  city: string;
  postalCode: string;
  additionalNumber: string;
  region: string;
};

export function emptySaudiBusiness(): SaudiBusinessValue {
  return {
    legalNameAr: '',
    commercialRegistrationNumber: '',
    vatRegistered: false,
    vatRegistrationNumber: '',
    buildingNumber: '',
    streetName: '',
    district: '',
    city: '',
    postalCode: '',
    additionalNumber: '',
    region: '',
  };
}

export function saudiBusinessErrors(value: SaudiBusinessValue): string[] {
  return saudiWorkspaceRegistrationErrors({
    commercialRegistrationNumber: value.commercialRegistrationNumber,
    vatRegistered: value.vatRegistered,
    vatRegistrationNumber: value.vatRegistrationNumber,
    buildingNumber: value.buildingNumber,
    streetName: value.streetName,
    district: value.district,
    city: value.city,
    postalCode: value.postalCode,
    additionalNumber: value.additionalNumber,
    region: value.region,
  });
}

export function SaudiBusinessFields({
  value,
  onChange,
}: {
  value: SaudiBusinessValue;
  onChange: (next: SaudiBusinessValue) => void;
}) {
  const t = useT();
  const { locale } = useLocale();

  return (
    <div className="border-border space-y-3 rounded-lg border p-3">
      <div>
        <p className="text-sm font-medium">{t('Saudi business details')}</p>
        <p className="text-muted-foreground text-xs">
          {t(
            'National address is required. Commercial Registration and VAT are only required when they apply to this business.',
          )}
        </p>
      </div>
      <Input
        placeholder={t('Arabic registered name (optional)')}
        value={value.legalNameAr}
        onChange={(e) => onChange({ ...value, legalNameAr: e.target.value })}
      />
      <div className="space-y-1">
        <Label>{t('Commercial Registration (optional)')}</Label>
        <Input
          inputMode="numeric"
          placeholder={t('10 digits, if the business holds a CR')}
          value={value.commercialRegistrationNumber}
          onChange={(e) =>
            onChange({
              ...value,
              commercialRegistrationNumber: e.target.value.replace(/\D/g, '').slice(0, 10),
            })
          }
        />
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-1"
          checked={value.vatRegistered}
          onChange={(e) =>
            onChange({
              ...value,
              vatRegistered: e.target.checked,
              vatRegistrationNumber: e.target.checked ? value.vatRegistrationNumber : '',
            })
          }
        />
        <span>{t('This business is registered for VAT')}</span>
      </label>
      {value.vatRegistered ? (
        <div className="space-y-1">
          <Label>{t('VAT registration number')}</Label>
          <Input
            inputMode="numeric"
            placeholder={t('15 digits')}
            value={value.vatRegistrationNumber}
            onChange={(e) =>
              onChange({
                ...value,
                vatRegistrationNumber: e.target.value.replace(/\D/g, '').slice(0, 15),
              })
            }
            required
          />
        </div>
      ) : null}
      <p className="text-sm font-medium">{t('National address')}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          inputMode="numeric"
          placeholder={t('Building number (4 digits)')}
          value={value.buildingNumber}
          onChange={(e) =>
            onChange({ ...value, buildingNumber: e.target.value.replace(/\D/g, '').slice(0, 4) })
          }
          required
        />
        <Input
          placeholder={t('Street')}
          value={value.streetName}
          onChange={(e) => onChange({ ...value, streetName: e.target.value })}
          required
        />
        <Input
          placeholder={t('District')}
          value={value.district}
          onChange={(e) => onChange({ ...value, district: e.target.value })}
          required
        />
        <Input
          placeholder={t('City')}
          value={value.city}
          onChange={(e) => onChange({ ...value, city: e.target.value })}
          required
        />
        <Input
          inputMode="numeric"
          placeholder={t('Postal code (5 digits)')}
          value={value.postalCode}
          onChange={(e) =>
            onChange({ ...value, postalCode: e.target.value.replace(/\D/g, '').slice(0, 5) })
          }
          required
        />
        <Input
          inputMode="numeric"
          placeholder={t('Additional number (4 digits)')}
          value={value.additionalNumber}
          onChange={(e) =>
            onChange({
              ...value,
              additionalNumber: e.target.value.replace(/\D/g, '').slice(0, 4),
            })
          }
          required
        />
      </div>
      <NativeSelect
        value={value.region}
        onChange={(region) => onChange({ ...value, region })}
        options={SAUDI_REGIONS.map((region) => ({
          value: region.code,
          label: locale === 'ar' ? region.nameAr : region.nameEn,
        }))}
        placeholder={t('Region')}
        required
      />
    </div>
  );
}
