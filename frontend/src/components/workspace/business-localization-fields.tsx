import { useMemo } from 'react';
import {
  DATE_FORMAT_OPTIONS,
  defaultDateFormatForCountry,
  defaultNumberFormatForCountry,
  defaultTimezoneForCountry,
  formatCurrencyLabel,
  NUMBER_FORMAT_OPTIONS,
  TIMEZONE_OPTIONS,
  type CountryCode,
} from '@velon/shared';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { useLocale, useT } from '@/lib/i18n/locale-context';
import {
  countryOptions,
  currencyOptions,
  getCountryDefaultCurrency,
} from '@/lib/shared/country-currency-catalog';

export type BusinessLocalizationValue = {
  countryCode: CountryCode | string;
  currency: string;
  timezone: string;
  dateFormat: string;
  numberFormat: string;
  address?: string;
  taxId?: string;
};

type Props = {
  value: BusinessLocalizationValue;
  onChange: (next: BusinessLocalizationValue) => void;
  showAddress?: boolean;
  showTaxId?: boolean;
  showFormats?: boolean;
  idPrefix?: string;
};

export function createDefaultLocalization(countryCode = 'SA'): BusinessLocalizationValue {
  const code = countryCode as CountryCode;
  return {
    countryCode: code,
    currency: getCountryDefaultCurrency(code),
    timezone: defaultTimezoneForCountry(code),
    dateFormat: defaultDateFormatForCountry(code),
    numberFormat: defaultNumberFormatForCountry(code),
    address: '',
    taxId: '',
  };
}

export function BusinessLocalizationFields({
  value,
  onChange,
  showAddress = false,
  showTaxId = false,
  showFormats = true,
  idPrefix = 'biz',
}: Props) {
  const t = useT();
  const { locale } = useLocale();
  const countrySelectOptions = useMemo(() => {
    let names: Intl.DisplayNames | null = null;
    try {
      names = new Intl.DisplayNames([locale === 'ar' ? 'ar' : 'en'], { type: 'region' });
    } catch {
      names = null;
    }
    return countryOptions.map((row): { value: string; label: string } => {
      if (row.value === 'OTHER') return { value: row.value, label: t(row.label) };
      let label: string = row.label;
      try {
        label = names?.of(row.value) || row.label;
      } catch {
        label = row.label;
      }
      return { value: row.value, label };
    });
  }, [locale, t]);

  const currencySelectOptions = useMemo(
    () =>
      currencyOptions.map((row) => ({ value: row.value, label: formatCurrencyLabel(row.value) })),
    [],
  );

  function applyCountry(countryCode: string) {
    const code = countryCode as CountryCode;
    onChange({
      ...value,
      countryCode: code,
      currency: getCountryDefaultCurrency(code),
      timezone: defaultTimezoneForCountry(code),
      dateFormat: defaultDateFormatForCountry(code),
      numberFormat: defaultNumberFormatForCountry(code),
    });
  }

  return (
    <div className="grid gap-4">
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-country`}>{t('Country *')}</Label>
        <SearchableSelect
          id={`${idPrefix}-country`}
          value={value.countryCode}
          onChange={applyCountry}
          options={countrySelectOptions}
          placeholder={t('Select country')}
          searchPlaceholder={t('Search countries…')}
          emptyMessage={t('No country found.')}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-currency`}>{t('Currency *')}</Label>
        <NativeSelect
          id={`${idPrefix}-currency`}
          value={value.currency}
          onChange={(currency) => onChange({ ...value, currency })}
          options={currencySelectOptions}
          placeholder={t('Select currency')}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-timezone`}>{t('Timezone *')}</Label>
        <NativeSelect
          id={`${idPrefix}-timezone`}
          value={value.timezone}
          onChange={(timezone) => onChange({ ...value, timezone })}
          options={TIMEZONE_OPTIONS.map((row) => ({ value: row.value, label: row.label }))}
          placeholder={t('Select timezone')}
          required
        />
      </div>

      {showFormats ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-date-format`}>{t('Date format')}</Label>
            <NativeSelect
              id={`${idPrefix}-date-format`}
              value={value.dateFormat}
              onChange={(dateFormat) => onChange({ ...value, dateFormat })}
              options={DATE_FORMAT_OPTIONS.map((row) => ({ value: row.value, label: row.label }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-number-format`}>{t('Number format')}</Label>
            <NativeSelect
              id={`${idPrefix}-number-format`}
              value={value.numberFormat}
              onChange={(numberFormat) => onChange({ ...value, numberFormat })}
              options={NUMBER_FORMAT_OPTIONS.map((row) => ({ value: row.value, label: row.label }))}
            />
          </div>
        </div>
      ) : null}

      {showAddress ? (
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-address`}>{t('Business address *')}</Label>
          <Input
            id={`${idPrefix}-address`}
            value={value.address ?? ''}
            onChange={(e) => onChange({ ...value, address: e.target.value })}
            placeholder={t('Street, city, postal code')}
            required
          />
        </div>
      ) : null}

      {showTaxId ? (
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-tax-id`}>{t('Tax / VAT registration number')}</Label>
          <Input
            id={`${idPrefix}-tax-id`}
            value={value.taxId ?? ''}
            onChange={(e) => onChange({ ...value, taxId: e.target.value })}
            placeholder={t('Optional')}
          />
        </div>
      ) : null}
    </div>
  );
}
