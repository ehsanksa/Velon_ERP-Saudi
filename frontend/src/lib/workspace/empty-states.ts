import { POS_DEFAULT_TICKET_LINES, type PosCatalogItem, type PosTicketLine } from '@/erp/pos-seed';
import type { TenantPlan as AdminTenantPlan } from '@/lib/platform/admin-demo';
import type {
  AccountingAuditRecord,
  ApBillRecord,
  AutomationWorkflowDef,
  BankFeedRecord,
  BranchOperationalTask,
  CrmDealActivityRecord,
  CrmLeadRecord,
  CrmStage,
  CustomerActivityRecord,
  CustomerRecord,
  InventoryRecord,
  InvoiceRecord,
  JournalEntryRecord,
  LiveAlertItem,
  SalesCommercialAlert,
  SalesCommercialAuditEntry,
  SalesLeakageRow,
  SalesPartnerLeaderRow,
  SalesRegionPulseRow,
  SubscriptionClientRow,
  SubscriptionCouponEntry,
  SubscriptionInvoiceLogEntry,
  SubscriptionPlanCatalogEntry,
  SubscriptionSparkPoint,
  SupplierPurchaseOrder,
  SupplierRecord,
  SupplierThreadRecord,
} from '@/lib/types/workspace-ui';

/** SSR placeholder before the browser session can call the tenant API. */
export function isSsrWorkspaceDashboardPlaceholder(
  data: ReturnType<typeof emptyWorkspaceDashboard>,
): boolean {
  return data.company.name === 'Your company' && data.workspace.slug === 'workspace';
}

/** Tenant-scoped empty workspace dashboard — modules populate from PostgreSQL in Phase 2D+. */
export function emptyWorkspaceDashboard() {
  return {
    company: {
      name: 'Your company',
      email: null,
      phone: null,
      country: null,
      industry: null,
      address: null,
      website: null,
      taxId: null,
      logoDataUrl: null,
    },
    workspace: {
      name: 'Workspace',
      slug: 'workspace',
      timezone: 'Asia/Riyadh',
      countryCode: 'SA',
      currency: 'SAR',
      currencySymbol: '﷼',
      dateFormat: 'DD/MM/YYYY',
      numberFormat: 'ar-SA',
      language: 'ar',
    },
    subscription: {
      plan: 'STARTER',
      planDisplayName: 'Starter',
      status: 'TRIAL',
      renewalDate: new Date().toISOString().slice(0, 10),
      seatLimit: 5,
      monthlyPrice: 49,
    },
    seats: { used: 1, limit: 5, remaining: 4, unlimited: false, pendingInvites: 0 },
    team: { activeUsers: 1, departments: 0 },
    notifications: [] as {
      id: string;
      title: string;
      body: string;
      read: boolean;
      createdAt: string;
    }[],
    recentActivity: [] as {
      id: string;
      action: string;
      entityType: string;
      entityId: string | null;
      at: string;
      actorEmail: string | null;
      actorName: string | null;
    }[],
    quickActions: [
      {
        label: 'Invite team member',
        to: '/app/settings/admin',
        search: { section: 'invitations' },
      },
      { label: 'Company settings', to: '/app/settings/admin', search: { section: 'company' } },
    ],
    crmSummary: {
      customers: 0,
      leads: 0,
      openOpportunities: 0,
      openQuotations: 0,
      activities: 0,
    },
    inventorySummary: {
      totalProducts: 0,
      lowStockAlerts: 0,
      pendingPurchaseRequests: 0,
      pendingPurchaseOrders: 0,
      warehouseCount: 0,
    },
    billingSummary: {
      invoices: 0,
    },
  };
}

export function emptyWorkspaceIdentity(name = 'Workspace') {
  return { name, website: null as string | null };
}

export function emptyWorkspaceNavBadges() {
  return { billingOpen: 0, alerts: 0 };
}

export type WorkspaceNotificationRecord = {
  id: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
};

export function emptyWorkspaceAlerts() {
  return [] as WorkspaceNotificationRecord[];
}

export function emptyCustomersWorkspace() {
  return {
    customers: [] as CustomerRecord[],
    activities: [] as CustomerActivityRecord[],
    invoices: [] as InvoiceRecord[],
    kpis: { totalCustomers: 0, overdueExposure: 0, openArLines: 0, avgHealth: 0 },
    alerts: [] as string[],
  };
}

export function emptySuppliersWorkspace() {
  return {
    suppliers: [] as SupplierRecord[],
    purchaseOrders: [] as SupplierPurchaseOrder[],
    threads: [] as SupplierThreadRecord[],
    kpis: {
      activeSuppliers: 0,
      partnersInNetwork: 0,
      openPayables: 0,
      openPoPipeline: 0,
      avgOnTimePct: 0,
      suppliersAtRisk: 0,
    },
    alerts: [] as string[],
  };
}

export function emptySalesCrmWorkspace() {
  const stageCounts = { New: 0, Qualified: 0, Proposal: 0, Won: 0 } as Record<CrmStage, number>;
  return {
    stageCounts,
    leads: [] as CrmLeadRecord[],
    activities: [] as CrmDealActivityRecord[],
    customers: [] as CustomerRecord[],
    invoices: [] as InvoiceRecord[],
    inventoryHealth: { lowStockSkus: 0, spotlightLines: [] as string[] },
    kpis: {
      openDeals: 0,
      pipelineValueOpen: 0,
      avgDealOpen: 0,
      wonValueAll: 0,
      monthlyGoal: 0,
      goalProgressPct: 0,
      pendingQuotes: 0,
      hotLeads: 0,
    },
    tasksToday: [] as { leadId: string; title: string; company: string; due: string }[],
    aiInsights: [] as string[],
  };
}

export function emptyAccountingWorkspace() {
  return {
    kpis: {
      cashbook: 0,
      expensesMtd: 0,
      receivables: 0,
      payables: 0,
      recognizedRevenueMtd: 0,
      cogsMtd: 0,
      netOperating: 0,
    },
    agingAr: [] as { bucket: string; amount: number }[],
    agingAp: [] as { bucket: string; amount: number }[],
    cashFlowTrend: [] as { period: string; inflow: number; outflow: number }[],
    automationAlerts: [] as string[],
    controlAlerts: [] as string[],
    invoices: [] as InvoiceRecord[],
    journalEntries: [] as JournalEntryRecord[],
    bankFeed: [] as BankFeedRecord[],
    apBills: [] as ApBillRecord[],
    auditLog: [] as AccountingAuditRecord[],
  };
}

export function emptyFinanceReportsWorkspace() {
  return {
    kpis: {
      operatingCash: 0,
      netMarginPct: 0,
      receivables: 0,
      payables: 0,
      revenueMtd: 0,
      expensesMtd: 0,
      budgetVariancePct: 0,
    },
    alerts: [] as string[],
    netCashSeries: [] as { period: string; net: number }[],
    expenseMix: [] as { name: string; value: number }[],
    expenseDrill: [] as import('@/lib/types/workspace-ui').FinanceExpenseDrillNode[],
    taskQueues: {
      approvals: [] as { id: string; title: string; subtitle: string }[],
      reconciliations: [] as { id: string; title: string }[],
      journals: [] as { id: string; title: string }[],
    },
    annotations: [] as {
      id: string;
      reportKey: string;
      author: string;
      body: string;
      at: string;
    }[],
    catalog: [] as { id: string; title: string; category: string; hint: string }[],
  };
}

export function emptyBranchesWorkspace() {
  return {
    branches: [] as {
      id: string;
      name: string;
      code?: string;
      kind: 'store';
      salesMtd: number;
      operationalStatus: 'healthy' | 'watch' | 'critical';
      skusTracked: number;
      lowStockSkus: number;
      criticalSkus: number;
      batchTrackedSkus: number;
      inventorySites: string[];
      address?: string;
      phone?: string;
      email?: string;
      manager?: string;
      isActive?: boolean;
      lines: {
        id: string;
        sku: string;
        name: string;
        quantity: number;
        stockLevel: string;
        reorderPoint: number;
        batchTracked: boolean;
        unitPrice: number;
      }[];
    }[],
    tasks: [] as BranchOperationalTask[],
    alerts: [] as string[],
    kpis: {
      networkMtdSales: 0,
      posLinkedSalesToday: 0,
      openTasks: 0,
      lowStockSkusNetwork: 0,
      storesInWatch: 0,
      branchCount: 0,
      totalSkus: 0,
      lowStockSkus: 0,
      criticalSkus: 0,
      salesMtdAll: 0,
    },
  };
}

export function emptyPosBootstrap() {
  return {
    defaultTicket: [] as PosTicketLine[],
    catalog: [] as PosCatalogItem[],
    variantCatalog: [] as import('@/erp/pos-seed').PosVariantCatalogItem[],
    recentTickets: [] as unknown[],
    customers: [] as { id: string; name: string }[],
  };
}

export function emptyPosBootstrapWithDemoTicket() {
  return {
    ...emptyPosBootstrap(),
    defaultTicket: POS_DEFAULT_TICKET_LINES.map((l) => ({ ...l })),
  };
}

export function emptySubscriptionCommandCenter() {
  const activeByPlan: Record<AdminTenantPlan, number> = { Starter: 0, Growth: 0, Enterprise: 0 };
  return {
    mrrTotal: 0,
    activePaidSubscriptions: 0,
    activeByPlan,
    openTrials: 0,
    trialConversionPct: 0,
    churnPct: 0,
    netMovementLabel: 'No movement',
    gatewayLabel: 'Not configured',
    dunningQueue: 0,
    revenueSparkline: [] as SubscriptionSparkPoint[],
    catalogPlans: [] as SubscriptionPlanCatalogEntry[],
    coupons: [] as SubscriptionCouponEntry[],
    invoiceLog: [] as SubscriptionInvoiceLogEntry[],
    clients: [] as SubscriptionClientRow[],
  };
}

export function emptySalesCommercialFloor() {
  return {
    activePaidSubscriptions: 0,
    checkoutSuccessRatePct: 0,
    pendingApprovalsCount: 0,
    pendingApprovalsHint: 'None pending',
    liveAlerts: [] as SalesCommercialAlert[],
    auditLog: [] as SalesCommercialAuditEntry[],
    leakage: [] as SalesLeakageRow[],
    regionPulse: [] as SalesRegionPulseRow[],
    partnerLeaderboard: [] as SalesPartnerLeaderRow[],
  };
}

export function emptyAutomationCommandCenter() {
  return {
    pulse: {
      executions24h: 0,
      successRatePct: 100,
      activeErrors: 0,
      stuckRetries: 0,
      pausedWorkflows: 0,
    },
    workflows: [] as AutomationWorkflowDef[],
  };
}

export function emptyAlertsLogsCommandCenter() {
  return {
    pulse: {
      sparkline60m: [] as { bucket: string; errors: number }[],
      unresolvedCriticals: 0,
      logIngestionLive: true,
      ingestionLagMs: 0,
    },
    liveAlerts: [] as LiveAlertItem[],
    auditLogs: [] as import('@/lib/types/workspace-ui').AuditLogRow[],
  };
}
