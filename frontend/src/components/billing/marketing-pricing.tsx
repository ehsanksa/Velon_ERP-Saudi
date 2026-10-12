import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { Check } from 'lucide-react';
import { isSaudiBilling } from '@velon/shared';
import { PricingPreferenceControl } from '@/components/billing/pricing-preference';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { loginSearch, parseSignupPlan } from '@/lib/auth/login-utils';
import {
  formatPlanEffectiveMonthly,
  formatPlanPriceForPreference,
  type MarketingBillingInterval,
  type PricingPreference,
} from '@/lib/billing/pricing-preferences';
import type { MarketingPlanCard } from '@/lib/billing/public-api';
import { useT } from '@/lib/i18n/locale-context';

type MarketingPricingSectionProps = {
  headline: string;
  subhead: string;
  plans: MarketingPlanCard[];
  preference: PricingPreference;
  hideHeadline?: boolean;
};

function BillingIntervalToggle({
  interval,
  onChange,
  showAnnualSavings,
}: {
  interval: MarketingBillingInterval;
  onChange: (interval: MarketingBillingInterval) => void;
  showAnnualSavings: boolean;
}) {
  const t = useT();

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <div className="border-border bg-background inline-flex rounded-full border p-1">
        <button
          type="button"
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
            interval === 'MONTHLY' ? 'bg-foreground text-background' : 'text-muted-foreground'
          }`}
          onClick={() => onChange('MONTHLY')}
        >
          {t('Monthly')}
        </button>
        <button
          type="button"
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
            interval === 'YEARLY' ? 'bg-foreground text-background' : 'text-muted-foreground'
          }`}
          onClick={() => onChange('YEARLY')}
        >
          {t('Annual')}
        </button>
      </div>
      {showAnnualSavings && interval === 'YEARLY' ? (
        <Badge
          variant="secondary"
          className="rounded-full bg-emerald-100 text-emerald-800 hover:bg-emerald-100"
        >
          {t('Save 16%')}
        </Badge>
      ) : null}
    </div>
  );
}

export function MarketingPricingSection({
  headline,
  subhead,
  plans,
  preference,
  hideHeadline = false,
}: MarketingPricingSectionProps) {
  const [interval, setInterval] = useState<MarketingBillingInterval>('MONTHLY');
  const t = useT();
  const saudiPricing = isSaudiBilling(preference.country, preference.currency);

  return (
    <div>
      <div className="mb-10 text-center">
        {!hideHeadline ? (
          <div className="mx-auto max-w-2xl">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t(headline)}</h2>
            <p className="text-muted-foreground mt-3 text-base leading-relaxed">{t(subhead)}</p>
          </div>
        ) : null}

        <div className="mt-8 flex flex-col items-center gap-3">
          <BillingIntervalToggle
            interval={interval}
            onChange={setInterval}
            showAnnualSavings={saudiPricing}
          />
          <PricingPreferenceControl
            preference={preference}
            compact
          />
        </div>

        {saudiPricing ? (
          <p className="text-muted-foreground mx-auto mt-5 max-w-2xl text-sm">
            <span className="text-foreground font-medium">{t('Founding offer:')}</span>
            {t(' 50% off year one for the first 1,000 customers. Renews at standard annual rates.')}
          </p>
        ) : null}
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        {plans.map((plan) => (
          <Card
            key={plan.id}
            className={`relative flex flex-col p-6 ${
              plan.featured
                ? 'border-foreground bg-foreground text-background shadow-elegant ring-foreground ring-1'
                : 'border-border bg-card'
            }`}
          >
            {plan.featured ? (
              <Badge className="bg-background text-foreground hover:bg-background absolute -top-3 left-1/2 -translate-x-1/2">
                {t('Most popular')}
              </Badge>
            ) : null}

            <p
              className={`text-sm font-semibold ${plan.featured ? 'text-background' : 'text-foreground'}`}
            >
              {t(plan.name)}
            </p>

            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-3xl font-semibold tracking-tight sm:text-4xl">
                {formatPlanPriceForPreference(plan, preference, interval)}
              </span>
              <span
                className={`text-sm ${plan.featured ? 'text-background/60' : 'text-muted-foreground'}`}
              >
                {interval === 'YEARLY' ? t('/yr') : t('/mo')}
              </span>
            </div>

            <div className="mt-1 min-h-4">
              {interval === 'YEARLY' ? (
                <p
                  className={`text-xs ${plan.featured ? 'text-background/65' : 'text-muted-foreground'}`}
                >
                  {formatPlanEffectiveMonthly(plan, preference)}
                  {t('/mo billed annually')}
                </p>
              ) : null}
            </div>

            <ul className="mt-5 flex-1 space-y-2 text-sm">
              {plan.features.map((feature) => (
                <li
                  key={feature}
                  className="flex items-start gap-2"
                >
                  <Check
                    className={`mt-0.5 h-4 w-4 shrink-0 ${plan.featured ? 'text-background' : 'text-foreground'}`}
                  />
                  <span>{t(feature)}</span>
                </li>
              ))}
            </ul>

            <Button
              asChild
              className={`mt-6 w-full ${
                plan.featured
                  ? 'bg-background text-foreground hover:bg-background/90'
                  : 'bg-foreground text-background hover:bg-foreground/90'
              }`}
            >
              <Link
                to="/login"
                search={loginSearch({
                  tab: 'signup',
                  plan: parseSignupPlan(plan.id) ?? 'STARTER',
                })}
              >
                {t('Start free trial')}
              </Link>
            </Button>
          </Card>
        ))}
      </div>

      <p className="text-muted-foreground mt-8 text-center text-xs leading-relaxed">
        {saudiPricing ? (
          <>
            {t(
              'Prices are listed in Saudi Riyal. VAT is added only when the selling entity is registered for Saudi VAT.',
            )}{' '}
            <Link
              to="/contact"
              className="text-foreground underline underline-offset-2"
            >
              {t('Contact sales')}
            </Link>{' '}
            {t('for unlimited users or custom integrations.')}
          </>
        ) : (
          <>
            <Link
              to="/contact"
              className="text-foreground underline underline-offset-2"
            >
              {t('Contact sales')}
            </Link>{' '}
            {t('for enterprise plans and custom integrations.')}
          </>
        )}
      </p>
    </div>
  );
}
