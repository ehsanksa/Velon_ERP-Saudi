import { useCallback, useEffect, useRef, useState } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Barcode, Package, Plus, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { canManageInventory, normalizeVelonRole } from '@velon/shared';
import { BarcodeManagementDialog } from '@/components/inventory/barcode-management-dialog';
import { DeleteItemsDialog } from '@/components/inventory/delete-items-dialog';
import { ExpiryDateFields } from '@/components/inventory/expiry-date-fields';
import { ProductImportDialog } from '@/components/inventory/product-import-dialog';
import {
  buildVariantsPayload,
  ProductVariantsSection,
  variantsFromProductDetail,
  type ProductVariantsSectionHandle,
} from '@/components/inventory/product-variants-section';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { ModuleEmptyState } from '@/components/workspace/module-empty-state';
import { MoreOptionsSection } from '@/components/workspace/more-options-section';
import { getSessionMembershipRole } from '@/lib/auth/session';
import { useT } from '@/lib/i18n/locale-context';
import {
  createInventoryProduct,
  deleteInventoryItems,
  getInventoryProduct,
  listInventoryCategories,
  listInventoryProducts,
  listInventoryWarehouses,
  updateInventoryProduct,
  type InventoryCategory,
  type InventoryProduct,
  type InventoryWarehouse,
} from '@/lib/inventory/api';
import {
  findDuplicateVariantBarcodes,
  findDuplicateVariantSkus,
  type VariantAttributeDraft,
  type VariantRowDraft,
} from '@/lib/inventory/variants';

export const Route = createFileRoute('/app/inventory/products')({
  validateSearch: (search: Record<string, unknown>): { q?: string } => {
    const q = typeof search.q === 'string' ? search.q.trim() : '';
    return q ? { q } : {};
  },
  component: InventoryProductsPage,
});

function InventoryProductsPage() {
  const { q } = Route.useSearch();
  const navigate = useNavigate();
  const t = useT();
  const canManage = canManageInventory(normalizeVelonRole(getSessionMembershipRole() ?? 'USER'));
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [categories, setCategories] = useState<InventoryCategory[]>([]);
  const [warehouses, setWarehouses] = useState<InventoryWarehouse[]>([]);
  const [busy, setBusy] = useState(false);
  const [barcodeOpen, setBarcodeOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteIds, setDeleteIds] = useState<string[] | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [productMoreOpen, setProductMoreOpen] = useState(false);
  const [hasVariants, setHasVariants] = useState(false);
  const [variantAttributes, setVariantAttributes] = useState<VariantAttributeDraft[]>([]);
  const [variantRows, setVariantRows] = useState<VariantRowDraft[]>([]);
  const variantsSectionRef = useRef<ProductVariantsSectionHandle>(null);
  const [form, setForm] = useState({
    name: '',
    sku: '',
    barcode: '',
    imageDataUrl: '',
    categoryId: '',
    warehouseId: '',
    quantity: '0',
    unitPrice: '0',
    status: 'ACTIVE',
    itemType: 'PRODUCT' as 'PRODUCT' | 'SERVICE',
  });
  const [batchTracked, setBatchTracked] = useState(false);
  const [mfgDate, setMfgDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const isService = form.itemType === 'SERVICE';

  const refresh = useCallback(async () => {
    const [p, c, w] = await Promise.all([
      listInventoryProducts(q),
      listInventoryCategories(),
      listInventoryWarehouses(),
    ]);
    setProducts(p);
    setCategories(c);
    setWarehouses(w);
  }, [q]);

  useEffect(() => {
    refresh().catch((e) => toast.error(e instanceof Error ? e.message : 'Failed to load products'));
  }, [refresh]);

  const allProductsSelected = products.length > 0 && selectedIds.length === products.length;
  const deleteNames = products
    .filter((product) => deleteIds?.includes(product.id))
    .map((product) => product.name);

  function toggleProduct(id: string, checked: boolean) {
    setSelectedIds((current) =>
      checked ? [...new Set([...current, id])] : current.filter((value) => value !== id),
    );
  }

  async function confirmDeleteProducts() {
    if (!deleteIds?.length) return;
    setDeleting(true);
    try {
      const result = await deleteInventoryItems(deleteIds.map((id) => ({ productId: id })));
      toast.success(
        result.deleted === 1
          ? t('Item deleted')
          : t('{count} items deleted', { count: String(result.deleted) }),
      );
      if (editingId && deleteIds.includes(editingId)) resetForm();
      setSelectedIds((current) => current.filter((id) => !deleteIds.includes(id)));
      setDeleteIds(null);
      await refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('Could not delete the selected items'),
      );
    } finally {
      setDeleting(false);
    }
  }

  function resetForm() {
    setEditingId(null);
    setHasVariants(false);
    setVariantAttributes([]);
    setVariantRows([]);
    setForm({
      name: '',
      sku: '',
      barcode: '',
      imageDataUrl: '',
      categoryId: '',
      warehouseId: '',
      quantity: '0',
      unitPrice: '0',
      status: 'ACTIVE',
      itemType: 'PRODUCT',
    });
    setBatchTracked(false);
    setMfgDate('');
    setExpiryDate('');
  }

  async function startEdit(p: InventoryProduct) {
    setEditingId(p.id);
    setForm({
      name: p.name,
      sku: p.sku,
      barcode: p.barcode ?? '',
      imageDataUrl: p.imageDataUrl ?? '',
      categoryId: p.categoryId ?? '',
      warehouseId: '',
      quantity: '0',
      unitPrice: String(p.unitPrice),
      status: p.status,
      itemType: p.itemType === 'SERVICE' ? 'SERVICE' : 'PRODUCT',
    });
    setHasVariants(p.hasVariants ?? false);
    if (p.hasVariants) {
      try {
        const detail = await getInventoryProduct(p.id);
        const parsed = variantsFromProductDetail(detail);
        setVariantAttributes(parsed.attributes);
        setVariantRows(parsed.variants);
      } catch {
        setVariantAttributes([]);
        setVariantRows([]);
      }
    } else {
      setVariantAttributes([]);
      setVariantRows([]);
    }
  }

  function handleImageFile(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file');
      return;
    }
    if (file.size > 512_000) {
      toast.error('Image must be under 512 KB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setForm((f) => ({ ...f, imageDataUrl: String(reader.result ?? '') }));
    };
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    if (!canManage || !form.name.trim()) return;
    if (!isService && hasVariants) {
      const hasAttribute = variantAttributes.some(
        (a) => a.name.trim() && a.values.some((v) => v.trim()),
      );
      if (!hasAttribute) {
        toast.error('Add at least one attribute with values when variants are enabled.');
        return;
      }
      if (variantRows.length === 0) {
        toast.error('Generate variants from your attributes before saving.');
        return;
      }
      const duplicateSku = findDuplicateVariantSkus(variantRows);
      if (duplicateSku) {
        toast.error(`Each variant needs a unique SKU. Duplicate: ${duplicateSku}`);
        return;
      }
      const duplicateBarcode = findDuplicateVariantBarcodes(variantRows);
      if (duplicateBarcode) {
        toast.error(`Each variant barcode must be unique. Duplicate: ${duplicateBarcode}`);
        return;
      }
      if (variantRows.some((variant) => !variant.sku.trim())) {
        toast.error('Every variant must have a SKU.');
        return;
      }
    }
    setBusy(true);
    try {
      const useVariants = !isService && hasVariants;
      const syncedAttributes = useVariants
        ? (variantsSectionRef.current?.syncAttributes() ?? variantAttributes)
        : variantAttributes;
      const variantsPayload = buildVariantsPayload(
        useVariants,
        syncedAttributes,
        variantRows,
        form.warehouseId,
      );
      const body = {
        name: form.name.trim(),
        sku: form.sku.trim() || undefined,
        itemType: form.itemType,
        barcode: useVariants ? undefined : form.barcode.trim() || undefined,
        imageDataUrl: form.imageDataUrl.trim() || undefined,
        categoryId: form.categoryId || undefined,
        unitPrice: useVariants ? 0 : Number.parseFloat(form.unitPrice) || 0,
        status: form.status,
        hasVariants: useVariants,
        variants: variantsPayload,
        site: isService ? undefined : warehouses.find((w) => w.id === form.warehouseId)?.name,
        quantity: isService || useVariants ? 0 : Number.parseInt(form.quantity, 10) || 0,
        batchTracked: isService ? false : batchTracked,
        mfgDate: !isService && batchTracked ? mfgDate : undefined,
        expiryDate: !isService && batchTracked ? expiryDate : undefined,
      };
      if (editingId) {
        await updateInventoryProduct(editingId, body);
        toast.success('Product updated');
      } else {
        await createInventoryProduct(body);
        toast.success('Product created');
      }
      resetForm();
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save product');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {canManage && (
        <Card className="border-border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-medium">{editingId ? t('Edit product') : t('New product')}</h2>
            {!editingId && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setImportOpen(true)}
              >
                <Upload className="mr-2 h-4 w-4" />
                {t('Import CSV')}
              </Button>
            )}
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>{t('Name')}</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder={t('What you sell')}
              />
            </div>
            <div>
              <Label>{t('Type')}</Label>
              <Select
                value={form.itemType}
                onValueChange={(v) => {
                  const itemType = v === 'SERVICE' ? 'SERVICE' : 'PRODUCT';
                  setForm((f) => ({ ...f, itemType }));
                  if (itemType === 'SERVICE') {
                    setHasVariants(false);
                    setBatchTracked(false);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PRODUCT">{t('Product (stocked)')}</SelectItem>
                  <SelectItem value="SERVICE">{t('Service (no stock)')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t('Selling price')}</Label>
              <Input
                value={form.unitPrice}
                disabled={!isService && hasVariants}
                onChange={(e) => setForm((f) => ({ ...f, unitPrice: e.target.value }))}
                placeholder="0"
              />
              {!isService && hasVariants ? (
                <p className="text-muted-foreground mt-1 text-xs">
                  {t('Price is set per variant when variants are enabled.')}
                </p>
              ) : null}
            </div>
            {!editingId && !isService && !hasVariants && (
              <div>
                <Label>{t('Opening stock')}</Label>
                <Input
                  value={form.quantity}
                  onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                  placeholder="0"
                />
              </div>
            )}
            {!editingId && !isService && !hasVariants ? (
              <div className="space-y-3 sm:col-span-2">
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox
                    checked={batchTracked}
                    onCheckedChange={(c) => setBatchTracked(c === true)}
                  />
                  {t('This product has manufacturing and expiry dates.')}
                </label>
                <ExpiryDateFields
                  enabled={batchTracked}
                  mfgDate={mfgDate}
                  expiryDate={expiryDate}
                  onMfgDateChange={setMfgDate}
                  onExpiryDateChange={setExpiryDate}
                  idPrefix="product"
                />
              </div>
            ) : null}
            <div className="sm:col-span-2">
              <MoreOptionsSection
                open={productMoreOpen}
                onOpenChange={setProductMoreOpen}
              >
                <div>
                  <Label>SKU</Label>
                  <Input
                    value={form.sku}
                    onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
                    placeholder="Auto-generated if empty"
                  />
                </div>
                <div>
                  <Label>Barcode</Label>
                  <Input
                    value={form.barcode}
                    disabled={hasVariants}
                    onChange={(e) => setForm((f) => ({ ...f, barcode: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Category</Label>
                  <Select
                    value={form.categoryId || 'none'}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, categoryId: v === 'none' ? '' : v }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {categories.map((c) => (
                        <SelectItem
                          key={c.id}
                          value={c.id}
                        >
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Status</Label>
                  <Select
                    value={form.status}
                    onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="INACTIVE">Inactive</SelectItem>
                      <SelectItem value="DISCONTINUED">Discontinued</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {!editingId && !isService && (
                  <div>
                    <Label>{t('Warehouse')}</Label>
                    <Select
                      value={form.warehouseId || 'none'}
                      onValueChange={(v) =>
                        setForm((f) => ({ ...f, warehouseId: v === 'none' ? '' : v }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('Warehouse')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t('None')}</SelectItem>
                        {warehouses.map((w) => (
                          <SelectItem
                            key={w.id}
                            value={w.id}
                          >
                            {w.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="sm:col-span-2">
                  <Label>Product image</Label>
                  <Input
                    type="file"
                    accept="image/*"
                    className="mt-1"
                    onChange={(e) => handleImageFile(e.target.files?.[0] ?? null)}
                  />
                  {form.imageDataUrl ? (
                    <img
                      src={form.imageDataUrl}
                      alt="Product preview"
                      className="border-border mt-2 h-16 w-16 rounded-md border object-cover"
                    />
                  ) : null}
                </div>
              </MoreOptionsSection>
            </div>
          </div>
          {!isService ? (
            <ProductVariantsSection
              ref={variantsSectionRef}
              enabled={hasVariants}
              onEnabledChange={(enabled) => {
                setHasVariants(enabled);
                if (enabled && variantAttributes.length === 0) {
                  setVariantAttributes([{ id: crypto.randomUUID(), name: '', values: [''] }]);
                }
              }}
              readOnly={!canManage}
              baseSku={form.sku}
              defaultPrice={form.unitPrice}
              warehouseId={form.warehouseId}
              attributes={variantAttributes}
              onAttributesChange={setVariantAttributes}
              variants={variantRows}
              onVariantsChange={setVariantRows}
            />
          ) : (
            <p className="text-muted-foreground mt-3 text-sm">
              {t('Services are sold without inventory tracking or variants.')}
            </p>
          )}
          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              disabled={busy || !form.name.trim()}
              onClick={handleSave}
            >
              <Plus className="mr-2 h-4 w-4" />
              {editingId
                ? t('Save changes')
                : isService
                  ? t('Create service')
                  : t('Create product')}
            </Button>
            {editingId && (
              <Button
                size="sm"
                variant="outline"
                onClick={resetForm}
              >
                Cancel
              </Button>
            )}
          </div>
        </Card>
      )}

      {q ? (
        <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
          <span>{t('Showing products matching “{query}”', { query: q })}</span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              void navigate({ to: '/app/inventory/products', search: {} });
            }}
          >
            {t('Clear search')}
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{t('Product listing')}</h2>
        {canManage ? (
          <div className="flex flex-wrap gap-2">
            {selectedIds.length > 0 ? (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setDeleteIds(selectedIds)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {t('Delete selected')} ({selectedIds.length})
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setImportOpen(true)}
            >
              <Upload className="mr-2 h-4 w-4" />
              {t('Import CSV')}
            </Button>
            {products.length > 0 ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setBarcodeOpen(true)}
              >
                <Barcode className="mr-2 h-4 w-4" />
                {t('Barcode management')}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      <Card className="border-border bg-card hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              {canManage ? (
                <TableHead className="w-10">
                  <Checkbox
                    checked={allProductsSelected}
                    onCheckedChange={(checked) =>
                      setSelectedIds(checked === true ? products.map((product) => product.id) : [])
                    }
                    aria-label={t('Delete selected')}
                  />
                </TableHead>
              ) : null}
              <TableHead>{t('SKU')}</TableHead>
              <TableHead>{t('Name')}</TableHead>
              <TableHead>{t('Type')}</TableHead>
              <TableHead>{t('Variants')}</TableHead>
              <TableHead>{t('Category')}</TableHead>
              <TableHead>{t('Barcode')}</TableHead>
              <TableHead>{t('Image')}</TableHead>
              <TableHead>{t('Status')}</TableHead>
              <TableHead>{t('On hand')}</TableHead>
              <TableHead>{t('Price')}</TableHead>
              {canManage && <TableHead className="text-right">{t('Actions')}</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((p) => (
              <TableRow key={p.id}>
                {canManage ? (
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.includes(p.id)}
                      onCheckedChange={(checked) => toggleProduct(p.id, checked === true)}
                      aria-label={p.name}
                    />
                  </TableCell>
                ) : null}
                <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                <TableCell>{p.name}</TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {p.itemType === 'SERVICE' ? t('Service') : t('Product')}
                  </Badge>
                </TableCell>
                <TableCell>
                  {p.hasVariants ? (
                    <Badge variant="outline">
                      {t('{count} variants', { count: String(p.variantCount ?? 0) })}
                    </Badge>
                  ) : (
                    '—'
                  )}
                </TableCell>
                <TableCell>{p.category?.name ?? '—'}</TableCell>
                <TableCell className="font-mono text-xs">{p.barcode ?? '—'}</TableCell>
                <TableCell>
                  {p.imageDataUrl ? (
                    <img
                      src={p.imageDataUrl}
                      alt=""
                      className="h-8 w-8 rounded object-cover"
                    />
                  ) : (
                    '—'
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{p.status}</Badge>
                </TableCell>
                <TableCell className="tabular-nums">
                  {p.itemType === 'SERVICE' ? '—' : (p.onHand ?? 0)}
                </TableCell>
                <TableCell className="tabular-nums">{Number(p.unitPrice).toFixed(2)}</TableCell>
                {canManage && (
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => startEdit(p)}
                    >
                      {t('Edit')}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="ml-2"
                      onClick={() => setDeleteIds([p.id])}
                    >
                      {t('Delete')}
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {products.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={canManage ? 12 : 10}
                  className="p-0"
                >
                  <ModuleEmptyState
                    icon={Package}
                    title={q ? t('No products match “{query}”', { query: q }) : 'No products yet'}
                    description={
                      q
                        ? t('Try another name, SKU, or barcode.')
                        : 'Add what you sell above — then use them in invoices and quotes.'
                    }
                  />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <div className="space-y-3 md:hidden">
        {products.map((p) => (
          <Card
            key={p.id}
            className="border-border bg-card p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium">{p.name}</p>
                <p className="text-muted-foreground text-xs">{p.sku}</p>
                <Badge
                  variant="outline"
                  className="mt-1"
                >
                  {p.itemType === 'SERVICE' ? t('Service') : t('Product')}
                </Badge>
              </div>
              <Badge variant="secondary">{p.status}</Badge>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {p.hasVariants
                  ? `${p.variantCount ?? 0} variants`
                  : (p.category?.name ?? 'No category')}
              </span>
              <span className="font-semibold tabular-nums">{Number(p.unitPrice).toFixed(2)}</span>
            </div>
            {canManage && (
              <div className="mt-3 flex gap-2">
                <Checkbox
                  checked={selectedIds.includes(p.id)}
                  onCheckedChange={(checked) => toggleProduct(p.id, checked === true)}
                  aria-label={p.name}
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => startEdit(p)}
                >
                  {t('Edit')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setDeleteIds([p.id])}
                >
                  {t('Delete')}
                </Button>
              </div>
            )}
          </Card>
        ))}
        {products.length === 0 && (
          <ModuleEmptyState
            icon={Package}
            title={q ? t('No products match “{query}”', { query: q }) : 'No products yet'}
            description={
              q
                ? t('Try another name, SKU, or barcode.')
                : 'Add what you sell above — then use them in invoices and quotes.'
            }
          />
        )}
      </div>

      <DeleteItemsDialog
        count={deleteIds?.length ?? 0}
        names={deleteNames}
        pending={deleting}
        onCancel={() => setDeleteIds(null)}
        onConfirm={() => void confirmDeleteProducts()}
      />

      <BarcodeManagementDialog
        open={barcodeOpen}
        onOpenChange={setBarcodeOpen}
        products={products}
        onSaveBarcode={async (productId, barcode) => {
          await updateInventoryProduct(productId, { barcode });
          await refresh();
        }}
      />

      <ProductImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={() => {
          void refresh();
        }}
      />
    </div>
  );
}
