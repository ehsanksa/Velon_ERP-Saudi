import { useCallback, useEffect, useMemo, useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { ExternalLink, ScrollText } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import { getSessionMembershipRole } from '@/lib/auth/session';
import {
  createQiwaContract,
  deleteQiwaContract,
  expireQiwaContract,
  getQiwaContract,
  loadQiwaOverview,
  QIWA_NITAQAT_LABEL,
  QIWA_STATUS_LABEL,
  recordQiwaEmployeeResponse,
  recordQiwaExecutionNumber,
  recordQiwaNitaqat,
  requestQiwaContractUpdate,
  saveQiwaEstablishment,
  sendQiwaContract,
  terminateQiwaContract,
  updateQiwaContract,
  validateQiwaContract,
  type QiwaContractDetail,
  type QiwaContractInput,
  type QiwaContractStatus,
  type QiwaContractType,
  type QiwaEstablishmentStatus,
  type QiwaFinding,
  type QiwaIdentityType,
  type QiwaNitaqatBand,
  type QiwaOverview,
  type QiwaWageBasis,
} from '@/lib/hr/qiwa-api';

export const Route = createFileRoute('/app/hr/qiwa')({
  component: HrQiwaPage,
});

const EMPTY_CONTRACT = {
  employeeId: '',
  contractType: 'FIXED_TERM' as QiwaContractType,
  identityType: 'NATIONAL_ID' as QiwaIdentityType,
  nationalId: '',
  employeeNameAr: '',
  nationality: 'Saudi Arabia',
  occupationTitle: '',
  startDate: new Date().toISOString().slice(0, 10),
  endDate: '',
  probationDays: '90',
  dailyHours: '8',
  weeklyHours: '48',
  workLocation: '',
  wageBasis: 'MONTHLY' as QiwaWageBasis,
  basicWage: '',
  housingAllowance: '0',
  transportAllowance: '0',
  otherAllowances: '0',
  noticePeriodDays: '60',
  additionalTerms: '',
  gosiRegistered: false,
  listedOnQiwa: false,
};

function statusVariant(status: QiwaContractStatus) {
  if (status === 'DOCUMENTED' || status === 'ENFORCEABLE') return 'success' as const;
  if (status === 'REJECTED') return 'destructive' as const;
  if (
    status === 'PENDING_EMPLOYEE' ||
    status === 'AMENDMENT_REQUESTED' ||
    status === 'UPDATE_PENDING'
  ) {
    return 'warning' as const;
  }
  if (status === 'READY') return 'info' as const;
  return 'neutral' as const;
}

function sar(value: number) {
  return new Intl.NumberFormat('en-SA', {
    style: 'currency',
    currency: 'SAR',
    maximumFractionDigits: 2,
  }).format(value);
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : 'Request failed';
}

function HrQiwaPage() {
  const canWrite = canWriteHr(normalizeVelonRole(getSessionMembershipRole() ?? 'USER'));
  const [overview, setOverview] = useState<QiwaOverview | null>(null);
  const [selected, setSelected] = useState<QiwaContractDetail | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const next = await loadQiwaOverview();
    setOverview(next);
    return next;
  }, []);

  useEffect(() => {
    void refresh().catch((error) => toast.error(errorText(error)));
  }, [refresh]);

  async function openContract(id: string) {
    setBusy(true);
    try {
      setSelected(await getQiwaContract(id));
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  async function afterChange(contract?: QiwaContractDetail | null) {
    await refresh();
    if (contract === undefined) {
      if (selected) setSelected(await getQiwaContract(selected.id).catch(() => null));
      return;
    }
    setSelected(contract);
  }

  const documentedCount = (overview?.counts.DOCUMENTED ?? 0) + (overview?.counts.ENFORCEABLE ?? 0);

  return (
    <div className="space-y-6">
      <Button
        asChild
        variant="ghost"
        size="sm"
      >
        <Link to="/app/hr">← HR hub</Link>
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">
            Ministry of Human Resources
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Qiwa contracts</h1>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
            Prepare and track employment contracts the way Qiwa Contract Management expects them.
            The employee still approves, rejects, or asks for a change in Qiwa Individuals. Sign-in
            to Qiwa Business is through Nafath.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {overview?.guidelines.links.map((link) => (
            <Button
              key={link.href}
              asChild
              variant="outline"
              size="sm"
            >
              <a
                href={link.href}
                target="_blank"
                rel="noreferrer"
              >
                {link.label}
                <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
              </a>
            </Button>
          ))}
        </div>
      </div>

      {overview && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-border bg-card p-4">
            <p className="text-muted-foreground text-xs">Documented contracts</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{documentedCount}</p>
          </Card>
          <Card className="border-border bg-card p-4">
            <p className="text-muted-foreground text-xs">Awaiting employee</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">
              {overview.compliance.awaitingEmployee.length}
            </p>
          </Card>
          <Card className="border-border bg-card p-4">
            <p className="text-muted-foreground text-xs">
              Active staff without a documented contract
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums">
              {overview.compliance.undocumented.length}
            </p>
          </Card>
          <Card className="border-border bg-card p-4">
            <p className="text-muted-foreground text-xs">Nitaqat</p>
            <p className="mt-1 text-lg font-semibold">
              {overview.establishment
                ? QIWA_NITAQAT_LABEL[overview.establishment.nitaqatBand]
                : 'No file'}
            </p>
            {overview.establishment?.saudizationPercent != null && (
              <p className="text-muted-foreground text-xs">
                {overview.establishment.saudizationPercent}% Saudization
              </p>
            )}
          </Card>
        </div>
      )}

      <Card className="border-border bg-card p-5">
        <h2 className="font-semibold">Authentication steps</h2>
        <ol className="text-muted-foreground mt-3 list-decimal space-y-1 pl-5 text-sm">
          {(overview?.guidelines.steps ?? []).map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </Card>

      {overview && (
        <EstablishmentCard
          overview={overview}
          canWrite={canWrite}
          onSaved={async () => {
            await refresh();
            toast.success('Establishment file saved');
          }}
        />
      )}

      {overview && overview.compliance.undocumented.length > 0 && (
        <Card className="border-border bg-card p-5">
          <h2 className="font-semibold">Needs a documented contract</h2>
          <ul className="mt-3 space-y-1 text-sm">
            {overview.compliance.undocumented.map((row) => (
              <li key={row.employeeId}>
                {row.name} <span className="text-muted-foreground">· {row.employeeCode}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {overview && canWrite && (
        <ContractCreateCard
          employees={overview.employees}
          disabled={!overview.establishment}
          onCreated={async (contract) => {
            await refresh();
            setSelected(contract);
            toast.success('Contract draft saved');
          }}
        />
      )}

      <Card className="border-border bg-card divide-y">
        <div className="flex items-center gap-2 p-4">
          <ScrollText className="text-primary h-4 w-4" />
          <h2 className="font-semibold">Contract register</h2>
        </div>
        {(overview?.contracts.length ?? 0) === 0 && (
          <p className="text-muted-foreground p-4 text-sm">
            No Qiwa contracts yet. Save the establishment file, then prepare the first contract.
          </p>
        )}
        {overview?.contracts.map((contract) => (
          <button
            key={contract.id}
            type="button"
            className="hover:bg-muted/50 flex w-full flex-wrap items-center justify-between gap-3 p-4 text-left"
            onClick={() => void openContract(contract.id)}
          >
            <div>
              <p className="font-medium">
                {contract.employeeNameEn}{' '}
                <span className="text-muted-foreground font-normal">
                  · {contract.referenceCode}
                </span>
              </p>
              <p className="text-muted-foreground text-xs">
                {contract.occupationTitle} ·{' '}
                {contract.contractType === 'FIXED_TERM' ? 'Fixed term' : 'Indefinite'} ·{' '}
                {sar(contract.totalWage)}
                {contract.qiwaContractNumber ? ` · Qiwa ${contract.qiwaContractNumber}` : ''}
              </p>
            </div>
            <Badge variant={statusVariant(contract.status)}>
              {QIWA_STATUS_LABEL[contract.status]}
            </Badge>
          </button>
        ))}
      </Card>

      {selected && (
        <ContractDetail
          contract={selected}
          canWrite={canWrite}
          busy={busy}
          onChange={afterChange}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function Findings({ findings }: { findings: QiwaFinding[] }) {
  if (!findings.length) return null;
  return (
    <ul className="mt-3 space-y-1 text-sm">
      {findings.map((finding) => (
        <li
          key={finding.code}
          className={
            finding.severity === 'error' ? 'text-destructive' : 'text-amber-700 dark:text-amber-400'
          }
        >
          {finding.message}
        </li>
      ))}
    </ul>
  );
}

function EstablishmentCard({
  overview,
  canWrite,
  onSaved,
}: {
  overview: QiwaOverview;
  canWrite: boolean;
  onSaved: () => Promise<void>;
}) {
  const current = overview.establishment;
  const [form, setForm] = useState({
    nameEn: current?.nameEn ?? '',
    nameAr: current?.nameAr ?? '',
    laborOfficeId: current?.laborOfficeId ?? '',
    sequenceNumber: current?.sequenceNumber ?? '',
    commercialRegistrationNumber: current?.commercialRegistrationNumber ?? '',
    unifiedNumber: current?.unifiedNumber ?? '',
    economicActivity: current?.economicActivity ?? '',
    status: (current?.status ?? 'DRAFT') as QiwaEstablishmentStatus,
    notes: current?.notes ?? '',
  });
  const [nitaqat, setNitaqat] = useState({
    nitaqatBand: (current?.nitaqatBand ?? 'UNKNOWN') as QiwaNitaqatBand,
    saudiCount: current?.saudiCount?.toString() ?? '',
    nonSaudiCount: current?.nonSaudiCount?.toString() ?? '',
    saudizationCertificateExpiresAt: current?.saudizationCertificateExpiresAt ?? '',
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!current) return;
    setForm({
      nameEn: current.nameEn,
      nameAr: current.nameAr ?? '',
      laborOfficeId: current.laborOfficeId ?? '',
      sequenceNumber: current.sequenceNumber ?? '',
      commercialRegistrationNumber: current.commercialRegistrationNumber ?? '',
      unifiedNumber: current.unifiedNumber ?? '',
      economicActivity: current.economicActivity ?? '',
      status: current.status,
      notes: current.notes ?? '',
    });
    setNitaqat({
      nitaqatBand: current.nitaqatBand,
      saudiCount: current.saudiCount?.toString() ?? '',
      nonSaudiCount: current.nonSaudiCount?.toString() ?? '',
      saudizationCertificateExpiresAt: current.saudizationCertificateExpiresAt ?? '',
    });
  }, [current]);

  async function onSave(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await saveQiwaEstablishment({
        ...form,
        nameAr: form.nameAr || undefined,
        laborOfficeId: form.laborOfficeId || undefined,
        sequenceNumber: form.sequenceNumber || undefined,
        commercialRegistrationNumber: form.commercialRegistrationNumber || undefined,
        unifiedNumber: form.unifiedNumber || undefined,
        economicActivity: form.economicActivity || undefined,
        notes: form.notes || undefined,
      });
      await onSaved();
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  async function onNitaqat(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await recordQiwaNitaqat({
        nitaqatBand: nitaqat.nitaqatBand,
        saudiCount: nitaqat.saudiCount ? Number(nitaqat.saudiCount) : undefined,
        nonSaudiCount: nitaqat.nonSaudiCount ? Number(nitaqat.nonSaudiCount) : undefined,
        saudizationCertificateExpiresAt: nitaqat.saudizationCertificateExpiresAt || undefined,
      });
      await onSaved();
      toast.success('Nitaqat snapshot recorded');
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-border bg-card p-5">
      <h2 className="font-semibold">Establishment file</h2>
      <p className="text-muted-foreground mt-1 text-sm">
        Use the labor office number and sequence from the Qiwa establishment file. Mark it active
        only when the establishment is running.
      </p>
      {canWrite && (
        <form
          className="mt-4 grid gap-3 sm:grid-cols-2"
          onSubmit={onSave}
        >
          <Field label="Name (English)">
            <Input
              value={form.nameEn}
              onChange={(event) => setForm({ ...form, nameEn: event.target.value })}
              required
            />
          </Field>
          <Field label="Name (Arabic)">
            <Input
              value={form.nameAr}
              onChange={(event) => setForm({ ...form, nameAr: event.target.value })}
            />
          </Field>
          <Field label="Labor office number">
            <Input
              value={form.laborOfficeId}
              onChange={(event) => setForm({ ...form, laborOfficeId: event.target.value })}
            />
          </Field>
          <Field label="Sequence number">
            <Input
              value={form.sequenceNumber}
              onChange={(event) => setForm({ ...form, sequenceNumber: event.target.value })}
            />
          </Field>
          <Field label="Commercial registration">
            <Input
              value={form.commercialRegistrationNumber}
              onChange={(event) =>
                setForm({ ...form, commercialRegistrationNumber: event.target.value })
              }
            />
          </Field>
          <Field label="Unified number (700)">
            <Input
              value={form.unifiedNumber}
              onChange={(event) => setForm({ ...form, unifiedNumber: event.target.value })}
            />
          </Field>
          <Field label="Economic activity">
            <Input
              value={form.economicActivity}
              onChange={(event) => setForm({ ...form, economicActivity: event.target.value })}
            />
          </Field>
          <Field label="File status">
            <Select
              value={form.status}
              onValueChange={(status) =>
                setForm({ ...form, status: status as QiwaEstablishmentStatus })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="ACTIVE">Active / running</SelectItem>
                <SelectItem value="SUSPENDED">Suspended</SelectItem>
                <SelectItem value="CLOSED">Closed</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <Button
              type="submit"
              disabled={busy}
            >
              Save establishment
            </Button>
          </div>
        </form>
      )}
      <Findings findings={overview.establishmentFindings} />

      {current && canWrite && (
        <form
          className="mt-6 grid gap-3 border-t pt-4 sm:grid-cols-2"
          onSubmit={onNitaqat}
        >
          <div className="sm:col-span-2">
            <h3 className="font-medium">Nitaqat snapshot</h3>
            <p className="text-muted-foreground text-sm">
              Copy the band and headcount from the Qiwa dashboard. Saudization is calculated from
              the two counts.
            </p>
          </div>
          <Field label="Band">
            <Select
              value={nitaqat.nitaqatBand}
              onValueChange={(nitaqatBand) =>
                setNitaqat({ ...nitaqat, nitaqatBand: nitaqatBand as QiwaNitaqatBand })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(QIWA_NITAQAT_LABEL) as QiwaNitaqatBand[]).map((band) => (
                  <SelectItem
                    key={band}
                    value={band}
                  >
                    {QIWA_NITAQAT_LABEL[band]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Certificate expiry">
            <Input
              type="date"
              value={nitaqat.saudizationCertificateExpiresAt}
              onChange={(event) =>
                setNitaqat({ ...nitaqat, saudizationCertificateExpiresAt: event.target.value })
              }
            />
          </Field>
          <Field label="Saudi employees">
            <Input
              type="number"
              min={0}
              value={nitaqat.saudiCount}
              onChange={(event) => setNitaqat({ ...nitaqat, saudiCount: event.target.value })}
            />
          </Field>
          <Field label="Non-Saudi employees">
            <Input
              type="number"
              min={0}
              value={nitaqat.nonSaudiCount}
              onChange={(event) => setNitaqat({ ...nitaqat, nonSaudiCount: event.target.value })}
            />
          </Field>
          <div className="sm:col-span-2">
            <Button
              type="submit"
              variant="secondary"
              disabled={busy}
            >
              Record Nitaqat
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}

function ContractCreateCard({
  employees,
  disabled,
  onCreated,
}: {
  employees: QiwaOverview['employees'];
  disabled: boolean;
  onCreated: (contract: QiwaContractDetail) => Promise<void>;
}) {
  const [form, setForm] = useState(EMPTY_CONTRACT);
  const [busy, setBusy] = useState(false);
  const total = useMemo(() => {
    return (
      Number(form.basicWage || 0) +
      Number(form.housingAllowance || 0) +
      Number(form.transportAllowance || 0) +
      Number(form.otherAllowances || 0)
    );
  }, [form.basicWage, form.housingAllowance, form.otherAllowances, form.transportAllowance]);

  function applyEmployee(employeeId: string) {
    const employee = employees.find((item) => item.id === employeeId);
    if (!employee) {
      setForm({ ...form, employeeId });
      return;
    }
    setForm({
      ...form,
      employeeId,
      identityType:
        employee.identityType ?? (employee.nationalId?.startsWith('2') ? 'IQAMA' : 'NATIONAL_ID'),
      nationalId: employee.nationalId ?? '',
      nationality:
        employee.nationality ?? (employee.identityType === 'IQAMA' ? '' : 'Saudi Arabia'),
      startDate: employee.hireDate ?? form.startDate,
      workLocation: employee.workLocation ?? '',
      basicWage: employee.baseSalary ? String(employee.baseSalary) : form.basicWage,
    });
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const created = await createQiwaContract(toContractInput(form));
      setForm(EMPTY_CONTRACT);
      await onCreated(created);
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-border bg-card p-5">
      <h2 className="font-semibold">Prepare a contract</h2>
      <p className="text-muted-foreground mt-1 text-sm">
        These are the fields Contract Management asks for: identity, profession, duration, hours,
        and financial obligations. Total wage is basic plus allowances.
      </p>
      {disabled && (
        <p className="text-destructive mt-2 text-sm">
          Save the establishment file before creating a contract.
        </p>
      )}
      <form
        className="mt-4 grid gap-3 sm:grid-cols-2"
        onSubmit={onSubmit}
      >
        <Field label="Employee">
          <Select
            value={form.employeeId}
            onValueChange={applyEmployee}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select employee" />
            </SelectTrigger>
            <SelectContent>
              {employees.map((employee) => (
                <SelectItem
                  key={employee.id}
                  value={employee.id}
                >
                  {employee.firstName} {employee.lastName} · {employee.employeeCode}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Contract type">
          <Select
            value={form.contractType}
            onValueChange={(contractType) =>
              setForm({ ...form, contractType: contractType as QiwaContractType })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="FIXED_TERM">Fixed term</SelectItem>
              <SelectItem value="INDEFINITE">Indefinite</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Identity type">
          <Select
            value={form.identityType}
            onValueChange={(identityType) =>
              setForm({ ...form, identityType: identityType as QiwaIdentityType })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="NATIONAL_ID">National ID</SelectItem>
              <SelectItem value="IQAMA">Iqama</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Identity number">
          <Input
            value={form.nationalId}
            onChange={(event) => setForm({ ...form, nationalId: event.target.value })}
            required
          />
        </Field>
        <Field label="Nationality">
          <Input
            value={form.nationality}
            onChange={(event) => setForm({ ...form, nationality: event.target.value })}
            required
          />
        </Field>
        <Field label="Profession">
          <Input
            value={form.occupationTitle}
            onChange={(event) => setForm({ ...form, occupationTitle: event.target.value })}
            required
          />
        </Field>
        <Field label="Start date">
          <Input
            type="date"
            value={form.startDate}
            onChange={(event) => setForm({ ...form, startDate: event.target.value })}
            required
          />
        </Field>
        <Field label="End date">
          <Input
            type="date"
            value={form.endDate}
            disabled={form.contractType === 'INDEFINITE'}
            onChange={(event) => setForm({ ...form, endDate: event.target.value })}
            required={form.contractType === 'FIXED_TERM'}
          />
        </Field>
        <Field label="Basic wage (SAR)">
          <Input
            type="number"
            min={0}
            step="0.01"
            value={form.basicWage}
            onChange={(event) => setForm({ ...form, basicWage: event.target.value })}
            required
          />
        </Field>
        <Field label="Housing allowance">
          <Input
            type="number"
            min={0}
            step="0.01"
            value={form.housingAllowance}
            onChange={(event) => setForm({ ...form, housingAllowance: event.target.value })}
          />
        </Field>
        <Field label="Transport allowance">
          <Input
            type="number"
            min={0}
            step="0.01"
            value={form.transportAllowance}
            onChange={(event) => setForm({ ...form, transportAllowance: event.target.value })}
          />
        </Field>
        <Field label="Other allowances">
          <Input
            type="number"
            min={0}
            step="0.01"
            value={form.otherAllowances}
            onChange={(event) => setForm({ ...form, otherAllowances: event.target.value })}
          />
        </Field>
        <p className="text-sm sm:col-span-2">Total wage {sar(total)}</p>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.listedOnQiwa}
            onChange={(event) => setForm({ ...form, listedOnQiwa: event.target.checked })}
          />
          Employee is on the Qiwa establishment file
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.gosiRegistered}
            onChange={(event) => setForm({ ...form, gosiRegistered: event.target.checked })}
          />
          Registered with GOSI
        </label>
        <div className="sm:col-span-2">
          <Button
            type="submit"
            disabled={busy || disabled || !form.employeeId}
          >
            Save draft
          </Button>
        </div>
      </form>
    </Card>
  );
}

function ContractDetail({
  contract,
  canWrite,
  busy,
  onChange,
  onClose,
}: {
  contract: QiwaContractDetail;
  canWrite: boolean;
  busy: boolean;
  onChange: (contract?: QiwaContractDetail | null) => Promise<void>;
  onClose: () => void;
}) {
  const [response, setResponse] = useState({
    decision: 'APPROVED' as 'APPROVED' | 'REJECTED' | 'AMENDMENT',
    note: '',
    qiwaContractNumber: contract.qiwaContractNumber ?? '',
  });
  const [executionNumber, setExecutionNumber] = useState(contract.executionNumber ?? '');
  const [reason, setReason] = useState('');
  const [working, setWorking] = useState(false);

  async function run(action: () => Promise<QiwaContractDetail | null>, success: string) {
    setWorking(true);
    try {
      const next = await action();
      await onChange(next);
      toast.success(success);
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setWorking(false);
    }
  }

  const locked = working || busy;
  const editable =
    contract.status === 'DRAFT' ||
    contract.status === 'READY' ||
    contract.status === 'REJECTED' ||
    contract.status === 'AMENDMENT_REQUESTED';

  return (
    <Card className="border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-muted-foreground text-xs">{contract.referenceCode}</p>
          <h2 className="text-lg font-semibold">{contract.employeeNameEn}</h2>
          <p className="text-muted-foreground text-sm">
            {contract.occupationTitle} ·{' '}
            {contract.identityType === 'NATIONAL_ID' ? 'National ID' : 'Iqama'}{' '}
            {contract.nationalId} · {sar(contract.totalWage)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={statusVariant(contract.status)}>
            {QIWA_STATUS_LABEL[contract.status]}
          </Badge>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
          >
            Close
          </Button>
        </div>
      </div>

      <Findings findings={contract.findings} />
      {contract.amendmentNote && (
        <p className="mt-3 text-sm">Employee asked to change: {contract.amendmentNote}</p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            void navigator.clipboard.writeText(JSON.stringify(contract.submissionPackage, null, 2));
            toast.success('Qiwa submission package copied');
          }}
        >
          Copy submission package
        </Button>
        <Button
          asChild
          variant="outline"
          size="sm"
        >
          <a
            href="https://qiwa.sa/en"
            target="_blank"
            rel="noreferrer"
          >
            Open Qiwa
          </a>
        </Button>
      </div>

      {canWrite && (
        <div className="mt-4 flex flex-wrap gap-2">
          {editable && (
            <Button
              type="button"
              disabled={locked}
              onClick={() =>
                void run(
                  async () => (await validateQiwaContract(contract.id)).contract,
                  'Contract checked',
                )
              }
            >
              Check against Qiwa rules
            </Button>
          )}
          {contract.status === 'READY' && (
            <Button
              type="button"
              disabled={locked}
              onClick={() =>
                void run(() => sendQiwaContract(contract.id), 'Marked as sent to the employee')
              }
            >
              Mark sent to employee
            </Button>
          )}
          {(contract.status === 'DRAFT' || contract.status === 'REJECTED') && (
            <Button
              type="button"
              variant="outline"
              disabled={locked}
              onClick={() =>
                void run(async () => {
                  await deleteQiwaContract(contract.id);
                  onClose();
                  return null;
                }, 'Draft removed')
              }
            >
              Remove draft
            </Button>
          )}
        </div>
      )}

      {canWrite &&
        (contract.status === 'PENDING_EMPLOYEE' || contract.status === 'UPDATE_PENDING') && (
          <form
            className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              void run(
                () =>
                  recordQiwaEmployeeResponse(contract.id, {
                    decision: response.decision,
                    note: response.note || undefined,
                    qiwaContractNumber: response.qiwaContractNumber || undefined,
                  }),
                'Employee response recorded',
              );
            }}
          >
            <div className="sm:col-span-2">
              <h3 className="font-medium">Record the Qiwa Individuals response</h3>
            </div>
            <Field label="Decision">
              <Select
                value={response.decision}
                onValueChange={(decision) =>
                  setResponse({ ...response, decision: decision as typeof response.decision })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="APPROVED">Approved — documented</SelectItem>
                  <SelectItem value="AMENDMENT">Requested an amendment</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Qiwa contract number">
              <Input
                value={response.qiwaContractNumber}
                onChange={(event) =>
                  setResponse({ ...response, qiwaContractNumber: event.target.value })
                }
              />
            </Field>
            <div className="sm:col-span-2">
              <Label>Note</Label>
              <Textarea
                value={response.note}
                onChange={(event) => setResponse({ ...response, note: event.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <Button
                type="submit"
                disabled={locked}
              >
                Save response
              </Button>
            </div>
          </form>
        )}

      {canWrite && (contract.status === 'DOCUMENTED' || contract.status === 'ENFORCEABLE') && (
        <form
          className="mt-4 flex flex-wrap items-end gap-2 border-t pt-4"
          onSubmit={(event) => {
            event.preventDefault();
            void run(
              () => recordQiwaExecutionNumber(contract.id, executionNumber),
              'Execution number recorded',
            );
          }}
        >
          <Field label="Ministry of Justice execution number">
            <Input
              value={executionNumber}
              onChange={(event) => setExecutionNumber(event.target.value)}
              required
            />
          </Field>
          <Button
            type="submit"
            disabled={locked}
          >
            Mark enforceable
          </Button>
          {contract.contractType === 'FIXED_TERM' && (
            <Button
              type="button"
              variant="outline"
              disabled={locked}
              onClick={() => void run(() => expireQiwaContract(contract.id), 'Contract expired')}
            >
              Mark expired
            </Button>
          )}
        </form>
      )}

      {canWrite &&
        [
          'PENDING_EMPLOYEE',
          'AMENDMENT_REQUESTED',
          'DOCUMENTED',
          'ENFORCEABLE',
          'UPDATE_PENDING',
        ].includes(contract.status) && (
          <form
            className="mt-4 flex flex-wrap items-end gap-2 border-t pt-4"
            onSubmit={(event) => {
              event.preventDefault();
              void run(
                () => terminateQiwaContract(contract.id, reason),
                'Contractual relationship ended',
              );
            }}
          >
            <Field label="End the relationship">
              <Input
                value={reason}
                placeholder="Reason recorded on the contract file"
                onChange={(event) => setReason(event.target.value)}
                required
              />
            </Field>
            <Button
              type="submit"
              variant="outline"
              disabled={locked}
            >
              Terminate
            </Button>
          </form>
        )}

      {editable && canWrite && (
        <DraftEditor
          contract={contract}
          disabled={locked}
          onSaved={(next) => onChange(next)}
        />
      )}

      {canWrite && (contract.status === 'DOCUMENTED' || contract.status === 'ENFORCEABLE') && (
        <DocumentedUpdate
          contract={contract}
          disabled={locked}
          onSaved={(next) => onChange(next)}
        />
      )}

      <ol className="mt-6 space-y-2 border-t pt-4 text-sm">
        {contract.events.map((event) => (
          <li key={event.id}>
            <span className="font-medium">{event.note || event.type}</span>
            <span className="text-muted-foreground">
              {' '}
              · {new Date(event.createdAt).toLocaleString()}
              {event.actorName ? ` · ${event.actorName}` : ''}
            </span>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function DocumentedUpdate({
  contract,
  disabled,
  onSaved,
}: {
  contract: QiwaContractDetail;
  disabled: boolean;
  onSaved: (contract: QiwaContractDetail) => Promise<void>;
}) {
  const [occupationTitle, setOccupationTitle] = useState(contract.occupationTitle);
  const [basicWage, setBasicWage] = useState(String(contract.basicWage));
  const [housingAllowance, setHousingAllowance] = useState(String(contract.housingAllowance));
  const [transportAllowance, setTransportAllowance] = useState(String(contract.transportAllowance));
  const [otherAllowances, setOtherAllowances] = useState(String(contract.otherAllowances));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setOccupationTitle(contract.occupationTitle);
    setBasicWage(String(contract.basicWage));
    setHousingAllowance(String(contract.housingAllowance));
    setTransportAllowance(String(contract.transportAllowance));
    setOtherAllowances(String(contract.otherAllowances));
  }, [contract]);

  return (
    <form
      className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        setBusy(true);
        void requestQiwaContractUpdate(contract.id, {
          occupationTitle,
          basicWage: Number(basicWage),
          housingAllowance: Number(housingAllowance),
          transportAllowance: Number(transportAllowance),
          otherAllowances: Number(otherAllowances),
        })
          .then(async (next) => {
            await onSaved(next);
            toast.success('Update sent for employee approval on Qiwa');
          })
          .catch((error) => toast.error(errorText(error)))
          .finally(() => setBusy(false));
      }}
    >
      <div className="sm:col-span-2">
        <h3 className="font-medium">Change documented terms</h3>
        <p className="text-muted-foreground text-sm">
          Qiwa requires the employee to approve a change of profession or wage. The execution number
          is cleared until the updated contract is documented again.
        </p>
      </div>
      <Field label="Profession">
        <Input
          value={occupationTitle}
          onChange={(event) => setOccupationTitle(event.target.value)}
          required
        />
      </Field>
      <Field label="Basic wage (SAR)">
        <Input
          type="number"
          min={0}
          step="0.01"
          value={basicWage}
          onChange={(event) => setBasicWage(event.target.value)}
          required
        />
      </Field>
      <Field label="Housing allowance">
        <Input
          type="number"
          min={0}
          step="0.01"
          value={housingAllowance}
          onChange={(event) => setHousingAllowance(event.target.value)}
        />
      </Field>
      <Field label="Transport allowance">
        <Input
          type="number"
          min={0}
          step="0.01"
          value={transportAllowance}
          onChange={(event) => setTransportAllowance(event.target.value)}
        />
      </Field>
      <Field label="Other allowances">
        <Input
          type="number"
          min={0}
          step="0.01"
          value={otherAllowances}
          onChange={(event) => setOtherAllowances(event.target.value)}
        />
      </Field>
      <div className="sm:col-span-2">
        <Button
          type="submit"
          variant="secondary"
          disabled={disabled || busy}
        >
          Send update for approval
        </Button>
      </div>
    </form>
  );
}

function DraftEditor({
  contract,
  disabled,
  onSaved,
}: {
  contract: QiwaContractDetail;
  disabled: boolean;
  onSaved: (contract: QiwaContractDetail) => Promise<void>;
}) {
  const [occupationTitle, setOccupationTitle] = useState(contract.occupationTitle);
  const [basicWage, setBasicWage] = useState(String(contract.basicWage));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setOccupationTitle(contract.occupationTitle);
    setBasicWage(String(contract.basicWage));
  }, [contract]);

  return (
    <form
      className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        setBusy(true);
        void updateQiwaContract(contract.id, {
          occupationTitle,
          basicWage: Number(basicWage),
          housingAllowance: contract.housingAllowance,
          transportAllowance: contract.transportAllowance,
          otherAllowances: contract.otherAllowances,
        })
          .then(async (next) => {
            await onSaved(next);
            toast.success('Draft updated');
          })
          .catch((error) => toast.error(errorText(error)))
          .finally(() => setBusy(false));
      }}
    >
      <div className="sm:col-span-2">
        <h3 className="font-medium">Correct the draft</h3>
      </div>
      <Field label="Profession">
        <Input
          value={occupationTitle}
          onChange={(event) => setOccupationTitle(event.target.value)}
          required
        />
      </Field>
      <Field label="Basic wage (SAR)">
        <Input
          type="number"
          min={0}
          step="0.01"
          value={basicWage}
          onChange={(event) => setBasicWage(event.target.value)}
          required
        />
      </Field>
      <div className="sm:col-span-2">
        <Button
          type="submit"
          variant="secondary"
          disabled={disabled || busy}
        >
          Save corrections
        </Button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function toContractInput(form: typeof EMPTY_CONTRACT): QiwaContractInput {
  return {
    employeeId: form.employeeId,
    contractType: form.contractType,
    identityType: form.identityType,
    nationalId: form.nationalId.trim(),
    employeeNameAr: form.employeeNameAr || undefined,
    nationality: form.nationality,
    occupationTitle: form.occupationTitle,
    startDate: form.startDate,
    endDate: form.contractType === 'FIXED_TERM' ? form.endDate : undefined,
    probationDays: Number(form.probationDays || 90),
    dailyHours: Number(form.dailyHours || 8),
    weeklyHours: Number(form.weeklyHours || 48),
    workLocation: form.workLocation || undefined,
    wageBasis: form.wageBasis,
    basicWage: Number(form.basicWage || 0),
    housingAllowance: Number(form.housingAllowance || 0),
    transportAllowance: Number(form.transportAllowance || 0),
    otherAllowances: Number(form.otherAllowances || 0),
    noticePeriodDays: Number(form.noticePeriodDays || 60),
    additionalTerms: form.additionalTerms || undefined,
    gosiRegistered: form.gosiRegistered,
    listedOnQiwa: form.listedOnQiwa,
  };
}
