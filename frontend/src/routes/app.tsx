import { createFileRoute, Outlet, useRouterState } from '@tanstack/react-router';
import { WorkspaceAuthGate } from '@/components/auth/auth-gate';
import { WorkspaceShell } from '@/components/workspace/workspace-shell';
import { requireWorkspaceAccess } from '@/lib/auth/route-guard';

export const Route = createFileRoute('/app')({
  beforeLoad: () => {
    requireWorkspaceAccess();
  },
  head: () => ({
    meta: [
      { title: 'Workspace · Velon-ERP' },
      {
        name: 'description',
        content:
          'Easy and affordable ERP for growing businesses — simple like Khatabook, powerful when you need it.',
      },
    ],
  }),
  component: AppLayout,
});

function AppLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const titleByPath: Record<string, { title: string; subtitle: string }> = {
    '/app': {
      title: 'Dashboard',
      subtitle: 'Your daily business at a glance',
    },
    '/app/inventory': {
      title: 'Inventory',
      subtitle: 'Products, stock levels, and warehouses',
    },
    '/app/billing-pos': {
      title: 'Quick Sale',
      subtitle: 'Fast POS billing for walk-in sales',
    },
    '/app/invoices': {
      title: 'Invoices',
      subtitle: 'Create and manage customer invoices',
    },
    '/app/invoices/create': {
      title: 'Create Invoice',
      subtitle: 'Professional invoice workflow with inventory products',
    },
    '/app/customers': {
      title: 'Customers',
      subtitle: 'People and businesses you sell to',
    },
    '/app/suppliers': {
      title: 'Vendors',
      subtitle: 'Suppliers you buy from',
    },
    '/app/sales-crm': {
      title: 'Sales',
      subtitle: 'Leads, quotes, and sales pipeline',
    },
    '/app/accounting': {
      title: 'Accounting',
      subtitle: 'Money in, money out, and balances',
    },
    '/app/reports': {
      title: 'Reports',
      subtitle: 'Sales, purchases, profit, and tax — in plain language',
    },
    '/app/documents': {
      title: 'Documents',
      subtitle: 'Invoices, receipts, and files',
    },
    '/app/alerts': {
      title: 'Alerts',
      subtitle: 'Important notifications for your business',
    },
    '/app/branches': {
      title: 'Branches',
      subtitle: 'Stores, offices, and locations',
    },
    '/app/procurement': {
      title: 'Purchases',
      subtitle: 'Buy stock and manage vendor orders',
    },
    '/app/hr': {
      title: 'HR & Payroll',
      subtitle: 'Employees, leave, attendance, and payroll',
    },
    '/app/settings/billing': {
      title: 'Subscription',
      subtitle: 'Your Velon plan and billing',
    },
    '/app/settings/admin': {
      title: 'Workspace admin',
      subtitle: 'Users, roles, departments, and permissions',
    },
    '/app/settings': {
      title: 'Settings',
      subtitle: 'Profile, preferences, and workspace defaults',
    },
    '/app/help': {
      title: 'User guide',
      subtitle: 'How to use Inventory, import CSV, sales, and settings',
    },
    '/app/crm/leads': {
      title: 'Sales',
      subtitle: 'Leads, quotes, and sales pipeline',
    },
    '/app/crm/opportunities': {
      title: 'Sales',
      subtitle: 'Leads, quotes, and sales pipeline',
    },
    '/app/crm/pipelines': {
      title: 'Sales',
      subtitle: 'Leads, quotes, and sales pipeline',
    },
    '/app/crm/quotations': {
      title: 'Sales',
      subtitle: 'Leads, quotes, and sales pipeline',
    },
    '/app/crm/proposals': {
      title: 'Sales',
      subtitle: 'Leads, quotes, and sales pipeline',
    },
    '/app/crm/templates': {
      title: 'Sales',
      subtitle: 'Leads, quotes, and sales pipeline',
    },
  };
  const page = titleByPath[pathname] ?? titleByPath['/app'];
  return (
    <WorkspaceAuthGate>
      <WorkspaceShell
        title={page.title}
        subtitle={page.subtitle}
      >
        <Outlet />
      </WorkspaceShell>
    </WorkspaceAuthGate>
  );
}
