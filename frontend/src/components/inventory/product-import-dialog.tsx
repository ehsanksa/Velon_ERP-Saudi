import { useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { BookOpen, Download, FileUp, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useT } from '@/lib/i18n/locale-context';
import {
  executeInventoryImport,
  getInventoryImportTemplate,
  validateInventoryImport,
  type InventoryImportOptions,
  type InventoryImportPreview,
  type InventoryImportResult,
} from '@/lib/inventory/api';
import {
  downloadTextFile,
  mapCsvToImportRows,
  type InventoryImportRow,
} from '@/lib/inventory/import-csv';

type Step = 'upload' | 'preview' | 'done';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
};

export function ProductImportDialog({ open, onOpenChange, onImported }: Props) {
  const t = useT();
  const [step, setStep] = useState<Step>('upload');
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<InventoryImportRow[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [preview, setPreview] = useState<InventoryImportPreview | null>(null);
  const [result, setResult] = useState<InventoryImportResult | null>(null);
  const [options, setOptions] = useState<InventoryImportOptions>({
    createMissingCategories: true,
    createMissingWarehouses: false,
    updateExisting: false,
    stageForApproval: true,
  });

  const canImport = Boolean(preview && preview.errorCount === 0 && preview.valid > 0);

  const issueSummary = useMemo(() => {
    if (!preview) return [];
    return preview.issues.slice(0, 40);
  }, [preview]);

  function reset() {
    setStep('upload');
    setBusy(false);
    setFileName(null);
    setRows([]);
    setParseErrors([]);
    setPreview(null);
    setResult(null);
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  async function handleDownloadTemplate() {
    setBusy(true);
    try {
      const tpl = await getInventoryImportTemplate();
      downloadTextFile(tpl.filename, tpl.csv);
      toast.success(t('Template downloaded'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('Could not download template'));
    } finally {
      setBusy(false);
    }
  }

  async function handleFile(file: File | null) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast.error(t('Please upload a CSV file'));
      return;
    }
    setBusy(true);
    try {
      const text = await file.text();
      const mapped = mapCsvToImportRows(text);
      setFileName(file.name);
      setParseErrors(mapped.errors);
      setRows(mapped.rows);
      setPreview(null);
      setResult(null);
      if (mapped.rows.length === 0) {
        toast.error(t('No valid rows found in the file'));
        setStep('upload');
        return;
      }
      const validated = await validateInventoryImport(mapped.rows, options);
      setPreview(validated);
      setStep('preview');
      if (validated.errorCount > 0) {
        toast.message(t('Validation found issues'), {
          description: t('{errors} errors, {warnings} warnings', {
            errors: String(validated.errorCount),
            warnings: String(validated.warningCount),
          }),
        });
      } else {
        toast.success(t('Ready to import {count} rows', { count: String(validated.valid) }));
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('Could not validate import'));
    } finally {
      setBusy(false);
    }
  }

  async function revalidate() {
    if (rows.length === 0) return;
    setBusy(true);
    try {
      const validated = await validateInventoryImport(rows, options);
      setPreview(validated);
      setStep('preview');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('Could not validate import'));
    } finally {
      setBusy(false);
    }
  }

  async function handleExecute() {
    if (!canImport) return;
    setBusy(true);
    try {
      const executed = await executeInventoryImport(rows, options);
      setResult(executed);
      if (executed.errorCount > 0) {
        setPreview(executed);
        toast.error(t('Import blocked by validation errors'));
        return;
      }
      setStep('done');
      toast.success(
        t('Imported {created} created, {updated} updated', {
          created: String(executed.created),
          updated: String(executed.updated),
        }),
      );
      onImported();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('Import failed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
    >
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            {t('Import products & services')}
          </DialogTitle>
          <DialogDescription>
            {t(
              'Download the template, fill a few test rows, validate, then import the full catalog.',
            )}
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4">
            <div className="border-border bg-muted/40 space-y-3 rounded-md border p-4">
              <p className="text-sm font-medium">
                {t('You are not wrong — CSV is not a screenshot of Products or Stock')}
              </p>
              <p className="text-muted-foreground text-sm">
                {t(
                  'One CSV row creates/updates a catalog item and can also set opening stock. Products tab shows master fields; Stock tab shows warehouse quantities.',
                )}
              </p>
              <ul className="text-muted-foreground list-disc space-y-1 pl-4 text-sm">
                <li>
                  {t('Products columns: sku, name, itemType, category, barcode, status, unitPrice')}
                </li>
                <li>
                  {t(
                    'Stock columns (PRODUCT only): warehouse, quantity, reorderPoint, safetyStock',
                  )}
                </li>
                <li>
                  {t(
                    'Not in CSV (use Stock UI later): Ext. value, Mfg/Exp dates, ABC, Scan actions',
                  )}
                </li>
              </ul>
              <ol className="text-muted-foreground list-decimal space-y-1 pl-4 text-sm">
                <li>{t('Download the standard CSV template')}</li>
                <li>{t('Separate PRODUCT (stock) and SERVICE (no stock) rows')}</li>
                <li>{t('Validate 3–5 rows first, then import the full file')}</li>
              </ol>
              <Button
                asChild
                type="button"
                size="sm"
                variant="link"
                className="h-auto px-0"
              >
                <Link
                  to="/app/help"
                  onClick={() => onOpenChange(false)}
                >
                  <BookOpen className="mr-2 h-3.5 w-3.5" />
                  {t('Open full user guide')}
                </Link>
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => void handleDownloadTemplate()}
              >
                <Download className="mr-2 h-4 w-4" />
                {t('Download template')}
              </Button>
              <Label className="inline-flex cursor-pointer items-center gap-2">
                <span className="bg-primary text-primary-foreground inline-flex h-9 items-center rounded-md px-3 text-sm font-medium">
                  <FileUp className="mr-2 h-4 w-4" />
                  {t('Upload CSV')}
                </span>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="sr-only"
                  disabled={busy}
                  onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
                />
              </Label>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">{t('Smart import options')}</p>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={Boolean(options.stageForApproval)}
                  onCheckedChange={(c) =>
                    setOptions((o) => ({ ...o, stageForApproval: c === true }))
                  }
                />
                {t('Stage as Inactive until approved')}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={Boolean(options.createMissingCategories)}
                  onCheckedChange={(c) =>
                    setOptions((o) => ({ ...o, createMissingCategories: c === true }))
                  }
                />
                {t('Create missing categories')}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={Boolean(options.createMissingWarehouses)}
                  onCheckedChange={(c) =>
                    setOptions((o) => ({ ...o, createMissingWarehouses: c === true }))
                  }
                />
                {t('Create missing warehouses')}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={Boolean(options.updateExisting)}
                  onCheckedChange={(c) => setOptions((o) => ({ ...o, updateExisting: c === true }))}
                />
                {t('Update existing SKUs')}
              </label>
            </div>

            {parseErrors.length > 0 && (
              <div className="text-destructive space-y-1 text-sm">
                {parseErrors.map((err) => (
                  <p key={err}>{err}</p>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 'preview' && preview && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="secondary">{fileName ?? t('CSV file')}</Badge>
              <Badge variant="outline">{t('{count} rows', { count: String(preview.total) })}</Badge>
              <Badge variant="outline">
                {t('{count} to create', { count: String(preview.createCount) })}
              </Badge>
              {preview.updateCount > 0 && (
                <Badge variant="outline">
                  {t('{count} to update', { count: String(preview.updateCount) })}
                </Badge>
              )}
              {preview.errorCount > 0 && (
                <Badge variant="destructive">
                  {t('{count} errors', { count: String(preview.errorCount) })}
                </Badge>
              )}
              {preview.warningCount > 0 && (
                <Badge variant="secondary">
                  {t('{count} warnings', { count: String(preview.warningCount) })}
                </Badge>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">{t('Smart import options')}</p>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={Boolean(options.stageForApproval)}
                    onCheckedChange={(c) =>
                      setOptions((o) => ({ ...o, stageForApproval: c === true }))
                    }
                  />
                  {t('Stage as Inactive until approved')}
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={Boolean(options.createMissingCategories)}
                    onCheckedChange={(c) =>
                      setOptions((o) => ({ ...o, createMissingCategories: c === true }))
                    }
                  />
                  {t('Create missing categories')}
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={Boolean(options.updateExisting)}
                    onCheckedChange={(c) =>
                      setOptions((o) => ({ ...o, updateExisting: c === true }))
                    }
                  />
                  {t('Update existing SKUs')}
                </label>
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => void revalidate()}
              >
                {t('Re-validate with options')}
              </Button>
            </div>

            {issueSummary.length > 0 && (
              <div className="border-border max-h-48 overflow-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('Row')}</TableHead>
                      <TableHead>{t('Field')}</TableHead>
                      <TableHead>{t('Issue')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {issueSummary.map((issue, idx) => (
                      <TableRow key={`${issue.row}-${issue.field}-${idx}`}>
                        <TableCell className="font-mono text-xs">{issue.row}</TableCell>
                        <TableCell className="text-xs">{issue.field ?? '—'}</TableCell>
                        <TableCell className="text-sm">
                          <span
                            className={
                              issue.severity === 'error'
                                ? 'text-destructive'
                                : 'text-muted-foreground'
                            }
                          >
                            {issue.message}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setStep('upload');
                  setPreview(null);
                }}
              >
                {t('Back')}
              </Button>
              <Button
                type="button"
                disabled={busy || !canImport}
                onClick={() => void handleExecute()}
              >
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {t('Import {count} items', { count: String(preview.valid) })}
              </Button>
            </div>
          </div>
        )}

        {step === 'done' && result && (
          <div className="space-y-4">
            <p className="text-sm">
              {t(
                'Import finished. Spot-check a few items in the catalog for prices, type, and status.',
              )}
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">
                {t('{count} created', { count: String(result.created) })}
              </Badge>
              <Badge variant="secondary">
                {t('{count} updated', { count: String(result.updated) })}
              </Badge>
              {result.categoriesCreated > 0 && (
                <Badge variant="outline">
                  {t('{count} categories added', { count: String(result.categoriesCreated) })}
                </Badge>
              )}
              {options.stageForApproval && (
                <Badge variant="outline">{t('Staged as Inactive')}</Badge>
              )}
            </div>
            <Button
              type="button"
              onClick={() => handleOpenChange(false)}
            >
              {t('Done')}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
