import { useCallback, useEffect, useRef, useState } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Barcode, Package, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { canManageInventory, normalizeVelonRole } from '@velon/shared';
import { BarcodeManagementDialog } from '@/components/inventory/barcode-management-dialog';
import { ExpiryDateFields } from '@/components/inventory/expiry-date-fields';
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
  const [editingId, setEditingId] = useState<string | null>(null);
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
  });
  const [batchTracked, setBatchTracked] = useState(false);
  const [mfgDate, setMfgDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');

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
    if (hasVariants) {
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
      const syncedAttributes = hasVariants
        ? (variantsSectionRef.current?.syncAttributes() ?? variantAttributes)
        : variantAttributes;
      const variantsPayload = buildVariantsPayload(
        hasVariants,
        syncedAttributes,
        variantRows,
        form.warehouseId,
      );
      const body = {
        name: form.name.trim(),
        sku: form.sku.trim() || undefined,
        barcode: hasVariants ? undefined : form.barcode.trim() || undefined,
        imageDataUrl: form.imageDataUrl.trim() || undefined,
        categoryId: form.categoryId || undefined,
        unitPrice: hasVariants ? 0 : Number.parseFloat(form.unitPrice) || 0,
        status: form.status,
        hasVariants,
        variants: variantsPayload,
        site: warehouses.find((w) => w.id === form.warehouseId)?.name,
        quantity: hasVariants ? 0 : Number.parseInt(form.quantity, 10) || 0,
        batchTracked,
        mfgDate: batchTracked ? mfgDate : undefined,
        expiryDate: batchTracked ? expiryDate : undefined,
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
          <h2 className="font-medium">{editingId ? 'Edit product' : 'New product'}</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="What you sell"
              />
            </div>
            <div>
              <Label>Selling price</Label>
              <Input
                value={form.unitPrice}
                disabled={hasVariants}
                onChange={(e) => setForm((f) => ({ ...f, unitPrice: e.target.value }))}
                placeholder="0"
              />
              {hasVariants ? (
                <p className="text-muted-foreground mt-1 text-xs">
                  Price is set per variant when variants are enabled.
                </p>
              ) : null}
            </div>
            {!editingId && !hasVariants && (
              <div>
                <Label>Opening stock</Label>
                <Input
                  value={form.quantity}
                  onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                  placeholder="0"
                />
              </div>
            )}
            {!editingId && !hasVariants ? (
              <div className="space-y-3 sm:col-span-2">
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
                {!editingId && (
                  <div>
                    <Label>Warehouse</Label>
                    <Select
                      value={form.warehouseId || 'none'}
                      onValueChange={(v) =>
                        setForm((f) => ({ ...f, warehouseId: v === 'none' ? '' : v }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Warehouse" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
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
          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              disabled={busy || !form.name.trim()}
              onClick={handleSave}
            >
              <Plus className="mr-2 h-4 w-4" />
              {editingId ? 'Save changes' : 'Create product'}
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
        <h2 className="text-lg font-semibold">Product listing</h2>
        {canManage && products.length > 0 ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setBarcodeOpen(true)}
          >
            <Barcode className="mr-2 h-4 w-4" />
            Barcode management
          </Button>
        ) : null}
      </div>

      <Card className="border-border bg-card hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Variants</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Barcode</TableHead>
              <TableHead>Image</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Price</TableHead>
              {canManage && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                <TableCell>{p.name}</TableCell>
                <TableCell>
                  {p.hasVariants ? (
                    <Badge variant="outline">{p.variantCount ?? 0} variants</Badge>
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
                <TableCell>{Number(p.unitPrice).toFixed(2)}</TableCell>
                {canManage && (
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => startEdit(p)}
                    >
                      Edit
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {products.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={canManage ? 9 : 8}
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
              <Button
                size="sm"
                variant="outline"
                className="mt-3 w-full"
                onClick={() => startEdit(p)}
              >
                Edit
              </Button>
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

      <BarcodeManagementDialog
        open={barcodeOpen}
        onOpenChange={setBarcodeOpen}
        products={products}
        onSaveBarcode={async (productId, barcode) => {
          await updateInventoryProduct(productId, { barcode });
          await refresh();
        }}
      />
    </div>
  );
}
