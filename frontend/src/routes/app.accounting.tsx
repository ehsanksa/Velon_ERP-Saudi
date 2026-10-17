import * as React from 'react';
import { useEffect, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { format, parseISO } from 'date-fns';
import {
  AlertTriangle,
  ArrowDownRight,
  Bot,
  ClipboardCheck,
  FileSpreadsheet,
  Landmark,
  Receipt,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  Wallet,
} from 'lucide-react';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useWorkspaceCurrency } from '@/contexts/workspace-currency';
import { useDismissiblePanel } from '@/hooks/use-dismissible-panel';
import {
  exportBalanceSheetCsv,
  exportConsolidationCsv,
  exportPlCsv,
  exportTrialBalanceCsv,
} from '@/lib/accounting/export-reports';
import { useT } from '@/lib/i18n/locale-context';
import type { ApBillRecord, ApBillStage } from '@/lib/types/workspace-ui';
import { loadAccountingWorkspace } from '@/lib/workspace/loaders';

export const Route = createFileRoute('/app/accounting')({
  loader: () => loadAccountingWorkspace(),
  staleTime: 0,
  component: AccountingPage,
});

const AP_STAGE_ORDER: ApBillStage[] = [
  'pending_review',
  'exception',
  'approved',
  'scheduled',
  'paid',
];

const AP_STAGE_LABEL: Record<ApBillStage, string> = {
  pending_review: 'Review',
  exception: 'Exception',
  approved: 'Approved',
  scheduled: 'Scheduled pay',
  paid: 'Paid',
};

const cashChartConfig = {
  inflow: {
    label: 'Cash in',
    theme: { light: '#15803d', dark: '#4ade80' },
  },
  outflow: {
    label: 'Cash out',
    theme: { light: '#b45309', dark: '#fb923c' },
  },
} satisfies ChartConfig;

type RoleLens = 'controller' | 'ap_clerk' | 'auditor';

function AccountingPage() {
  const t = useT();
  const { formatCurrency } = useWorkspaceCurrency();
  const loaded = Route.useLoaderData();
  const [data, setData] = useState(loaded);

  useEffect(() => {
    let cancelled = false;
    loadAccountingWorkspace()
      .then((next) => {
        if (!cancelled) setData(next);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [loaded]);
  const [roleLens, setRoleLens] = React.useState<RoleLens>('controller');
  const [focusTab, setFocusTab] = React.useState('tower');
  const automationDismiss = useDismissiblePanel('velon-dismiss:app:accounting:automation');
  const controlDismiss = useDismissiblePanel('velon-dismiss:app:accounting:control');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="border-border bg-muted/40 inline-flex h-9 items-center rounded-lg border p-1">
          {(
            [
              ['controller', 'Controller', Landmark],
              ['ap_clerk', 'AP workspace', Receipt],
              ['auditor', 'Audit lens', ShieldCheck],
            ] as const
          ).map(([id, label, Icon]) => (
            <Button
              key={id}
              type="button"
              variant={roleLens === id ? 'secondary' : 'ghost'}
              size="sm"
              className="rounded-md px-3"
              onClick={() => setRoleLens(id)}
            >
              <Icon className="mr-1.5 h-3.5 w-3.5" />
              {label}
            </Button>
          ))}
        </div>
        <p className="text-muted-foreground max-w-xl text-xs">
          {roleLens === 'controller'
            ? 'Cash position, margin pulse, and working-capital trends take priority.'
            : roleLens === 'ap_clerk'
              ? 'Inbox, exceptions, and scheduled disbursements stay above the fold.'
              : 'Read-heavy snapshot emphasizing journals, bank reconciliation, and immutable trails.'}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          {
            key: 'cashbook',
            label: t('Cashbook'),
            value: formatCurrency(data.kpis.cashbook),
            hint: 'Operating cash — ties to bank rec below',
            tab: 'bank',
            icon: Wallet,
            hideApClerk: false,
          },
          {
            key: 'expense',
            label: t('OpEx (MTD)'),
            value: formatCurrency(data.kpis.expensesMtd),
            hint: 'Accrued from journal automation',
            tab: 'ledger',
            icon: TrendingDown,
            hideApClerk: roleLens === 'ap_clerk',
          },
          {
            key: 'ar',
            label: t('Receivables'),
            value: formatCurrency(data.kpis.receivables),
            hint: 'Open billing workspace exposure',
            tab: 'capital',
            icon: Receipt,
            hideApClerk: false,
          },
          {
            key: 'ap',
            label: t('Payables'),
            value: formatCurrency(data.kpis.payables),
            hint: 'Supplier AP snapshot · drill AP kanban',
            tab: 'capital',
            icon: ArrowDownRight,
            hideApClerk: false,
          },
        ]
          .filter((k) => !k.hideApClerk)
          .map((k) => (
            <button
              key={k.key}
              type="button"
              className="text-left transition-colors hover:opacity-95"
              onClick={() => setFocusTab(k.tab)}
            >
              <Card className="border-border bg-card hover:border-foreground/20 hover:bg-muted/20 p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                    {k.label}
                  </div>
                  <k.icon className="text-muted-foreground h-4 w-4 shrink-0" />
                </div>
                <div className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">
                  {k.value}
                </div>
                <div className="text-muted-foreground mt-1 text-[11px]">{k.hint}</div>
                <div className="text-primary mt-2 text-[10px] font-medium">Drill down →</div>
              </Card>
            </button>
          ))}
      </div>

      {roleLens !== 'auditor' &&
      data.automationAlerts.length > 0 &&
      !automationDismiss.dismissed ? (
        <Card className="border-primary/20 bg-primary/5 p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="text-foreground flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="h-4 w-4" />
              Automation &amp; AI exception routing
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-muted-foreground hover:text-foreground h-8 text-xs"
              onClick={automationDismiss.dismiss}
            >
              Dismiss
            </Button>
          </div>
          <ul className="text-muted-foreground list-inside list-disc space-y-1 text-sm">
            {data.automationAlerts.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </Card>
      ) : null}

      {data.controlAlerts.length > 0 && !controlDismiss.dismissed ? (
        <Card className="border-destructive/25 bg-destructive/5 p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="text-destructive flex items-center gap-2 text-sm font-semibold">
              <AlertTriangle className="h-4 w-4" />
              Control checkpoints
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-muted-foreground hover:text-foreground h-8 text-xs"
              onClick={controlDismiss.dismiss}
            >
              Dismiss
            </Button>
          </div>
          <ul className="text-muted-foreground list-inside list-disc space-y-1 text-sm">
            {data.controlAlerts.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Tabs
        value={focusTab}
        onValueChange={setFocusTab}
        className="space-y-4"
      >
        <TabsList className="bg-muted/50 h-auto w-full flex-wrap justify-start gap-1 p-1">
          <TabsTrigger
            value="tower"
            className="rounded-md"
          >
            Control tower
          </TabsTrigger>
          <TabsTrigger
            value="capital"
            className="rounded-md"
          >
            AR / AP workspace
          </TabsTrigger>
          <TabsTrigger
            value="ledger"
            className="rounded-md"
          >
            Journal &amp; audit
          </TabsTrigger>
          <TabsTrigger
            value="bank"
            className="rounded-md"
          >
            Bank feeds
          </TabsTrigger>
          <TabsTrigger
            value="reports"
            className="rounded-md"
          >
            Reporting suite
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="tower"
          className="space-y-4 outline-none"
        >
          <div className="grid gap-6 xl:grid-cols-5">
            <Card className="border-border bg-card p-5 xl:col-span-3">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className="text-muted-foreground text-[11px] font-medium tracking-[0.14em] uppercase">
                    Liquidity trend
                  </div>
                  <div className="mt-1 text-lg font-semibold tracking-tight">
                    Cash movement pulse
                  </div>
                  <p className="text-muted-foreground mt-1 text-xs">
                    Inflows vs outflows by period — controller forecasting overlays plug in here.
                  </p>
                </div>
              </div>
              <ChartContainer
                config={cashChartConfig}
                className="h-[260px] w-full md:h-[280px]"
              >
                <AreaChart
                  accessibilityLayer
                  data={data.cashFlowTrend}
                >
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="period"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                  />
                  <YAxis
                    hide
                    domain={['auto', 'auto']}
                  />
                  <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent />}
                  />
                  <defs>
                    <linearGradient
                      id="fillInflow"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor="var(--color-inflow)"
                        stopOpacity={0.35}
                      />
                      <stop
                        offset="95%"
                        stopColor="var(--color-inflow)"
                        stopOpacity={0.05}
                      />
                    </linearGradient>
                    <linearGradient
                      id="fillOutflow"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor="var(--color-outflow)"
                        stopOpacity={0.35}
                      />
                      <stop
                        offset="95%"
                        stopColor="var(--color-outflow)"
                        stopOpacity={0.05}
                      />
                    </linearGradient>
                  </defs>
                  <Area
                    dataKey="outflow"
                    type="monotone"
                    fill="url(#fillOutflow)"
                    stroke="var(--color-outflow)"
                    strokeWidth={2}
                  />
                  <Area
                    dataKey="inflow"
                    type="monotone"
                    fill="url(#fillInflow)"
                    stroke="var(--color-inflow)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ChartContainer>
            </Card>

            <Card className="border-border bg-card p-5 xl:col-span-2">
              <div className="text-muted-foreground mb-3 text-[11px] font-medium tracking-[0.14em] uppercase">
                P&amp;L pulse (billing + GL)
              </div>
              <div className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('Recognized revenue (MTD)')}</span>
                  <span className="font-semibold tabular-nums">
                    {formatCurrency(data.kpis.recognizedRevenueMtd)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">COGS recognized</span>
                  <span className="font-semibold tabular-nums">
                    {formatCurrency(data.kpis.cogsMtd)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Operating expenses</span>
                  <span className="font-semibold tabular-nums">
                    {formatCurrency(data.kpis.expensesMtd)}
                  </span>
                </div>
                <div className="border-border bg-muted/30 text-muted-foreground rounded-xl border p-3 text-xs">
                  {t('Net operating (MTD)')}:{' '}
                  <span
                    className={`text-foreground font-semibold tabular-nums ${
                      (data.kpis.netOperating ?? 0) < 0 ? 'text-destructive' : 'text-success'
                    }`}
                  >
                    {formatCurrency(data.kpis.netOperating ?? 0)}
                  </span>
                  .{' '}
                  {t('Sourced from issued sales invoices, POS tickets, and open purchase orders.')}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full rounded-lg"
                  onClick={() => setFocusTab('ledger')}
                >
                  View underlying journals
                </Button>
              </div>
            </Card>
          </div>

          {roleLens === 'controller' ? (
            <Card className="border-border bg-card p-5">
              <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                <Bot className="text-muted-foreground h-4 w-4" />
                Connected ERP ecosystem (conceptual wiring)
              </div>
              <p className="text-muted-foreground mt-2 text-sm">
                Sales and POS invoices, supplier GRNI accruals, and inventory COGS posts shown in
                the journal tab reconcile back to this dashboard — one ledger truth shared with
                Billing, Suppliers, and Inventory.
              </p>
            </Card>
          ) : null}
        </TabsContent>

        <TabsContent
          value="capital"
          className="space-y-6 outline-none"
        >
          <div className="grid gap-6 xl:grid-cols-2">
            <div>
              <div className="mb-3 flex items-center justify-between">
                <div className="text-sm font-semibold">AR aging heatmap</div>
                <Badge
                  variant="outline"
                  className="text-[10px] font-normal"
                >
                  From billing workspace
                </Badge>
              </div>
              <div className="grid gap-2">
                {data.agingAr.map((row) => (
                  <div
                    key={row.bucket}
                    className="border-border bg-card flex items-center gap-3 rounded-xl border p-3"
                  >
                    <div className="flex-1 text-sm font-medium">{row.bucket}</div>
                    <div className="font-semibold tabular-nums">{formatCurrency(row.amount)}</div>
                    <div
                      className="from-muted to-primary/80 h-8 w-3 rounded-full bg-gradient-to-t"
                      style={{
                        opacity: Math.min(
                          1,
                          0.25 + row.amount / Math.max(1, data.kpis.receivables || 1),
                        ),
                      }}
                      title={row.bucket}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-4 space-y-2">
                <div className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                  Open invoices (kanban-style)
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(['Pending', 'Overdue'] as const).map((status) => (
                    <Card
                      key={status}
                      className="border-border bg-muted/20 p-3"
                    >
                      <div className="text-muted-foreground mb-2 text-[11px] font-semibold tracking-wide uppercase">
                        {status}
                      </div>
                      <div className="space-y-2">
                        {data.invoices
                          .filter((i) => i.status === status)
                          .map((inv) => (
                            <div
                              key={inv.id}
                              className="border-border bg-background rounded-lg border p-2.5 text-xs"
                            >
                              <div className="font-mono font-semibold">{inv.id}</div>
                              <div className="text-muted-foreground mt-0.5">{inv.customer}</div>
                              <div className="mt-1 font-semibold tabular-nums">
                                {formatCurrency(inv.amt)}
                              </div>
                            </div>
                          ))}
                        {data.invoices.filter((i) => i.status === status).length === 0 ? (
                          <p className="text-muted-foreground text-[11px]">Nothing in this lane.</p>
                        ) : null}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between">
                <div className="text-sm font-semibold">AP pipeline kanban</div>
                <Badge
                  variant="outline"
                  className="text-[10px] font-normal"
                >
                  OCR + PO match states
                </Badge>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {AP_STAGE_ORDER.map((stage) => (
                  <Card
                    key={stage}
                    className="border-border bg-muted/15 min-w-[160px] shrink-0 p-3"
                  >
                    <div className="border-border text-muted-foreground mb-2 border-b pb-2 text-[11px] font-semibold tracking-wide uppercase">
                      {AP_STAGE_LABEL[stage]}
                    </div>
                    <div className="space-y-2">
                      {data.apBills
                        .filter((b: ApBillRecord) => b.stage === stage)
                        .map((b: ApBillRecord) => (
                          <div
                            key={b.id}
                            className="border-border bg-background rounded-lg border p-2 text-[11px]"
                          >
                            <div className="leading-snug font-medium">{b.supplierName}</div>
                            <div className="mt-1 font-semibold tabular-nums">
                              {formatCurrency(b.amount)}
                            </div>
                            <div className="text-muted-foreground mt-1">{b.reference}</div>
                          </div>
                        ))}
                    </div>
                  </Card>
                ))}
              </div>

              <div className="mt-6">
                <div className="mb-3 text-sm font-semibold">AP aging (open bills)</div>
                <div className="grid gap-2">
                  {data.agingAp.map((row) => (
                    <div
                      key={row.bucket}
                      className="border-border bg-card flex items-center justify-between rounded-xl border px-3 py-2 text-sm"
                    >
                      <span className="text-muted-foreground">{row.bucket}</span>
                      <span className="font-semibold tabular-nums">
                        {formatCurrency(row.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent
          value="ledger"
          className="space-y-4 outline-none"
        >
          <Card className="border-border bg-card overflow-hidden p-0">
            <div className="border-border border-b px-5 py-4">
              <div className="text-sm font-semibold">Recent journal entries</div>
              <p className="text-muted-foreground text-xs">
                Double-entry lines synced from POS, inventory, payroll, and procurement bots —
                expand production rows for full drill-down.
              </p>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="text-[10px] tracking-wider uppercase">Posted</TableHead>
                    <TableHead className="text-[10px] tracking-wider uppercase">JE</TableHead>
                    <TableHead className="text-[10px] tracking-wider uppercase">Source</TableHead>
                    <TableHead className="text-[10px] tracking-wider uppercase">Memo</TableHead>
                    <TableHead className="text-[10px] tracking-wider uppercase">Lines</TableHead>
                    <TableHead className="text-[10px] tracking-wider uppercase">By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data.journalEntries ?? []).map((je) => (
                    <TableRow key={je.id}>
                      <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                        {je.postedDate}
                      </TableCell>
                      <TableCell className="font-mono text-xs font-medium">{je.id}</TableCell>
                      <TableCell className="text-xs capitalize">{je.sourceModule}</TableCell>
                      <TableCell className="text-muted-foreground max-w-[220px] text-xs">
                        {je.memo}
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="space-y-1">
                          {(je.lines ?? []).map((line, idx) => (
                            <div
                              key={idx}
                              className="flex flex-wrap gap-x-2 gap-y-0.5 font-mono text-[11px]"
                            >
                              <span>{line.account}</span>
                              {line.debit > 0 ? (
                                <span className="text-foreground">
                                  DR {formatCurrency(line.debit)}
                                </span>
                              ) : null}
                              {line.credit > 0 ? (
                                <span className="text-muted-foreground">
                                  CR {formatCurrency(line.credit)}
                                </span>
                              ) : null}
                            </div>
                          ))}
                        </div>
                        {je.sourceDocId ? (
                          <Badge
                            variant="outline"
                            className="mt-2 text-[10px] font-normal"
                          >
                            Doc {je.sourceDocId}
                          </Badge>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">{je.postedBy}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>

          <Card className="border-border bg-card p-5">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <ClipboardCheck className="h-4 w-4" />
              Audit trail (immutable log)
            </div>
            <div className="space-y-3">
              {(data.auditLog ?? []).map((row) => (
                <div
                  key={row.id}
                  className="border-border bg-muted/20 flex flex-wrap gap-x-4 gap-y-1 rounded-lg border px-3 py-2 text-xs"
                >
                  <span className="text-muted-foreground">{format(parseISO(row.at), 'PPp')}</span>
                  <span className="font-medium">{row.actor}</span>
                  <span className="text-muted-foreground">{row.action}</span>
                  <Badge
                    variant="outline"
                    className="text-[10px] font-normal"
                  >
                    {row.entityRef}
                  </Badge>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent
          value="bank"
          className="outline-none"
        >
          <Card className="border-border bg-card overflow-hidden p-0">
            <div className="border-border border-b px-5 py-4">
              <div className="text-sm font-semibold">Bank feed reconciliation</div>
              <p className="text-muted-foreground text-xs">
                Matches suggested by Velon — clerks confirm or split before GL posting locks.
              </p>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="text-[10px] tracking-wider uppercase">Date</TableHead>
                    <TableHead className="text-[10px] tracking-wider uppercase">
                      Description
                    </TableHead>
                    <TableHead className="text-[10px] tracking-wider uppercase">Amount</TableHead>
                    <TableHead className="text-[10px] tracking-wider uppercase">Match</TableHead>
                    <TableHead className="text-[10px] tracking-wider uppercase">Linked</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data.bankFeed ?? []).map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="text-xs whitespace-nowrap">{row.bookedDate}</TableCell>
                      <TableCell className="text-muted-foreground max-w-[260px] text-xs">
                        {row.description}
                      </TableCell>
                      <TableCell
                        className={`text-xs font-semibold tabular-nums ${row.amount < 0 ? 'text-destructive' : 'text-success'}`}
                      >
                        {formatCurrency(row.amount)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-[10px] capitalize ${
                            row.matchStatus === 'matched'
                              ? 'border-success/30 bg-success/10 text-success'
                              : row.matchStatus === 'suggested'
                                ? 'border-warning/40 bg-warning/15 text-warning-foreground'
                                : 'border-destructive/30 bg-destructive/10 text-destructive'
                          }`}
                        >
                          {row.matchStatus.replaceAll('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {row.matchedTo ?? '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent
          value="reports"
          className="outline-none"
        >
          <Card className="border-border bg-card p-6">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <FileSpreadsheet className="h-4 w-4" />
              Financial reporting exports
            </div>
            <p className="text-muted-foreground mb-4 text-sm">
              Download CSV packs generated from live POS sales, journal entries, and workspace KPIs.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                className="bg-foreground text-background hover:bg-foreground/90 rounded-lg"
                onClick={() => {
                  exportBalanceSheetCsv(data);
                  toast.success('Balance sheet CSV downloaded.');
                }}
              >
                Balance sheet
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-lg"
                onClick={() => {
                  exportPlCsv(data);
                  toast.success('P&amp;L detail CSV downloaded.');
                }}
              >
                P&amp;L detail
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-lg"
                onClick={() => {
                  exportTrialBalanceCsv(data);
                  toast.success('Trial balance CSV downloaded.');
                }}
              >
                Trial balance
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-lg"
                onClick={() => {
                  exportConsolidationCsv(data);
                  toast.success('Consolidation CSV downloaded.');
                }}
              >
                Consolidation
              </Button>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
