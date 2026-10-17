import { createFileRoute, Link, Outlet, useRouterState } from '@tanstack/react-router';
import { Boxes, FolderTree, Package, Warehouse } from 'lucide-react';
import { useT } from '@/lib/i18n/locale-context';
import { cn } from '@/lib/utils';

const inventoryNav = [
  { to: '/app/inventory', label: 'Stock', exact: true, icon: Boxes },
  { to: '/app/inventory/products', label: 'Products', icon: Package },
  { to: '/app/inventory/categories', label: 'Categories', icon: FolderTree },
  { to: '/app/inventory/warehouses', label: 'Warehouses', icon: Warehouse },
] as const;

export const Route = createFileRoute('/app/inventory')({
  component: InventoryLayout,
});

function InventoryLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const t = useT();

  return (
    <div className="space-y-6">
      <div>
        <p className="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">
          {t('Operations')}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{t('Inventory')}</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {t('Product master, categories, warehouses, and live stock.')}
        </p>
      </div>

      <nav className="border-border flex flex-wrap gap-2 border-b pb-3">
        {inventoryNav.map((item) => {
          const active =
            'exact' in item && item.exact
              ? pathname === '/app/inventory' || pathname === '/app/inventory/'
              : pathname.startsWith(item.to);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                'inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4" />
              {t(item.label)}
            </Link>
          );
        })}
      </nav>

      <Outlet />
    </div>
  );
}
