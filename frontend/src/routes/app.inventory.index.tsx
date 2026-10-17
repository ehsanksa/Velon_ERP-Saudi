import { useEffect, useMemo, useState } from 'react';
import { createFileRoute, useRouter } from '@tanstack/react-router';
import {
  Layers,
  ListFilter,
  MapPin,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  ScanBarcode,
  Trash2,
  TrendingDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { DeleteItemsDialog } from '@/components/inventory/delete-items-dialog';
import { ExpiryDateFields, ExpiryStatusBadge } from '@/components/inventory/expiry-date-fields';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { useT } from '@/lib/i18n/locale-context';
import {
  deleteInventoryItems,
  getInventoryProduct,
  listInventoryProducts,
  listInventoryWarehouses,
  receiveInventoryStock,
  type InventoryProduct,
  type InventoryWarehouse,
  type ProductVariant,
} from '@/lib/inventory/api';
import type { InventoryRecord } from '@/lib/types/workspace-ui';
import { loadInventory } from '@/lib/workspace/loaders';
import { createInventoryItem, updateInventoryItem } from '@/lib/workspace/mutations';

type InventoryListSort =
  | 'name_asc'
  | 'order_value_desc'
  | 'order_value_asc'
  | 'price_asc'
  | 'price_desc';

function extensionValue(item: InventoryRecord): number {
  return item.quantity * item.unitPrice;
}

function sortInventoryRows(rows: InventoryRecord[], sort: InventoryListSort): InventoryRecord[] {
  const arr = [...rows];
  switch (sort) {
    case 'name_asc':
      return arr.sort((a, b) => a.name.localeCompare(b.name));
    case 'order_value_desc':
      return arr.sort((a, b) => extensionValue(b) - extensionValue(a));
    case 'order_value_asc':
      return arr.sort((a, b) => extensionValue(a) - extensionValue(b));
    case 'price_asc':
      return arr.sort((a, b) => a.unitPrice - b.unitPrice);
    case 'price_desc':
      return arr.sort((a, b) => b.unitPrice - a.unitPrice);
    default:
      return arr;
  }
}

function stockBadgeClass(level: InventoryRecord['stockLevel']) {
  switch (level) {
    case 'healthy':
      return 'border-success/30 bg-success/10 text-success';
    case 'low':
      return 'border-warning/40 bg-warning/15 text-warning-foreground';
    case 'critical':
      return 'border-destructive/30 bg-destructive/10 text-destructive';
    default:
      return 'border-border';
  }
}

function abcBadgeClass(tier: InventoryRecord['abcClass']) {
  if (tier === 'A') return 'border-foreground bg-foreground text-background';
  if (tier === 'B') return 'border-border bg-muted/50';
  return 'border-border text-muted-foreground';
}

/** Heuristic suggested replenishment units based on reorder levels. */
function suggestedReorderUnits(item: InventoryRecord): number {
  const target = item.reorderPoint + item.safetyStock;
  return Math.max(0, target - item.quantity);
}

function needsReplenishment(item: InventoryRecord): boolean {
  return item.reorderPoint > 0 && item.quantity <= item.reorderPoint;
}

export const Route = createFileRoute('/app/inventory/')({
  loader: () => loadInventory(),
  component: InventoryPage,
});

function InventoryPage() {
  const router = useRouter();
  const t = useT();
  const { formatCurrency } = useWorkspaceCurrency();
  const loaded = Route.useLoaderData();
  const [items, setItems] = useState<InventoryRecord[]>(loaded);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteIds, setDeleteIds] = useState<string[] | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function refreshInventory() {
      let lastError: unknown;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const rows = await loadInventory();
          if (!cancelled) {
            setItems(rows);
            setLoadError(null);
          }
          return;
        } catch (error) {
          lastError = error;
          await new Promise((resolve) => setTimeout(resolve, 700));
        }
      }
      if (cancelled) return;
      const message =
        lastError instanceof Error ? lastError.message : t('Failed to load inventory');
      setLoadError(message);
      toast.error(message);
    }
    void refreshInventory();
    return () => {
      cancelled = true;
    };
  }, [loaded, t]);
  const [listSort, setListSort] = useState<InventoryListSort>('name_asc');
  const [expiryFilter, setExpiryFilter] = useState('all');

  const filteredItems = useMemo(() => {
    if (expiryFilter === 'all') return items;
    return items.filter((i) => i.expiryStatus === expiryFilter);
  }, [items, expiryFilter]);

  const sortedItems = useMemo(
    () => sortInventoryRows(filteredItems, listSort),
    [filteredItems, listSort],
  );

  const stats = useMemo(() => {
    const totalSkus = items.length;
    const belowReorder = items.filter(needsReplenishment).length;
    const critical = items.filter((i) => i.stockLevel === 'critical').length;
    const locations = new Set(items.map((i) => i.site).filter(Boolean)).size;
    return { totalSkus, belowReorder, critical, locations };
  }, [items]);

  const bySite = useMemo(() => {
    const m = new Map<string, { skus: number; units: number }>();
    for (const i of items) {
      if (!i.site) continue;
      const cur = m.get(i.site) ?? { skus: 0, units: 0 };
      m.set(i.site, { skus: cur.skus + 1, units: cur.units + i.quantity });
    }
    return [...m.entries()].map(([site, v]) => ({ site, ...v }));
  }, [items]);

  const abcCounts = useMemo(() => {
    return {
      A: items.filter((i) => i.abcClass === 'A').length,
      B: items.filter((i) => i.abcClass === 'B').length,
      C: items.filter((i) => i.abcClass === 'C').length,
    };
  }, [items]);

  const abcTotal = abcCounts.A + abcCounts.B + abcCounts.C || 1;
  const slowMovers = useMemo(() => sortedItems.filter((i) => i.velocity === 'slow'), [sortedItems]);

  const reorderQueue = useMemo(
    () =>
      [...items]
        .filter(needsReplenishment)
        .sort((a, b) => suggestedReorderUnits(b) - suggestedReorderUnits(a)),
    [items],
  );

  const [open, setOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState('');
  const [site, setSite] = useState('');
  const [quantity, setQuantity] = useState('0');
  const [sku, setSku] = useState('');
  const [safetyStock, setSafetyStock] = useState('5');
  const [reorderPoint, setReorderPoint] = useState('15');
  const [unitPrice, setUnitPrice] = useState('24');
  const [abcClass, setAbcClass] = useState<InventoryRecord['abcClass']>('B');
  const [velocity, setVelocity] = useState<InventoryRecord['velocity']>('medium');
  const [batchTracked, setBatchTracked] = useState(false);
  const [mfgDate, setMfgDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [variantParent, setVariantParent] = useState('');
  const [catalog, setCatalog] = useState<InventoryProduct[]>([]);
  const [warehouses, setWarehouses] = useState<InventoryWarehouse[]>([]);
  const [receiveProductId, setReceiveProductId] = useState('');
  const [receiveVariantId, setReceiveVariantId] = useState('');
  const [receiveWarehouseId, setReceiveWarehouseId] = useState('');
  const [productVariants, setProductVariants] = useState<ProductVariant[]>([]);

  const receiving = !editingItem || editingItem.hasStock === false;
  const selectedProduct = catalog.find((product) => product.id === receiveProductId);

  function resetInventoryForm() {
    setEditingItem(null);
    setName('');
    setSite('');
    setQuantity('0');
    setSku('');
    setSafetyStock('5');
    setReorderPoint('15');
    setUnitPrice('24');
    setAbcClass('B');
    setVelocity('medium');
    setBatchTracked(false);
    setMfgDate('');
    setExpiryDate('');
    setVariantParent('');
    setReceiveProductId('');
    setReceiveVariantId('');
    setReceiveWarehouseId('');
    setProductVariants([]);
  }

  async function loadReceiveCatalog() {
    const [products, warehouseRows] = await Promise.all([
      listInventoryProducts(),
      listInventoryWarehouses(),
    ]);
    const stockedProducts = products.filter((product) => product.itemType !== 'SERVICE');
    setCatalog(stockedProducts);
    setWarehouses(warehouseRows.filter((warehouse) => warehouse.isActive));
    return { products: stockedProducts, warehouseRows };
  }

  async function selectReceiveProduct(
    productId: string,
    variantId = '',
    products: InventoryProduct[] = catalog,
  ) {
    setReceiveProductId(productId);
    setReceiveVariantId(variantId);
    const product = products.find((row) => row.id === productId);
    setBatchTracked(Boolean(product?.batchTracked));
    if (!product?.hasVariants) {
      setProductVariants([]);
      return;
    }
    const detail = await getInventoryProduct(productId);
    setProductVariants(detail.variants ?? []);
    setBatchTracked(Boolean(detail.batchTracked));
  }

  function openAddDialog() {
    resetInventoryForm();
    setOpen(true);
    void loadReceiveCatalog().catch((error) => {
      toast.error(error instanceof Error ? error.message : t('Failed to load inventory'));
    });
  }

  function openEditDialog(item: InventoryRecord) {
    if (item.hasStock === false) {
      resetInventoryForm();
      setOpen(true);
      void loadReceiveCatalog()
        .then(({ products }) =>
          selectReceiveProduct(item.productId ?? '', item.variantId ?? '', products),
        )
        .catch((error) => {
          toast.error(error instanceof Error ? error.message : t('Failed to load inventory'));
        });
      if (item.productId) setReceiveProductId(item.productId);
      if (item.variantId) setReceiveVariantId(item.variantId);
      setBatchTracked(item.batchTracked);
      return;
    }
    setEditingItem(item);
    setName(item.name);
    setSite(item.site);
    setQuantity(String(item.quantity));
    setSku(item.sku);
    setSafetyStock(String(item.safetyStock));
    setReorderPoint(String(item.reorderPoint));
    setUnitPrice(String(item.unitPrice));
    setAbcClass(item.abcClass);
    setVelocity(item.velocity);
    setBatchTracked(item.batchTracked);
    setMfgDate(item.mfgDate ?? '');
    setExpiryDate(item.expiryDate ?? '');
    setVariantParent(item.variantParent ?? '');
    setOpen(true);
  }

  const allItemsSelected = sortedItems.length > 0 && selectedIds.length === sortedItems.length;
  const deleteTargets = items.filter((item) => deleteIds?.includes(item.id));

  function toggleItem(id: string, checked: boolean) {
    setSelectedIds((current) =>
      checked ? [...new Set([...current, id])] : current.filter((value) => value !== id),
    );
  }

  async function confirmDeleteItems() {
    if (!deleteTargets.length) return;
    setDeleting(true);
    try {
      const result = await deleteInventoryItems(
        deleteTargets.map((item) =>
          item.variantId
            ? { productId: item.productId, variantId: item.variantId }
            : { productId: item.productId },
        ),
      );
      toast.success(
        result.deleted === 1
          ? t('Item deleted')
          : t('{count} items deleted', { count: String(result.deleted) }),
      );
      setSelectedIds((current) => current.filter((id) => !deleteIds?.includes(id)));
      setDeleteIds(null);
      await router.invalidate();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('Could not delete the selected items'),
      );
    } finally {
      setDeleting(false);
    }
  }

  async function handleSaveInventory() {
    setSubmitting(true);
    try {
      const ss = Number.parseInt(safetyStock, 10);
      const rp = Number.parseInt(reorderPoint, 10);
      const price = Number.parseFloat(unitPrice);
      const qty = Number.parseInt(quantity, 10) || 0;
      if (batchTracked && qty > 0 && (!mfgDate || !expiryDate)) {
        toast.error(
          'MFG and EXP dates are required for products with manufacturing and expiry dates.',
        );
        return;
      }
      if (batchTracked && mfgDate && expiryDate && expiryDate < mfgDate) {
        toast.error('Expiry date cannot be earlier than manufacturing date.');
        return;
      }
      const data = {
        name: name.trim(),
        site: site.trim(),
        quantity: qty,
        sku: sku.trim() || undefined,
        safetyStock: Number.isFinite(ss) ? ss : undefined,
        reorderPoint: Number.isFinite(rp) ? rp : undefined,
        abcClass,
        velocity,
        batchTracked,
        mfgDate: batchTracked ? mfgDate : undefined,
        expiryDate: batchTracked ? expiryDate : undefined,
        variantParent: variantParent.trim() || undefined,
        unitPrice: Number.isFinite(price) ? price : undefined,
      };

      if (receiving) {
        if (!receiveProductId) {
          toast.error(t('Select a product'));
          return;
        }
        if (selectedProduct?.hasVariants && !receiveVariantId) {
          toast.error(t('Select a variant'));
          return;
        }
        if (!receiveWarehouseId) {
          toast.error(t('Select a warehouse'));
          return;
        }
        await receiveInventoryStock({
          productId: receiveProductId,
          variantId: receiveVariantId || undefined,
          warehouseId: receiveWarehouseId,
          quantity: qty,
          minStock: Number.isFinite(ss) ? ss : undefined,
          reorderLevel: Number.isFinite(rp) ? rp : undefined,
          mfgDate: batchTracked ? mfgDate : undefined,
          expiryDate: batchTracked ? expiryDate : undefined,
        });
        toast.success(t('Stock added'));
      } else if (editingItem) {
        await updateInventoryItem(editingItem.id, data);
        toast.success('SKU updated');
      } else {
        await createInventoryItem(data);
        toast.success('SKU added — stock status derived from safety & reorder levels');
      }
      setOpen(false);
      resetInventoryForm();
      await router.invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save product');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <Tabs
        defaultValue="desk"
        className="space-y-6"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList className="h-9 w-fit">
            <TabsTrigger value="desk">Stock desk</TabsTrigger>
            <TabsTrigger value="optimize">Optimization & accuracy</TabsTrigger>
          </TabsList>
          <p className="text-muted-foreground max-w-xl text-xs sm:text-right">
            Live balances across locations · Reorder when on-hand hits policy thresholds ·
            Scan-ready SKUs · ABC tiers for where to focus counts and capital.
          </p>
        </div>

        <TabsContent
          value="desk"
          className="mt-0 space-y-6 outline-none"
        >
          {loadError ? (
            <div className="border-destructive/40 bg-destructive/10 text-destructive rounded-lg border px-4 py-3 text-sm">
              {loadError} {t('Saved products and stock are still in the database.')}
            </div>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                label: 'Total SKUs',
                value: stats.totalSkus.toLocaleString(),
                hint: 'Active items',
              },
              {
                label: 'Below reorder',
                value: String(stats.belowReorder),
                hint: 'Auto PO candidates',
              },
              {
                label: 'Critical SKUs',
                value: String(stats.critical),
                hint: 'At or under safety stock',
              },
              { label: 'Locations', value: String(stats.locations), hint: 'Warehouses on file' },
            ].map((kpi) => (
              <Card
                key={kpi.label}
                className="border-border bg-card p-5"
              >
                <div className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                  {kpi.label}
                </div>
                <div className="mt-2 text-3xl font-semibold tracking-tight">{kpi.value}</div>
                <div className="text-muted-foreground mt-1 text-[11px]">{kpi.hint}</div>
              </Card>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="border-border bg-card p-5 lg:col-span-2">
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
                <MapPin className="text-muted-foreground h-4 w-4" />
                Multi-location snapshot
              </div>
              <div className="border-border overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead className="text-[10px] tracking-wider uppercase">Site</TableHead>
                      <TableHead className="text-[10px] tracking-wider uppercase">SKUs</TableHead>
                      <TableHead className="text-[10px] tracking-wider uppercase">
                        Units on hand
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bySite.map((row) => (
                      <TableRow key={row.site}>
                        <TableCell className="font-medium">{row.site}</TableCell>
                        <TableCell>{row.skus}</TableCell>
                        <TableCell>{row.units.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>

            <Card className="border-border bg-card p-5">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <RefreshCw className="text-muted-foreground h-4 w-4" />
                Replenishment queue
              </div>
              <p className="text-muted-foreground mb-4 text-xs">
                When on-hand crosses reorder, Velon drafts purchase suggestions from live stock
                below).
              </p>
              {reorderQueue.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  All SKUs above reorder — no drafts pending.
                </p>
              ) : (
                <ul className="space-y-3 text-sm">
                  {reorderQueue.map((item) => (
                    <li
                      key={item.id}
                      className="border-border bg-background rounded-lg border p-3"
                    >
                      <div className="font-medium">{item.name}</div>
                      <div className="text-muted-foreground mt-1 text-xs">{item.sku}</div>
                      <div className="mt-2 flex items-center justify-between text-xs">
                        <span>
                          Suggested PO qty:{' '}
                          <span className="text-foreground font-semibold">
                            {suggestedReorderUnits(item)}
                          </span>
                        </span>
                        <Badge
                          variant="outline"
                          className={stockBadgeClass(item.stockLevel)}
                        >
                          {item.stockLevel}
                        </Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <Dialog
            open={open}
            onOpenChange={(nextOpen) => {
              setOpen(nextOpen);
              if (!nextOpen) resetInventoryForm();
            }}
          >
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>{receiving ? t('Add stock') : 'Edit SKU'}</DialogTitle>
                <DialogDescription>
                  {receiving
                    ? t('Choose a catalogue product. Variants are stocked separately.')
                    : 'Set safety stock and reorder point — status (healthy / low / critical) is computed automatically.'}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-3 py-2">
                {receiving ? (
                  <>
                    <div className="space-y-1.5">
                      <Label>{t('Select a product')}</Label>
                      <Select
                        value={receiveProductId || 'none'}
                        onValueChange={(value) => {
                          void selectReceiveProduct(value === 'none' ? '' : value);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t('Select a product')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">{t('Select a product')}</SelectItem>
                          {catalog.map((product) => (
                            <SelectItem
                              key={product.id}
                              value={product.id}
                            >
                              {product.name} · {product.sku}
                              {product.hasVariants
                                ? ` · ${t('{count} variants', { count: String(product.variantCount ?? 0) })}`
                                : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {selectedProduct?.hasVariants ? (
                      <div className="space-y-1.5">
                        <Label>{t('Select a variant')}</Label>
                        <Select
                          value={receiveVariantId || 'none'}
                          onValueChange={(value) =>
                            setReceiveVariantId(value === 'none' ? '' : value)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={t('Select a variant')} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">{t('Select a variant')}</SelectItem>
                            {productVariants.map((variant) => (
                              <SelectItem
                                key={variant.id}
                                value={variant.id}
                              >
                                {variant.label} · {variant.sku}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-muted-foreground text-xs">
                          {t('This product has variants. Stock is tracked per variant.')}
                        </p>
                      </div>
                    ) : null}
                    <div className="space-y-1.5">
                      <Label>{t('Select a warehouse')}</Label>
                      <Select
                        value={receiveWarehouseId || 'none'}
                        onValueChange={(value) =>
                          setReceiveWarehouseId(value === 'none' ? '' : value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t('Select a warehouse')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">{t('Select a warehouse')}</SelectItem>
                          {warehouses.map((warehouse) => (
                            <SelectItem
                              key={warehouse.id}
                              value={warehouse.id}
                            >
                              {warehouse.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                ) : null}
                {!receiving ? (
                  <>
                    <div className="space-y-1.5">
                      <Label htmlFor="inv-name">Product name</Label>
                      <Input
                        id="inv-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Oat Milk Carton"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="inv-sku">SKU (optional)</Label>
                        <Input
                          id="inv-sku"
                          value={sku}
                          onChange={(e) => setSku(e.target.value)}
                          placeholder="Auto if empty"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="inv-site">Warehouse</Label>
                        <Input
                          id="inv-site"
                          value={site}
                          onChange={(e) => setSite(e.target.value)}
                          placeholder="Warehouse B"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="inv-variant">Variant group (optional)</Label>
                      <Input
                        id="inv-variant"
                        value={variantParent}
                        onChange={(e) => setVariantParent(e.target.value)}
                        placeholder="Parent product line"
                      />
                    </div>
                  </>
                ) : null}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="inv-qty">{receiving ? t('Quantity to add') : 'On hand'}</Label>
                    <Input
                      id="inv-qty"
                      inputMode="numeric"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="inv-safety">Safety stock</Label>
                    <Input
                      id="inv-safety"
                      inputMode="numeric"
                      value={safetyStock}
                      onChange={(e) => setSafetyStock(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="inv-price">Unit price</Label>
                  <Input
                    id="inv-price"
                    inputMode="decimal"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="inv-reorder">Reorder point</Label>
                    <Input
                      id="inv-reorder"
                      inputMode="numeric"
                      value={reorderPoint}
                      onChange={(e) => setReorderPoint(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>ABC class</Label>
                    <Select
                      value={abcClass}
                      onValueChange={(v) => setAbcClass(v as InventoryRecord['abcClass'])}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="A">A — high value</SelectItem>
                        <SelectItem value="B">B — medium</SelectItem>
                        <SelectItem value="C">C — long tail</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Velocity</Label>
                  <Select
                    value={velocity}
                    onValueChange={(v) => setVelocity(v as InventoryRecord['velocity'])}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fast">Fast</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="slow">Slow</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox
                    checked={batchTracked}
                    onCheckedChange={(c) => setBatchTracked(c === true)}
                  />
                  This product has manufacturing and expiry dates.
                </label>
                <ExpiryDateFields
                  enabled={batchTracked}
                  mfgDate={mfgDate}
                  expiryDate={expiryDate}
                  onMfgDateChange={setMfgDate}
                  onExpiryDateChange={setExpiryDate}
                  idPrefix="inv-desk"
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={
                    submitting ||
                    (receiving
                      ? !receiveProductId ||
                        !receiveWarehouseId ||
                        Boolean(selectedProduct?.hasVariants && !receiveVariantId)
                      : !name.trim() || !site.trim())
                  }
                  className="bg-foreground text-background hover:bg-foreground/90"
                  onClick={handleSaveInventory}
                >
                  {submitting ? 'Saving…' : receiving ? t('Add stock') : 'Update SKU'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Card className="border-border bg-card overflow-hidden p-0">
            <div className="border-border flex flex-wrap items-center justify-between gap-3 border-b p-5">
              <div>
                <h2 className="text-lg font-semibold">{t('Inventory list')}</h2>
                <p className="text-muted-foreground text-xs">
                  Table for ops · Cards on small screens
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2">
                  <ListFilter
                    className="text-muted-foreground h-4 w-4"
                    aria-hidden
                  />
                  <Select
                    value={expiryFilter}
                    onValueChange={setExpiryFilter}
                  >
                    <SelectTrigger className="h-9 w-[180px] rounded-lg text-xs">
                      <SelectValue placeholder="Expiry filter" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All stock</SelectItem>
                      <SelectItem value="expired">Expired</SelectItem>
                      <SelectItem value="expiring_soon">Expiring soon</SelectItem>
                      <SelectItem value="no_expiry">Without expiry</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={listSort}
                    onValueChange={(v) => setListSort(v as InventoryListSort)}
                  >
                    <SelectTrigger className="h-9 w-[200px] rounded-lg text-xs">
                      <SelectValue placeholder="Sort" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="name_asc">Name (A–Z)</SelectItem>
                      <SelectItem value="order_value_desc">Order value (high → low)</SelectItem>
                      <SelectItem value="order_value_asc">Order value (low → high)</SelectItem>
                      <SelectItem value="price_asc">Unit price (low → high)</SelectItem>
                      <SelectItem value="price_desc">Unit price (high → low)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="button"
                  className="bg-foreground text-background hover:bg-foreground/90"
                  onClick={openAddDialog}
                >
                  <Plus className="mr-1.5 h-4 w-4" /> {t('Add stock')}
                </Button>
                {selectedIds.length > 0 ? (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => setDeleteIds(selectedIds)}
                  >
                    <Trash2 className="mr-1.5 h-4 w-4" />
                    {t('Delete selected')} ({selectedIds.length})
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="w-10">
                      <Checkbox
                        checked={allItemsSelected}
                        onCheckedChange={(checked) =>
                          setSelectedIds(checked === true ? sortedItems.map((item) => item.id) : [])
                        }
                        aria-label={t('Delete selected')}
                      />
                    </TableHead>
                    <TableHead className="w-[100px] text-[10px] tracking-wider uppercase">
                      SKU
                    </TableHead>
                    <TableHead className="text-[10px] tracking-wider uppercase">Product</TableHead>
                    <TableHead className="text-[10px] tracking-wider uppercase">Location</TableHead>
                    <TableHead className="text-right text-[10px] tracking-wider uppercase">
                      On hand
                    </TableHead>
                    <TableHead className="text-right text-[10px] tracking-wider uppercase">
                      Safety
                    </TableHead>
                    <TableHead className="text-right text-[10px] tracking-wider uppercase">
                      Reorder
                    </TableHead>
                    <TableHead className="text-right text-[10px] tracking-wider uppercase">
                      Unit price
                    </TableHead>
                    <TableHead className="text-right text-[10px] tracking-wider uppercase">
                      Ext. value
                    </TableHead>
                    <TableHead className="text-[10px] tracking-wider uppercase">MFG Date</TableHead>
                    <TableHead className="text-[10px] tracking-wider uppercase">EXP Date</TableHead>
                    <TableHead className="text-[10px] tracking-wider uppercase">ABC</TableHead>
                    <TableHead className="text-[10px] tracking-wider uppercase">Scan</TableHead>
                    <TableHead className="text-[10px] tracking-wider uppercase">Status</TableHead>
                    <TableHead className="text-right text-[10px] tracking-wider uppercase">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.includes(item.id)}
                          onCheckedChange={(checked) => toggleItem(item.id, checked === true)}
                          aria-label={item.name}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs">{item.sku}</TableCell>
                      <TableCell>
                        <div className="font-medium">{item.name}</div>
                        {item.variantParent ? (
                          <div className="text-muted-foreground text-[11px]">
                            {item.variantParent}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {item.site || t('No warehouse')}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {item.quantity}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-right tabular-nums">
                        {item.safetyStock}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-right tabular-nums">
                        {item.reorderPoint}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-right text-xs tabular-nums">
                        {formatCurrency(item.unitPrice)}
                      </TableCell>
                      <TableCell className="text-right text-xs font-medium tabular-nums">
                        {formatCurrency(extensionValue(item))}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs tabular-nums">
                        {item.mfgDate ?? '—'}
                      </TableCell>
                      <TableCell className="text-xs tabular-nums">
                        <div className="flex items-center gap-1.5">
                          <span>{item.expiryDate ?? '—'}</span>
                          <ExpiryStatusBadge status={item.expiryStatus} />
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-normal ${abcBadgeClass(item.abcClass)}`}
                        >
                          {item.abcClass}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {item.batchTracked ? (
                          <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
                            <ScanBarcode className="h-3.5 w-3.5" /> Lot
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-[10px] capitalize ${stockBadgeClass(item.stockLevel)}`}
                        >
                          {item.stockLevel}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 rounded-lg px-2 text-xs"
                          onClick={() => openEditDialog(item)}
                        >
                          <Pencil className="mr-1 h-3.5 w-3.5" />{' '}
                          {item.hasStock === false ? t('Add stock') : 'Edit'}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive h-8 rounded-lg px-2 text-xs"
                          onClick={() => setDeleteIds([item.id])}
                        >
                          <Trash2 className="mr-1 h-3.5 w-3.5" /> {t('Delete')}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="grid gap-3 p-5 md:hidden">
              {sortedItems.map((item) => (
                <div
                  key={item.id}
                  className="border-border bg-background rounded-xl border p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <Checkbox
                      checked={selectedIds.includes(item.id)}
                      onCheckedChange={(checked) => toggleItem(item.id, checked === true)}
                      aria-label={item.name}
                    />
                    <Package className="text-muted-foreground h-4 w-4 shrink-0" />
                    <Badge
                      variant="outline"
                      className={`text-[10px] capitalize ${stockBadgeClass(item.stockLevel)}`}
                    >
                      {item.stockLevel}
                    </Badge>
                  </div>
                  <div className="text-muted-foreground mt-2 font-mono text-[11px]">{item.sku}</div>
                  <div className="mt-1 font-medium">{item.name}</div>
                  <div className="text-muted-foreground mt-1 text-xs">
                    {item.site || t('No warehouse')}
                  </div>
                  <div className="text-muted-foreground mt-2 text-[11px]">
                    {formatCurrency(item.unitPrice)} each · ext.{' '}
                    {formatCurrency(extensionValue(item))}
                  </div>
                  <div className="mt-3 flex flex-wrap items-end justify-between gap-2">
                    <div>
                      <div className="text-muted-foreground text-[10px] uppercase">On hand</div>
                      <div className="text-2xl font-semibold tabular-nums">{item.quantity}</div>
                    </div>
                    <div className="text-muted-foreground text-right text-xs">
                      Safety {item.safetyStock} · Reorder {item.reorderPoint}
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 flex-1 rounded-lg text-xs"
                      onClick={() => openEditDialog(item)}
                    >
                      <Pencil className="mr-1 h-3.5 w-3.5" /> Edit item
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-destructive h-8 rounded-lg text-xs"
                      onClick={() => setDeleteIds([item.id])}
                    >
                      {t('Delete')}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent
          value="optimize"
          className="mt-0 space-y-6 outline-none"
        >
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border-border bg-card p-6">
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
                <Layers className="text-muted-foreground h-4 w-4" />
                ABC analysis
              </div>
              <p className="text-muted-foreground mb-4 text-xs">
                Prioritize cycle counts and purchasing focus on A SKUs (roughly the 80/20 of value
                motion in this workspace).
              </p>
              <div className="space-y-3">
                {(['A', 'B', 'C'] as const).map((tier) => {
                  const n = abcCounts[tier];
                  const pct = Math.round((n / abcTotal) * 100);
                  return (
                    <div key={tier}>
                      <div className="mb-1 flex justify-between text-sm">
                        <span className="text-muted-foreground">Class {tier}</span>
                        <span className="font-semibold">
                          {n} SKU{n === 1 ? '' : 's'} · {pct}%
                        </span>
                      </div>
                      <Progress
                        value={pct}
                        className="h-1.5"
                      />
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card className="border-border bg-card p-6">
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
                <RefreshCw className="text-muted-foreground h-4 w-4" />
                Cycle counting plan
              </div>
              <p className="text-muted-foreground mb-4 text-xs">
                Rotate small slices of stock on a cadence instead of one annual wall-to-wall count —
                less disruption, tighter trust in the ledger.
              </p>
              <ul className="space-y-3 text-sm">
                {bySite.map((loc, i) => (
                  <li
                    key={loc.site}
                    className="border-border bg-background flex items-center justify-between rounded-lg border px-3 py-2"
                  >
                    <span className="font-medium">{loc.site}</span>
                    <span className="text-muted-foreground text-xs">
                      Slot {i + 1} · {loc.skus} SKUs · est. 25 min
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <Card className="border-border bg-card p-6">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
              <TrendingDown className="text-muted-foreground h-4 w-4" />
              Slow-moving and excess risk
            </div>
            {slowMovers.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No slow movers flagged in this catalog slice.
              </p>
            ) : (
              <div className="border-border overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead>SKU</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Velocity</TableHead>
                      <TableHead className="text-right">On hand</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {slowMovers.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono text-xs">{item.sku}</TableCell>
                        <TableCell>{item.name}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className="text-[10px]"
                          >
                            {item.velocity}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{item.quantity}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
      <DeleteItemsDialog
        count={deleteIds?.length ?? 0}
        names={deleteTargets.map((item) => item.name)}
        pending={deleting}
        onCancel={() => setDeleteIds(null)}
        onConfirm={() => void confirmDeleteItems()}
      />
    </div>
  );
}
