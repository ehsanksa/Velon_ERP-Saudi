import { Check } from 'lucide-react';
import { evaluatePasswordRules, PASSWORD_RULES } from '@/lib/auth/password-policy';
import { useT } from '@/lib/i18n/locale-context';
import { cn } from '@/lib/utils';

export function PasswordRequirementsChecklist({ password }: { password: string }) {
  const rules = evaluatePasswordRules(password);
  const t = useT();

  return (
    <ul
      className="space-y-1.5 text-xs"
      aria-live="polite"
    >
      {PASSWORD_RULES.map((rule) => {
        const met = rules[rule.id];
        return (
          <li
            key={rule.id}
            className={cn(
              'flex items-center gap-2',
              met ? 'text-success' : 'text-muted-foreground',
            )}
          >
            <Check
              className={cn(
                'h-3.5 w-3.5 shrink-0',
                met ? 'text-success' : 'text-muted-foreground/35',
              )}
              aria-hidden
            />
            <span>{t(rule.label)}</span>
          </li>
        );
      })}
    </ul>
  );
}
