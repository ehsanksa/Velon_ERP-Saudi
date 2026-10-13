import { useCallback, useEffect, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { MessageSquare, Plus, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { canManageProcurement, normalizeVelonRole } from '@velon/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getSessionMembershipRole } from '@/lib/auth/session';
import {
  createSupplier,
  createSupplierThread,
  listSuppliers,
  listSupplierThreads,
  type Supplier,
  type SupplierThread,
} from '@/lib/procurement/api';

export const Route = createFileRoute('/app/suppliers')({
  validateSearch: (search: Record<string, unknown>): { q?: string } => {
    const q = typeof search.q === 'string' ? search.q.trim() : '';
    return q ? { q } : {};
  },
  component: SuppliersPage,
});

function statusBadge(status: string) {
  return <Badge variant="secondary">{status.toLowerCase().replace(/_/g, ' ')}</Badge>;
}

function SuppliersPage() {
  const { q } = Route.useSearch();
  const role = normalizeVelonRole(getSessionMembershipRole() ?? 'USER');
  const canManage = canManageProcurement(role);

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState(q ?? '');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [threads, setThreads] = useState<SupplierThread[]>([]);
  const [busy, setBusy] = useState(false);
  const [threadBody, setThreadBody] = useState('');
  const [form, setForm] = useState({ name: '', email: '', phone: '' });

  const refresh = useCallback(async () => {
    const rows = await listSuppliers(search.trim() || undefined);
    setSuppliers(rows);
    if (selectedId && !rows.some((s) => s.id === selectedId)) {
      setSelectedId(rows[0]?.id ?? null);
    }
  }, [search, selectedId]);

  useEffect(() => {
    if (q) setSearch(q);
  }, [q]);

  useEffect(() => {
    refresh().catch((e) =>
      toast.error(e instanceof Error ? e.message : 'Failed to load suppliers'),
    );
  }, [refresh]);

  useEffect(() => {
    if (!selectedId) {
      setThreads([]);
      return;
    }
    void listSupplierThreads(selectedId)
      .then(setThreads)
      .catch(() => setThreads([]));
  }, [selectedId]);

  const selected = suppliers.find((s) => s.id === selectedId) ?? null;

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!canManage || !form.name.trim()) return;
    setBusy(true);
    try {
      const created = await createSupplier(form);
      setForm({ name: '', email: '', phone: '' });
      await refresh();
      setSelectedId(created.id);
      toast.success('Supplier created');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create supplier');
    } finally {
      setBusy(false);
    }
  }

  async function handlePostThread(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId || !threadBody.trim()) return;
    setBusy(true);
    try {
      await createSupplierThread(selectedId, { body: threadBody.trim() });
      setThreadBody('');
      const next = await listSupplierThreads(selectedId);
      setThreads(next);
      toast.success('Message posted');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not post message');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">
          Master data
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Suppliers</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Manage supplier records, contacts, and supplier communication.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Search suppliers…"
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

      {canManage && (
        <Card className="border-border bg-card p-4">
          <h2 className="flex items-center gap-2 font-medium">
            <Plus className="h-4 w-4" />
            New supplier
          </h2>
          <form
            className="mt-3 grid gap-3 sm:grid-cols-3"
            onSubmit={handleCreate}
          >
            <div>
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div>
              <Label>Phone</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>
            <Button
              type="submit"
              size="sm"
              disabled={busy}
              className="w-fit sm:col-span-3"
            >
              Create supplier
            </Button>
          </form>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="border-border bg-card lg:col-span-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.map((s) => (
                <TableRow
                  key={s.id}
                  className={selectedId === s.id ? 'bg-muted/50' : 'cursor-pointer'}
                  onClick={() => setSelectedId(s.id)}
                >
                  <TableCell className="font-mono text-xs">{s.code}</TableCell>
                  <TableCell>{s.name}</TableCell>
                  <TableCell>{statusBadge(s.status)}</TableCell>
                </TableRow>
              ))}
              {suppliers.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="text-muted-foreground text-center"
                  >
                    No suppliers yet. Add your first supplier above.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>

        <Card className="border-border bg-card p-4 lg:col-span-3">
          {selected ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Truck className="text-muted-foreground mt-0.5 h-5 w-5" />
                <div>
                  <h2 className="font-semibold">{selected.name}</h2>
                  <p className="text-muted-foreground text-sm">
                    {selected.code} · {selected.email ?? 'No email'} ·{' '}
                    {selected.phone ?? 'No phone'}
                  </p>
                  {selected.country ? (
                    <p className="text-muted-foreground text-xs">{selected.country}</p>
                  ) : null}
                </div>
              </div>

              <div>
                <h3 className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <MessageSquare className="h-4 w-4" />
                  Communication thread
                </h3>
                <div className="border-border max-h-48 space-y-2 overflow-y-auto rounded-lg border p-3">
                  {threads.map((t) => (
                    <div
                      key={t.id}
                      className="text-sm"
                    >
                      <p className="font-medium">{t.authorName}</p>
                      <p className="text-muted-foreground">{t.body}</p>
                      <p className="text-muted-foreground text-[10px]">
                        {new Date(t.createdAt).toLocaleString()}
                      </p>
                    </div>
                  ))}
                  {threads.length === 0 && (
                    <p className="text-muted-foreground text-sm">No messages yet.</p>
                  )}
                </div>
                <form
                  className="mt-2 flex gap-2"
                  onSubmit={handlePostThread}
                >
                  <Input
                    placeholder="Write a supplier note…"
                    value={threadBody}
                    onChange={(e) => setThreadBody(e.target.value)}
                  />
                  <Button
                    type="submit"
                    size="sm"
                    disabled={busy || !threadBody.trim()}
                  >
                    Post
                  </Button>
                </form>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">Select a supplier to view details.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
