import type {
  IndustryTemplate,
  TenantModuleFlags,
  TenantPlan,
  TenantPlatformSeed,
  TenantStatus,
} from '@/lib/platform/admin-demo';

export type TenantRecord = { id: string } & TenantPlatformSeed;

export type InvoiceRecord = {
  id: string;
  customer: string;
  /** When set, ties AR to CRM customer for 360° views */
  customerId?: string;
  amt: number;
  status: 'Paid' | 'Pending' | 'Overdue';
  /** YYYY-MM-DD for KPI rollups */
  postedDate: string;
  /** Human label shown in tables */
  label: string;
};

export type InventoryRecord = {
  id: string;
  productId?: string;
  variantId?: string;
  /** False when the catalogue row has no stock record yet. */
  hasStock?: boolean;
  /** Internal stock-keeping identifier (barcode-ready in ops) */
  sku: string;
  name: string;
  site: string;
  quantity: number;
  stockLevel: 'healthy' | 'low' | 'critical';
  /** Minimum buffer before critical exposure */
  safetyStock: number;
  /** Level at which replenishment is suggested */
  reorderPoint: number;
  /** ABC prioritization (value / focus tier) */
  abcClass: 'A' | 'B' | 'C';
  /** Demand velocity for slow-mover reviews */
  velocity: 'fast' | 'medium' | 'slow';
  /** Lot / batch traceability enabled */
  batchTracked: boolean;
  mfgDate?: string;
  expiryDate?: string;
  expiryStatus?: 'ok' | 'expiring_soon' | 'expired' | 'no_expiry';
  batches?: Array<{
    id: string;
    quantity: number;
    mfgDate: string;
    expiryDate: string;
    expiryStatus: string;
  }>;
  /** Optional parent product when this row is a variant */
  variantParent?: string;
  /** Demo unit cost / list price for sorting and extension value (replace with costing integration). */
  unitPrice: number;
};

export type WorkspaceAlertPriority = 'critical' | 'high' | 'medium' | 'low';

export type WorkspaceAlertRecord = {
  id: string;
  title: string;
  detail?: string;
  priority: WorkspaceAlertPriority;
  source: 'inventory' | 'invoice' | 'customer' | 'supplier';
  entityId: string;
};

export function computeStockLevel(
  quantity: number,
  safetyStock: number,
  reorderPoint: number,
): InventoryRecord['stockLevel'] {
  if (quantity <= safetyStock) return 'critical';
  if (quantity <= reorderPoint) return 'low';
  return 'healthy';
}

export type ContactLead = {
  id: string;
  createdAt: string;
  fullName: string;
  email: string;
  company?: string;
  phone?: string;
  message: string;
};

export type CustomerActivityKind = 'email' | 'call' | 'ticket' | 'note' | 'visit' | 'order';

export type CustomerActivityRecord = {
  id: string;
  customerId: string;
  kind: CustomerActivityKind;
  title: string;
  /** ISO timestamp */
  at: string;
};

export type CustomerRecord = {
  id: string;
  name: string;
  outstandingDue: number;
  status: 'active' | 'due' | 'overdue';
  email: string;
  phone: string;
  parentCompany?: string;
  accountManager: string;
  creditLimit: number;
  /** Demo CLV — replace with computed rollups */
  lifetimeValue: number;
  openOpportunities: number;
  /** 0–100 demo win rate on qualified deals */
  winRatePct: number;
  /** 0–100 composite health for heat-style UI */
  healthScore: number;
};

export type CreateCustomerInput = Pick<CustomerRecord, 'name' | 'outstandingDue' | 'status'> &
  Partial<
    Pick<
      CustomerRecord,
      | 'email'
      | 'phone'
      | 'parentCompany'
      | 'accountManager'
      | 'creditLimit'
      | 'lifetimeValue'
      | 'openOpportunities'
      | 'winRatePct'
      | 'healthScore'
    >
  >;

export type SupplierLifecycle = 'active' | 'onboarding' | 'blocked';

export type SupplierRiskTier = 'low' | 'medium' | 'high';

/** Procure-to-pay lifecycle stage for a purchase order (demo). */
export type SupplierPoStage =
  | 'draft'
  | 'sent'
  | 'acknowledged'
  | 'partial'
  | 'received'
  | 'invoiced';

export type SupplierRecord = {
  id: string;
  name: string;
  outstanding: number;
  /** Display label on cards (e.g. paid · due in 3 days · overdue) */
  paymentStatus: string;
  email: string;
  region: string;
  /** Primary supply category for filters / search */
  category: string;
  lifecycle: SupplierLifecycle;
  /** 0–100 on-time delivery rate (demo KPI) */
  onTimeDeliveryPct: number;
  /** 0–100 quality score (demo KPI) */
  qualityScore: number;
  riskTier: SupplierRiskTier;
  /** Rolling annual spend proxy for TCO-style views */
  annualSpend: number;
  /** Short catalog hint for intelligent search */
  primaryCatalog: string;
  /** YYYY-MM-DD when master agreement renews (optional) */
  contractRenewalDate?: string;
  /** Shown when lifecycle is onboarding */
  onboardingStep?: string;
};

export type SupplierPurchaseOrder = {
  id: string;
  supplierId: string;
  poNumber: string;
  amount: number;
  stage: SupplierPoStage;
  /** YYYY-MM-DD expected goods receipt */
  expectedDate: string;
  /** Short line description */
  label: string;
};

export type SupplierThreadRecord = {
  id: string;
  supplierId: string;
  /** ISO timestamp */
  at: string;
  author: string;
  body: string;
};

export type CreateSupplierInput = Pick<SupplierRecord, 'name'> &
  Partial<Omit<SupplierRecord, 'id' | 'name'>>;

export type CrmStage = 'New' | 'Qualified' | 'Proposal' | 'Won';

export type CrmQuoteStatus = 'none' | 'draft' | 'sent' | 'viewed';

export type CrmDealActivityKind = 'call' | 'email' | 'meeting' | 'note' | 'task';

export type CrmDealActivityRecord = {
  id: string;
  leadId: string;
  kind: CrmDealActivityKind;
  title: string;
  /** ISO timestamp */
  at: string;
};

export type CrmLeadRecord = {
  id: string;
  title: string;
  company: string;
  stage: CrmStage;
  estimatedValue: number;
  /** When company matches a workspace customer — drives AR / credit context */
  customerId?: string;
  /** Demo predictive close propensity 0–100 */
  aiScore: number;
  quoteStatus: CrmQuoteStatus;
  owner: string;
  nextStep: string;
  /** YYYY-MM-DD follow-up anchor */
  nextStepDue: string;
};

export type CreateCrmLeadInput = Pick<
  CrmLeadRecord,
  'title' | 'company' | 'stage' | 'estimatedValue'
> &
  Partial<
    Pick<
      CrmLeadRecord,
      'customerId' | 'aiScore' | 'quoteStatus' | 'owner' | 'nextStep' | 'nextStepDue'
    >
  >;

export type JournalEntryLine = {
  account: string;
  debit: number;
  credit: number;
};

export type JournalEntryRecord = {
  id: string;
  postedDate: string;
  memo: string;
  sourceModule: 'sales' | 'purchasing' | 'inventory' | 'payroll' | 'manual';
  /** Source document id when synced from ops (e.g. INV-2841, PO-4821) */
  sourceDocId?: string;
  lines: JournalEntryLine[];
  postedBy: string;
};

export type BankFeedRecord = {
  id: string;
  bookedDate: string;
  description: string;
  /** Positive = deposit */
  amount: number;
  matchStatus: 'matched' | 'suggested' | 'unmatched';
  matchedTo?: string;
};

export type ApBillStage = 'pending_review' | 'exception' | 'approved' | 'scheduled' | 'paid';

export type ApBillRecord = {
  id: string;
  supplierName: string;
  supplierId?: string;
  amount: number;
  dueDate: string;
  stage: ApBillStage;
  reference: string;
};

export type AccountingAuditRecord = {
  id: string;
  at: string;
  actor: string;
  action: string;
  entityRef: string;
};

export type WorkspaceBranchKind = 'store';

export type WorkspaceBranchProfile = {
  id: string;
  name: string;
  kind: WorkspaceBranchKind;
  /** Inventory `site` values rolled into this branch */
  inventorySites: string[];
  /** Demo MTD sales attributed to branch POS */
  salesMtd: number;
};

export type BranchOperationalTask = {
  id: string;
  branchId: string;
  title: string;
  kind: 'grn' | 'pick' | 'pr_approval' | 'expense' | 'asset' | 'document';
  priority: 'high' | 'normal';
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function addCalendarDays(isoDate: string, delta: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  return dt.toISOString().slice(0, 10);
}

export type TenantWizardInput = {
  name: string;
  country: string;
  plan: TenantRecord['plan'];
  users: number;
  mrr: number;
  status: TenantRecord['status'];
  slug?: string;
  industryTemplate: IndustryTemplate;
};

export type PlatformRevenuePoint = { month: string; mrr: number };
export type PlatformTenantSignupPoint = { month: string; newTenants: number };
export type PlatformActivityItem = {
  id: string;
  kind: 'signup' | 'billing' | 'security' | 'support' | 'infra';
  title: string;
  timeLabel: string;
  severity: 'info' | 'warning' | 'critical';
};
export type PlatformSystemLog = {
  id: string;
  at: string;
  level: 'info' | 'warn' | 'error';
  message: string;
};
export type PlatformModuleUsage = { module: string; pct: number };
export type PlatformPlanSlice = { plan: string; pct: number };

export type SubscriptionBillingStatus = 'Active' | 'Trial' | 'Past due' | 'Cancelled';

export type SubscriptionClientRow = {
  tenantId: string;
  clientName: string;
  plan: TenantPlan;
  billingDate: string;
  billingStatus: SubscriptionBillingStatus;
  mrr: number;
  lastInvoiceId: string;
  renewalSoon: boolean;
  failedPayment: boolean;
};

export type SubscriptionPlanCatalogEntry = {
  id: string;
  name: string;
  monthlyPrice: number | null;
  annualPrice: number | null;
  description: string;
  seatsSummary: string;
  activeRenewals: number;
  customPricing: boolean;
  trialDaysDefault: number;
  hiddenFromCatalog: boolean;
  limits: { users: number; storageGb: number; invoicesPerMo: number; branches: number };
  modules: TenantModuleFlags;
};

export type SubscriptionCouponEntry = {
  id: string;
  code: string;
  description: string;
  active: boolean;
  usesLeft?: number;
  kind: 'trial_extension' | 'percent_off' | 'seat_bundle';
};

export type SubscriptionInvoiceLogEntry = {
  id: string;
  clientName: string;
  amount: number;
  status: 'Paid' | 'Pending' | 'Failed';
  label: string;
  gateway: 'Razorpay' | 'Stripe' | 'Offline';
};

export type SubscriptionSparkPoint = { month: string; mrr: number };

function daysFromToday(isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map(Number);
  const target = new Date(y, m - 1, d).setHours(12, 0, 0, 0);
  const now = new Date();
  now.setHours(12, 0, 0, 0);
  return Math.round((target - now.getTime()) / 86400000);
}

function tenantToBillingStatus(status: TenantStatus): SubscriptionBillingStatus {
  if (status === 'Suspended') return 'Cancelled';
  return status as SubscriptionBillingStatus;
}

export type SalesCommercialAlertKind =
  | 'payment_failed'
  | 'big_fish'
  | 'renewal_cluster'
  | 'credit_limit';

export type SalesCommercialAlert = {
  id: string;
  kind: SalesCommercialAlertKind;
  title: string;
  detail: string;
  regionLabel: string;
  timeLabel: string;
  primaryAction: { id: string; label: string };
  secondaryAction?: { id: string; label: string };
};

export type SalesCommercialAuditKind = 'pricing' | 'discount' | 'refund' | 'override';

export type SalesCommercialAuditEntry = {
  id: string;
  at: string;
  kind: SalesCommercialAuditKind;
  summary: string;
  primaryAction?: { id: string; label: string };
  secondaryAction?: { id: string; label: string };
};

export type SalesLeakageKind = 'overdue_invoice' | 'stale_quote' | 'trial_cap';

export type SalesLeakageRow = {
  id: string;
  kind: SalesLeakageKind;
  title: string;
  tenantName: string;
  regionLabel: string;
  amountLocal: number;
  meta: string;
};

export type SalesRegionPulseRow = {
  regionId: string;
  label: string;
  mrrLocal: number;
  /** Demo MoM growth % for the trading-floor view */
  growthPct: number;
  tenantCount: number;
};

export type SalesPartnerLeaderRow = {
  name: string;
  code: string;
  dealsClosed: number;
  commissionMtdLocal: number;
  tier: 'Gold' | 'Silver' | 'Bronze';
  targetPct: number;
};

function inferSalesControlRegion(country: string): { id: string; label: string } {
  const c = country.toLowerCase();
  if (c.includes('india')) return { id: 'ap-south-1', label: 'ap-south-1 · Mumbai' };
  if (c.includes('united states') || c === 'usa')
    return { id: 'us-east-1', label: 'us-east-1 · N. Virginia' };
  if (
    c.includes('germany') ||
    c.includes('sweden') ||
    c.includes('netherlands') ||
    c.includes('france')
  )
    return { id: 'eu-west-1', label: 'eu-west-1 · Ireland' };
  if (c.includes('australia')) return { id: 'ap-southeast-2', label: 'ap-southeast-2 · Sydney' };
  if (c.includes('emirates') || c.includes('uae') || c.includes('arab'))
    return { id: 'me-central-1', label: 'me-central-1 · UAE' };
  return { id: 'us-east-1', label: 'us-east-1 · N. Virginia' };
}

export type AutomationDomainId =
  | 'billing'
  | 'infrastructure'
  | 'security'
  | 'lifecycle'
  | 'engagement';

export type AutomationStepKind =
  | 'email'
  | 'sms'
  | 'webhook'
  | 'notify'
  | 'suspend'
  | 'branch'
  | 'alert'
  | 'retry'
  | 'downgrade'
  | 'upsell';

export type AutomationWorkflowDef = {
  id: string;
  domain: AutomationDomainId;
  triggerLabel: string;
  summaryLine: string;
  steps: { kind: AutomationStepKind; label: string }[];
  status: 'active' | 'paused' | 'draft';
  runsPerMonthLabel: string;
  lastRunLabel: string;
  recentFailures: number;
  p95Ms: number;
  /** Short note on side-effect class for admins */
  blastRadius: 'read_only' | 'notify' | 'billing' | 'destructive';
};

export type AutomationSystemPulse = {
  executions24h: number;
  successRatePct: number;
  activeErrors: number;
  stuckRetries: number;
  pausedWorkflows: number;
};

export type AlertsPulsePoint = { bucket: string; errors: number };

export type AlertsHealthPulse = {
  sparkline60m: AlertsPulsePoint[];
  unresolvedCriticals: number;
  logIngestionLive: boolean;
  ingestionLagMs: number;
};

export type LiveAlertSeverity = 'critical' | 'warning' | 'info';

export type LiveAlertItem = {
  id: string;
  title: string;
  severity: LiveAlertSeverity;
  timeLabel: string;
  grouped: boolean;
  groupCountLabel?: string;
  rcaHint: string;
  tags: string[];
};

export type AuditEntityKind = 'tenant' | 'user' | 'invoice' | 'webhook' | 'system';

export type AuditLogRow = {
  id: string;
  isoDate: string;
  actor: string;
  actorRole: string;
  action: string;
  entityKind: AuditEntityKind;
  entityName: string;
  entityRef: string;
  status: string;
  diffSummary?: string;
  tamper: 'verified' | 'pending';
};

export type CreateInventoryInput = Pick<InventoryRecord, 'name' | 'site' | 'quantity'> &
  Partial<
    Pick<
      InventoryRecord,
      | 'sku'
      | 'safetyStock'
      | 'reorderPoint'
      | 'abcClass'
      | 'velocity'
      | 'batchTracked'
      | 'mfgDate'
      | 'expiryDate'
      | 'variantParent'
      | 'unitPrice'
    >
  >;

export type FinanceExpenseDrillNode = {
  accountKey: string;
  label: string;
  amount: number;
  entries: { jeId: string; memo: string; postedDate: string; debit: number }[];
};
