import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
  Command,
  File,
  FileText,
  Loader2,
  Package,
  Search,
  Truck,
  UserRound,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { workspaceAdminSearch } from '@velon/shared';
import { Input } from '@/components/ui/input';
import { useWorkspaceCurrency } from '@/contexts/workspace-currency';
import { loadCompanyAssetBlob } from '@/lib/crm/company-assets-api';
import { downloadQuotationPdf } from '@/lib/crm/quotation-api';
import { useT } from '@/lib/i18n/locale-context';
import { downloadInvoicePdf } from '@/lib/sales/invoice-api';
import { cn } from '@/lib/utils';
import {
  orderWorkspaceSearch,
  searchWorkspace,
  type WorkspaceSearchHit,
  type WorkspaceSearchKind,
  type WorkspaceSearchResult,
} from '@/lib/workspace/search';
import { presentBlob } from '@/lib/workspace/search-actions';

const EMPTY_RESULT: WorkspaceSearchResult = {
  failed: false,
  products: [],
  invoices: [],
  documents: [],
  users: [],
  customers: [],
  suppliers: [],
  employees: [],
};

const GROUP_LABEL: Record<WorkspaceSearchKind, string> = {
  product: 'Products',
  invoice: 'Invoices',
  document: 'Documents',
  user: 'Users',
  customer: 'Customers',
  supplier: 'Suppliers',
  employee: 'Employees',
};

const INVOICE_STATUS: Record<string, string> = {
  DRAFT: 'Draft',
  UNPAID: 'Unpaid',
  PARTIALLY_PAID: 'Partially paid',
  PAID: 'Paid',
  OVERDUE: 'Overdue',
  CANCELLED: 'Cancelled',
  VOID: 'Void',
};

function GroupIcon({ kind }: { kind: WorkspaceSearchKind }) {
  const className = 'text-muted-foreground h-4 w-4 shrink-0';
  if (kind === 'product') return <Package className={className} />;
  if (kind === 'invoice') return <FileText className={className} />;
  if (kind === 'document') return <File className={className} />;
  if (kind === 'user') return <UserRound className={className} />;
  if (kind === 'customer') return <Users className={className} />;
  if (kind === 'supplier') return <Truck className={className} />;
  return <UserRound className={className} />;
}

function ActionButton({
  label,
  hint,
  disabled,
  onClick,
}: {
  label: string;
  hint: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={hint}
      disabled={disabled}
      className="text-primary hover:bg-primary/10 rounded px-1.5 py-0.5 text-[11px] font-medium disabled:opacity-50"
      onMouseDown={(event) => event.preventDefault()}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    >
      {label}
    </button>
  );
}

export function WorkspaceSearch() {
  const t = useT();
  const navigate = useNavigate();
  const { formatCurrency } = useWorkspaceCurrency();
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WorkspaceSearchResult>(EMPTY_RESULT);
  const [activeIndex, setActiveIndex] = useState(0);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const requestRef = useRef(0);

  const term = query.trim();
  const groups = useMemo(() => orderWorkspaceSearch(term, result), [term, result]);
  const hits = useMemo(() => groups.flatMap((group) => group.items), [groups]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!term) {
      setResult(EMPTY_RESULT);
      setLoading(false);
      return;
    }

    const requestId = ++requestRef.current;
    setLoading(true);
    const timer = window.setTimeout(() => {
      void searchWorkspace(term)
        .then((next) => {
          if (requestRef.current !== requestId) return;
          setResult(next);
          setActiveIndex(0);
        })
        .finally(() => {
          if (requestRef.current === requestId) setLoading(false);
        });
    }, 250);

    return () => window.clearTimeout(timer);
  }, [term]);

  function close() {
    setOpen(false);
    setQuery('');
  }

  function openHit(hit: WorkspaceSearchHit) {
    if (hit.kind === 'document') {
      void runAction(hit, 'view');
      return;
    }
    close();
    if (hit.kind === 'product') {
      void navigate({
        to: '/app/inventory/products',
        search: { q: hit.productQuery || term },
      });
      return;
    }
    if (hit.kind === 'customer') {
      void navigate({ to: '/app/customers', search: { section: 'customers', q: term } });
      return;
    }
    if (hit.kind === 'invoice') {
      void navigate({ to: '/app/invoices/$invoiceId', params: { invoiceId: hit.id } });
      return;
    }
    if (hit.kind === 'user') {
      void navigate({ to: '/app/settings/admin', search: workspaceAdminSearch('users') });
      return;
    }
    if (hit.kind === 'supplier') {
      void navigate({ to: '/app/suppliers', search: { q: term } });
      return;
    }
    void navigate({ to: '/app/hr/employees', search: { q: term } });
  }

  async function runAction(hit: WorkspaceSearchHit, action: 'view' | 'print' | 'download') {
    const key = `${hit.kind}:${hit.id}:${action}`;
    setBusyKey(key);
    try {
      if (hit.kind === 'invoice') {
        if (action === 'view') {
          openHit(hit);
          return;
        }
        const blob = await downloadInvoicePdf(hit.id);
        await presentBlob(blob, action, hit.fileName);
        return;
      }
      if (hit.kind === 'document' && hit.documentSource === 'quotation') {
        const blob = await downloadQuotationPdf(hit.id);
        await presentBlob(blob, action === 'print' ? 'view' : action, hit.fileName);
        if (action === 'view') close();
        return;
      }
      if (hit.kind === 'document') {
        const blob = await loadCompanyAssetBlob(hit.id);
        await presentBlob(blob, action === 'print' ? 'view' : action, hit.fileName);
        if (action === 'view') close();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      toast.error(
        message && message !== 'Could not open this file.'
          ? message
          : t('Could not open this file.'),
      );
    } finally {
      setBusyKey(null);
    }
  }

  function onInputKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (!open || !term) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => (hits.length === 0 ? 0 : (index + 1) % hits.length));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => (hits.length === 0 ? 0 : (index - 1 + hits.length) % hits.length));
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const hit = hits[activeIndex];
      if (hit) openHit(hit);
      else if (!loading) {
        close();
        void navigate({ to: '/app/inventory/products', search: { q: term } });
      }
    }
  }

  let cursor = 0;

  return (
    <div
      ref={rootRef}
      className="relative w-full"
    >
      <Search className="text-muted-foreground pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2" />
      <Input
        ref={inputRef}
        value={query}
        autoComplete="off"
        role="combobox"
        aria-expanded={open && Boolean(term)}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label={t('Search products, invoices, documents, people…')}
        placeholder={t('Search products, invoices, documents, people…')}
        className="border-border bg-muted/50 focus-visible:ring-primary/30 h-9 rounded-lg ps-9 pe-14"
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onInputKeyDown}
      />
      <kbd className="border-border bg-background text-muted-foreground pointer-events-none absolute end-2.5 top-1/2 flex -translate-y-1/2 items-center gap-0.5 rounded border px-1.5 py-0.5 text-[10px]">
        <Command className="h-2.5 w-2.5" />K
      </kbd>

      {open && term ? (
        <div
          id={listId}
          role="listbox"
          className="border-border bg-popover text-popover-foreground absolute start-0 top-full z-50 mt-1.5 max-h-[28rem] w-[min(94vw,560px)] overflow-y-auto rounded-xl border shadow-lg"
        >
          {loading && hits.length === 0 ? (
            <div className="text-muted-foreground flex items-center gap-2 px-3 py-3 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('Searching…')}
            </div>
          ) : null}

          {!loading && result.failed ? (
            <p className="text-muted-foreground px-3 py-3 text-sm">
              {t('Could not search right now.')}
            </p>
          ) : null}

          {!loading && !result.failed && hits.length === 0 ? (
            <p className="text-muted-foreground px-3 py-3 text-sm">
              {t('No matches for “{query}”', { query: term })}
            </p>
          ) : null}

          {groups.map((group) => {
            const start = cursor;
            cursor += group.items.length;
            return (
              <div
                key={group.kind}
                className="border-border border-b last:border-b-0"
              >
                <div className="text-muted-foreground px-3 pt-2 pb-1 text-[10px] font-medium tracking-[0.14em] uppercase">
                  {t(GROUP_LABEL[group.kind])}
                </div>
                {group.items.map((hit, index) => {
                  const flatIndex = start + index;
                  const active = flatIndex === activeIndex;
                  const busy = busyKey?.startsWith(`${hit.kind}:${hit.id}:`) ?? false;
                  const invoiceHint =
                    hit.kind === 'invoice'
                      ? [
                          t(INVOICE_STATUS[hit.status ?? ''] ?? hit.status ?? 'Invoice'),
                          Number.isFinite(hit.amount) ? formatCurrency(hit.amount ?? 0) : '',
                        ]
                          .filter(Boolean)
                          .join(' · ')
                      : '';
                  return (
                    <div
                      key={`${hit.kind}-${hit.id}-${hit.title}`}
                      role="option"
                      aria-selected={active}
                      className={cn(
                        'flex w-full items-center gap-2 px-3 py-2 text-start text-sm',
                        active ? 'bg-accent text-accent-foreground' : 'hover:bg-muted/70',
                      )}
                      onMouseEnter={() => setActiveIndex(flatIndex)}
                    >
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-center gap-2.5 text-start"
                        onClick={() => openHit(hit)}
                      >
                        <GroupIcon kind={hit.kind} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{hit.title}</span>
                          {hit.kind === 'user' && hit.role ? (
                            <span className="text-muted-foreground block truncate text-xs">
                              {[t(hit.role), hit.subtitle, hit.inactive ? t('Inactive') : '']
                                .filter(Boolean)
                                .join(' · ')}
                            </span>
                          ) : hit.subtitle ? (
                            <span className="text-muted-foreground block truncate text-xs">
                              {hit.subtitle}
                            </span>
                          ) : null}
                        </span>
                      </button>
                      {hit.kind === 'product' && hit.stockLeft != null ? (
                        <span className="text-muted-foreground shrink-0 text-xs">
                          {hit.stockLeft <= 0
                            ? t('None left')
                            : t('{count} left', { count: hit.stockLeft })}
                        </span>
                      ) : null}
                      {hit.kind === 'invoice' ? (
                        <div className="flex shrink-0 flex-wrap items-center justify-end gap-0.5">
                          <span className="text-muted-foreground me-1 max-w-[9rem] truncate text-[11px]">
                            {invoiceHint}
                          </span>
                          <ActionButton
                            label={t('View')}
                            hint={t('Open this invoice')}
                            disabled={busy}
                            onClick={() => openHit(hit)}
                          />
                          <ActionButton
                            label={t('Print')}
                            hint={t('Print this invoice')}
                            disabled={busy}
                            onClick={() => void runAction(hit, 'print')}
                          />
                          <ActionButton
                            label={t('Download')}
                            hint={t('Save the PDF')}
                            disabled={busy}
                            onClick={() => void runAction(hit, 'download')}
                          />
                        </div>
                      ) : null}
                      {hit.kind === 'document' ? (
                        <div className="flex shrink-0 items-center gap-0.5">
                          <span className="text-muted-foreground me-1 text-[11px]">
                            {hit.mimeType?.includes('pdf') ? t('PDF') : t('File')}
                          </span>
                          <ActionButton
                            label={t('View')}
                            hint={t('Open this file')}
                            disabled={busy}
                            onClick={() => void runAction(hit, 'view')}
                          />
                          <ActionButton
                            label={t('Download')}
                            hint={t('Download this file')}
                            disabled={busy}
                            onClick={() => void runAction(hit, 'download')}
                          />
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
