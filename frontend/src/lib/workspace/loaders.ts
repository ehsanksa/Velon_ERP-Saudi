import { apiFetch } from '@/lib/api/client';
import { isApiEnabled } from '@/lib/api/config';
import type { InventoryRecord } from '@/lib/types/workspace-ui';
import {
  emptyAccountingWorkspace,
  emptyBranchesWorkspace,
  emptyCustomersWorkspace,
  emptyFinanceReportsWorkspace,
  emptyPosBootstrap,
  emptySalesCrmWorkspace,
  emptySuppliersWorkspace,
  emptyWorkspaceAlerts,
  emptyWorkspaceDashboard,
  emptyWorkspaceIdentity,
  emptyWorkspaceNavBadges,
} from '@/lib/workspace/empty-states';
import {
  normalizeAccountingWorkspace,
  normalizeBranchesWorkspace,
  normalizeSalesCrmWorkspace,
} from '@/lib/workspace/normalize';

function isBrowserLoader(): boolean {
  return typeof window !== 'undefined';
}

function canCallAuthenticatedApi(): boolean {
  return isBrowserLoader() && isApiEnabled();
}

async function tenantFetch<T>(path: string, fallback: () => T): Promise<T> {
  if (!canCallAuthenticatedApi()) return fallback();
  try {
    return await apiFetch<T>(path);
  } catch {
    return fallback();
  }
}

export async function loadWorkspaceDashboard() {
  if (!isBrowserLoader()) {
    return emptyWorkspaceDashboard();
  }
  if (!isApiEnabled()) {
    throw new Error('API URL is not configured. Add VITE_API_URL in the web environment.');
  }
  // Session tokens live in localStorage — fetch on the client after hydration.
  return emptyWorkspaceDashboard();
}

export async function fetchWorkspaceDashboard() {
  if (!isApiEnabled()) {
    throw new Error('API URL is not configured. Add VITE_API_URL in the web environment.');
  }
  return apiFetch<Awaited<ReturnType<typeof emptyWorkspaceDashboard>>>('/workspace/dashboard');
}

export async function loadWorkspaceIdentity() {
  if (!canCallAuthenticatedApi()) return emptyWorkspaceIdentity();
  try {
    const ctx = await apiFetch<{
      workspace: { name: string };
      companyProfile: { website: string | null } | null;
    }>('/workspace/context');
    return {
      name: ctx.workspace.name,
      website: ctx.companyProfile?.website ?? null,
    };
  } catch {
    return emptyWorkspaceIdentity();
  }
}

export async function loadWorkspaceNavBadges() {
  return tenantFetch('/workspace/nav-badges', emptyWorkspaceNavBadges);
}

export async function loadWorkspaceAlerts() {
  return tenantFetch('/workspace/alerts', emptyWorkspaceAlerts);
}

export async function loadCustomersWorkspace() {
  return tenantFetch('/workspace/customers', emptyCustomersWorkspace);
}

export async function loadSuppliersWorkspace() {
  return tenantFetch('/workspace/suppliers', emptySuppliersWorkspace);
}

export async function loadSalesCrmWorkspace() {
  const raw = await tenantFetch('/workspace/sales-crm', emptySalesCrmWorkspace);
  return normalizeSalesCrmWorkspace(raw);
}

export async function loadAccountingWorkspace() {
  const raw = await tenantFetch('/workspace/accounting', emptyAccountingWorkspace);
  return normalizeAccountingWorkspace(raw);
}

export async function loadFinanceReportsWorkspace() {
  return tenantFetch('/workspace/reports', emptyFinanceReportsWorkspace);
}

export async function loadBranchesWorkspace() {
  const raw = await tenantFetch('/workspace/branches', emptyBranchesWorkspace);
  return normalizeBranchesWorkspace(raw);
}

export async function loadInventory() {
  if (!canCallAuthenticatedApi()) return [] as InventoryRecord[];
  return apiFetch<InventoryRecord[]>('/workspace/inventory');
}

export async function loadPosBootstrap() {
  return tenantFetch('/workspace/pos/bootstrap', emptyPosBootstrap);
}
