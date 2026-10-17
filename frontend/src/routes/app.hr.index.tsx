import { useEffect, useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Briefcase, CalendarDays, Clock, ScrollText, Users, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { workspaceAdminSearch } from '@velon/shared';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { loadHrMetrics, type HrMetrics } from '@/lib/hr/api';

export const Route = createFileRoute('/app/hr/')({
  component: HrHubPage,
});

const HR_LINKS = [
  {
    label: 'Employees',
    description: 'Manage employee records, hire dates, and compensation',
    to: '/app/hr/employees' as const,
    icon: Users,
  },
  {
    label: 'Qiwa contracts',
    description: 'Authenticate employment contracts and keep the Qiwa establishment file',
    to: '/app/hr/qiwa' as const,
    icon: ScrollText,
  },
  {
    label: 'Leave',
    description: 'Configure leave types and review employee requests',
    to: '/app/hr/leave' as const,
    icon: CalendarDays,
  },
  {
    label: 'Attendance',
    description: 'Check employees in and out, view recent attendance',
    to: '/app/hr/attendance' as const,
    icon: Clock,
  },
  {
    label: 'Payroll',
    description: 'Create payroll runs and process payslips',
    to: '/app/hr/payroll' as const,
    icon: Wallet,
  },
  {
    label: 'Departments',
    description: 'Group your team by function or branch',
    to: '/app/settings/admin' as const,
    search: workspaceAdminSearch('departments'),
    icon: Briefcase,
  },
];

function HrHubPage() {
  const [metrics, setMetrics] = useState<HrMetrics | null>(null);

  useEffect(() => {
    void loadHrMetrics()
      .then(setMetrics)
      .catch((e) => toast.error(String(e)));
  }, []);

  const activeHeadcount =
    metrics?.headcountByStatus.find((row) => row.status === 'ACTIVE')?.count ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">
          People
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">HR & Payroll</h1>
        <p className="text-muted-foreground mt-1 max-w-xl text-sm">
          Manage employees, Qiwa contracts, leave, attendance, and payroll from one hub.
        </p>
      </div>

      {metrics && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-border bg-card p-4">
            <p className="text-muted-foreground text-xs">Active employees</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{activeHeadcount}</p>
          </Card>
          <Card className="border-border bg-card p-4">
            <p className="text-muted-foreground text-xs">Pending leave</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">
              {metrics.pendingLeaveRequests}
            </p>
          </Card>
          <Card className="border-border bg-card p-4">
            <p className="text-muted-foreground text-xs">Open jobs</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{metrics.openJobOpenings}</p>
          </Card>
          <Card className="border-border bg-card p-4">
            <p className="text-muted-foreground text-xs">Headcount by status</p>
            <p className="mt-1 text-sm">
              {metrics.headcountByStatus.map((row) => `${row.status}: ${row.count}`).join(' · ')}
            </p>
          </Card>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {HR_LINKS.map((item) => (
          <Card
            key={item.label}
            className="border-border bg-card p-5"
          >
            <div className="flex items-start gap-3">
              <div className="bg-primary/8 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
                <item.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold">{item.label}</h2>
                <p className="text-muted-foreground mt-1 text-sm">{item.description}</p>
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="mt-3"
                >
                  <Link
                    to={item.to}
                    search={'search' in item ? item.search : undefined}
                  >
                    Open
                  </Link>
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
