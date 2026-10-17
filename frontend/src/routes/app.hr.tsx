import { createFileRoute, Link, Outlet, useRouterState } from '@tanstack/react-router';
import { cn } from '@/lib/utils';

const hrNav = [
  { to: '/app/hr/employees', label: 'Employees' },
  { to: '/app/hr/qiwa', label: 'Qiwa contracts' },
  { to: '/app/hr/leave', label: 'Leave' },
  { to: '/app/hr/attendance', label: 'Attendance' },
  { to: '/app/hr/payroll', label: 'Payroll' },
] as const;

export const Route = createFileRoute('/app/hr')({
  component: HrLayout,
});

function HrLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isHub = pathname === '/app/hr' || pathname === '/app/hr/';

  return (
    <div className="space-y-6">
      {!isHub && (
        <nav className="border-border flex flex-wrap gap-2 border-b pb-3">
          <Link
            to="/app/hr"
            className="text-muted-foreground hover:text-foreground rounded-md px-3 py-1.5 text-sm font-medium"
          >
            HR hub
          </Link>
          {hrNav.map((item) => {
            const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      )}
      <Outlet />
    </div>
  );
}
