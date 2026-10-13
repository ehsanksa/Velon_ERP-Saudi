import { useCallback, useEffect, useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Users } from 'lucide-react';
import { toast } from 'sonner';
import { canWriteHr, normalizeVelonRole } from '@velon/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ModuleEmptyState } from '@/components/workspace/module-empty-state';
import { getSessionMembershipRole } from '@/lib/auth/session';
import { createEmployee, deleteEmployee, loadEmployees, type HrEmployee } from '@/lib/hr/api';

export const Route = createFileRoute('/app/hr/employees')({
  validateSearch: (search: Record<string, unknown>): { q?: string } => {
    const q = typeof search.q === 'string' ? search.q.trim() : '';
    return q ? { q } : {};
  },
  component: HrEmployeesPage,
});

function HrEmployeesPage() {
  const { q } = Route.useSearch();
  const canWrite = canWriteHr(normalizeVelonRole(getSessionMembershipRole() ?? 'USER'));
  const [rows, setRows] = useState<HrEmployee[]>([]);
  const [search, setSearch] = useState(q ?? '');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    hireDate: new Date().toISOString().slice(0, 10),
    baseSalary: '',
  });

  const refresh = useCallback(async () => {
    setRows(await loadEmployees({ search: search || undefined }));
  }, [search]);

  useEffect(() => {
    if (q) setSearch(q);
  }, [q]);

  useEffect(() => {
    void refresh().catch((e) => toast.error(String(e)));
  }, [refresh]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!canWrite) return;
    setBusy(true);
    try {
      await createEmployee({
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email || undefined,
        hireDate: form.hireDate,
        baseSalary: form.baseSalary ? Number(form.baseSalary) : undefined,
      });
      toast.success('Employee created');
      setForm({
        firstName: '',
        lastName: '',
        email: '',
        hireDate: new Date().toISOString().slice(0, 10),
        baseSalary: '',
      });
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Button
        asChild
        variant="ghost"
        size="sm"
      >
        <Link to="/app/hr">← HR hub</Link>
      </Button>

      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Search employees…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Button
          variant="secondary"
          onClick={() => void refresh()}
        >
          Search
        </Button>
      </div>

      {canWrite && (
        <Card className="border-border bg-card p-6">
          <h2 className="font-semibold">Add employee</h2>
          <form
            className="mt-4 grid gap-3 sm:grid-cols-2"
            onSubmit={onCreate}
          >
            <div>
              <Label>First name</Label>
              <Input
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>Last name</Label>
              <Input
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div>
              <Label>Hire date</Label>
              <Input
                type="date"
                value={form.hireDate}
                onChange={(e) => setForm({ ...form, hireDate: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>Base salary</Label>
              <Input
                type="number"
                value={form.baseSalary}
                onChange={(e) => setForm({ ...form, baseSalary: e.target.value })}
              />
            </div>
            <div className="flex items-end">
              <Button
                type="submit"
                disabled={busy}
              >
                Create employee
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card className="border-border bg-card divide-y">
        {rows.map((employee) => (
          <div
            key={employee.id}
            className="flex flex-wrap items-center justify-between gap-3 p-4"
          >
            <div>
              <p className="font-medium">
                {employee.firstName} {employee.lastName}
              </p>
              <p className="text-muted-foreground text-xs">
                {employee.employeeCode} · {employee.email ?? 'No email'} · $
                {Number(employee.baseSalary).toLocaleString()} {employee.currency}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{employee.status}</Badge>
              {canWrite && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    void deleteEmployee(employee.id)
                      .then(refresh)
                      .then(() => toast.success('Deleted'))
                  }
                >
                  Delete
                </Button>
              )}
            </div>
          </div>
        ))}
        {rows.length === 0 && (
          <ModuleEmptyState
            icon={Users}
            title="No employees yet"
            description="Add your first employee to start tracking HR records."
          />
        )}
      </Card>
    </div>
  );
}
