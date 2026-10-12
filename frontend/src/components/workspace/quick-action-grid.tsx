import { Link } from '@tanstack/react-router';
import { Card } from '@/components/ui/card';
import { useT } from '@/lib/i18n/locale-context';
import { WORKSPACE_QUICK_ACTIONS } from '@/lib/workspace/quick-actions';

export function QuickActionGrid() {
  const t = useT();

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {WORKSPACE_QUICK_ACTIONS.map((action) => (
        <Link
          key={action.label}
          to={action.to}
          search={action.search}
          className="group block"
        >
          <Card className="border-border bg-card hover:border-primary/30 flex h-full items-center gap-3 p-4 transition hover:shadow-sm">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${action.tone}`}
            >
              <action.icon
                className="h-5 w-5"
                aria-hidden
              />
            </div>
            <div className="min-w-0">
              <p className="group-hover:text-primary font-medium">{t(action.label)}</p>
              <p className="text-muted-foreground text-xs">{t(action.description)}</p>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}
