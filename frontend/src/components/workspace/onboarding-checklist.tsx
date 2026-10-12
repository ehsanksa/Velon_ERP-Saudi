import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { CheckCircle2, Circle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useT } from '@/lib/i18n/locale-context';
import { cn } from '@/lib/utils';
import {
  buildOnboardingSteps,
  dismissOnboarding,
  isOnboardingDismissed,
  onboardingProgress,
  type OnboardingStep,
} from '@/lib/workspace/onboarding-progress';

type DashboardData = Parameters<typeof buildOnboardingSteps>[0];

export function OnboardingChecklist({ data }: { data: DashboardData }) {
  const steps = buildOnboardingSteps(data);
  const progress = onboardingProgress(steps);
  const [dismissed, setDismissed] = useState(isOnboardingDismissed);
  const t = useT();

  if (dismissed || progress.done === progress.total) return null;

  function handleDismiss() {
    dismissOnboarding();
    setDismissed(true);
  }

  return (
    <Card className="border-primary/20 from-primary/5 bg-gradient-to-br to-transparent p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-primary text-[11px] font-medium tracking-wider uppercase">
            {t('Getting started')}
          </p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight">
            {t('Set up Velon in a few easy steps')}
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            {t('Complete these to start billing, selling, and tracking your business.')}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground h-8 w-8 shrink-0"
          onClick={handleDismiss}
          aria-label={t('Dismiss checklist')}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Progress
          value={progress.percent}
          className="h-2 flex-1"
        />
        <span className="text-muted-foreground text-xs font-medium tabular-nums">
          {progress.done}/{progress.total}
        </span>
      </div>

      <ul className="mt-4 space-y-2">
        {steps.map((step) => (
          <OnboardingStepRow
            key={step.id}
            step={step}
          />
        ))}
      </ul>
    </Card>
  );
}

function OnboardingStepRow({ step }: { step: OnboardingStep }) {
  const Icon = step.icon;
  const t = useT();

  if (step.done) {
    return (
      <li className="bg-muted/40 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm">
        <CheckCircle2
          className="h-4 w-4 shrink-0 text-emerald-600"
          aria-hidden
        />
        <span className="text-muted-foreground line-through">{t(step.label)}</span>
      </li>
    );
  }

  return (
    <li>
      <Link
        to={step.to}
        search={step.search}
        className={cn(
          'border-border bg-card flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition',
          'hover:border-primary/30 hover:bg-muted/30',
        )}
      >
        <Circle
          className="text-muted-foreground h-4 w-4 shrink-0"
          aria-hidden
        />
        <Icon
          className="text-primary h-4 w-4 shrink-0"
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <p className="font-medium">{t(step.label)}</p>
          <p className="text-muted-foreground text-xs">{t(step.description)}</p>
        </div>
      </Link>
    </li>
  );
}
