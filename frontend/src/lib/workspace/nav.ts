import {
  BarChart3,
  BookOpen,
  Boxes,
  FileText,
  LayoutDashboard,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Truck,
  UserCircle,
  Users,
  Wallet,
} from 'lucide-react';
import type { NavGroup } from '@/components/workspace/app-shell';

export type WorkspaceNavBadges = {
  billingOpen: number;
  alerts: number;
};

function countBadge(n: number): string | undefined {
  if (n <= 0) return undefined;
  return n > 99 ? '99+' : String(n);
}

/** Simple, flat sidebar — business words, not ERP jargon. */
export function buildWorkspaceNavGroups(badges: WorkspaceNavBadges): NavGroup[] {
  return [
    {
      label: 'Menu',
      items: [
        { label: 'Dashboard', to: '/app', icon: LayoutDashboard },
        { label: 'Sales', to: '/app/sales-crm', icon: ShoppingBag },
        { label: 'Invoices', to: '/app/invoices', icon: FileText },
        { label: 'Purchases', to: '/app/procurement', icon: ShoppingCart },
        { label: 'Inventory', to: '/app/inventory', icon: Boxes },
        { label: 'Customers', to: '/app/customers', icon: Users },
        { label: 'Vendors', to: '/app/suppliers', icon: Truck },
        { label: 'Accounting', to: '/app/accounting', icon: Wallet },
        { label: 'HR & Payroll', to: '/app/hr', icon: UserCircle },
        {
          label: 'Reports',
          to: '/app/reports',
          icon: BarChart3,
          badge: countBadge(badges.alerts),
        },
        {
          label: 'Settings',
          to: '/app/settings',
          search: { tab: 'general' },
          icon: Settings,
        },
        { label: 'User guide', to: '/app/help', icon: BookOpen },
      ],
    },
  ];
}

export function flattenWorkspaceNavLabels(groups: NavGroup[]): string[] {
  return groups.flatMap((g) => g.items.map((i) => i.label));
}
