import {
  Building2,
  FileText,
  Image,
  Package,
  UserPlus,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { workspaceAdminSearch } from '@velon/shared';

export type OnboardingStep = {
  id: string;
  label: string;
  description: string;
  done: boolean;
  to: string;
  search?: Record<string, string>;
  icon: LucideIcon;
};

type DashboardSnapshot = {
  company: {
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    logoDataUrl?: string | null;
  };
  crmSummary: { customers: number; openQuotations: number };
  inventorySummary: { totalProducts: number };
  billingSummary?: { invoices: number };
  team: { activeUsers: number };
  seats: { pendingInvites: number };
};

export function buildOnboardingSteps(data: DashboardSnapshot): OnboardingStep[] {
  const hasCompanyDetails = Boolean(
    data.company.email || data.company.phone || data.company.address,
  );
  const hasCustomer = data.crmSummary.customers > 0;
  const hasProduct = data.inventorySummary.totalProducts > 0;
  const hasInvoice = (data.billingSummary?.invoices ?? 0) > 0;
  const hasTeam = data.team.activeUsers > 1 || data.seats.pendingInvites > 0;

  return [
    {
      id: 'logo',
      label: 'Upload company logo',
      description: 'Used on invoice PDFs and documents',
      done: Boolean(data.company.logoDataUrl),
      to: '/app/settings/admin',
      search: workspaceAdminSearch('company'),
      icon: Image,
    },
    {
      id: 'company',
      label: 'Add company details',
      description: 'Name, phone, and address for invoices',
      done: hasCompanyDetails,
      to: '/app/settings/admin',
      search: workspaceAdminSearch('company'),
      icon: Building2,
    },
    {
      id: 'customer',
      label: 'Add first customer',
      description: 'Start selling to real people',
      done: hasCustomer,
      to: '/app/customers',
      search: { section: 'customers' },
      icon: UserPlus,
    },
    {
      id: 'product',
      label: 'Add first product or service',
      description: 'What you sell or stock',
      done: hasProduct,
      to: '/app/inventory/products',
      icon: Package,
    },
    {
      id: 'invoice',
      label: 'Create first invoice',
      description: 'Bill a customer and track payment',
      done: hasInvoice,
      to: '/app/invoices/create',
      icon: FileText,
    },
    {
      id: 'team',
      label: 'Invite team member',
      description: 'Share access with your staff',
      done: hasTeam,
      to: '/app/settings/admin',
      search: workspaceAdminSearch('invitations'),
      icon: Users,
    },
  ];
}

export function onboardingProgress(steps: OnboardingStep[]) {
  const done = steps.filter((s) => s.done).length;
  return { done, total: steps.length, percent: Math.round((done / steps.length) * 100) };
}

const DISMISS_KEY = 'velon:onboarding:dismissed';

export function isOnboardingDismissed(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(DISMISS_KEY) === '1';
}

export function dismissOnboarding(): void {
  window.localStorage.setItem(DISMISS_KEY, '1');
}
