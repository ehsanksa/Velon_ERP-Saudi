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
  FileText,
  Loader2,
  Package,
  Search,
  Truck,
  UserCircle,
  Users,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useT } from '@/lib/i18n/locale-context';
import { cn } from '@/lib/utils';
import {
  flattenWorkspaceSearch,
  searchWorkspace,
  type WorkspaceSearchHit,
  type WorkspaceSearchKind,
  type WorkspaceSearchResult,
} from '@/lib/workspace/search';

const EMPTY_RESULT: WorkspaceSearchResult = {
  failed: false,
  products: [],
  customers: [],
  invoices: [],
  suppliers: [],
  employees: [],
};

const GROUP_LABEL: Record<WorkspaceSearchKind, string> = {
  product: 'Products',
  customer: 'Customers',
  invoice: 'Invoices',
  supplier: 'Suppliers',
  employee: 'Employees',
};

function GroupIcon({ kind }: { kind: WorkspaceSearchKind }) {
  const className = 'text-muted-foreground h-4 w-4 shrink-0';
  if (kind === 'product') return <Package className={className} />;
  if (kind === 'customer') return <Users className={className} />;
  if (kind === 'invoice') return <FileText className={className} />;
  if (kind === 'supplier') return <Truck className={className} />;
  return <UserCircle className={className} />;
}

export function WorkspaceSearch() {
  const t = useT();
  const navigate = useNavigate();
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WorkspaceSearchResult>(EMPTY_RESULT);
  const [activeIndex, setActiveIndex] = useState(0);
  const requestRef = useRef(0);

  const hits = useMemo(() => flattenWorkspaceSearch(result), [result]);
  const term = query.trim();

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

  function openHit(hit: WorkspaceSearchHit) {
    setOpen(false);
    setQuery('');
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
    if (hit.kind === 'supplier') {
      void navigate({ to: '/app/suppliers', search: { q: term } });
      return;
    }
    void navigate({ to: '/app/hr/employees', search: { q: term } });
  }

  function openProductList() {
    setOpen(false);
    setQuery('');
    void navigate({ to: '/app/inventory/products', search: { q: term } });
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
      else if (!loading) openProductList();
    }
  }

  const groups: Array<{ kind: WorkspaceSearchKind; items: WorkspaceSearchHit[] }> = [
    { kind: 'product', items: result.products },
    { kind: 'customer', items: result.customers },
    { kind: 'invoice', items: result.invoices },
    { kind: 'supplier', items: result.suppliers },
    { kind: 'employee', items: result.employees },
  ];

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
        aria-label={t('Search products, customers, invoices…')}
        placeholder={t('Search products, customers, invoices…')}
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
          className="border-border bg-popover text-popover-foreground absolute start-0 top-full z-50 mt-1.5 max-h-80 w-[min(92vw,420px)] overflow-y-auto rounded-xl border shadow-lg"
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
            if (group.items.length === 0) return null;
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
                  return (
                    <button
                      key={`${hit.kind}-${hit.id}-${hit.title}`}
                      type="button"
                      role="option"
                      aria-selected={active}
                      className={cn(
                        'flex w-full items-center gap-2.5 px-3 py-2 text-start text-sm',
                        active ? 'bg-accent text-accent-foreground' : 'hover:bg-muted/70',
                      )}
                      onMouseEnter={() => setActiveIndex(flatIndex)}
                      onClick={() => openHit(hit)}
                    >
                      <GroupIcon kind={hit.kind} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{hit.title}</span>
                        {hit.subtitle ? (
                          <span className="text-muted-foreground block truncate text-xs">
                            {hit.subtitle}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}

          {result.products.length > 0 ? (
            <button
              type="button"
              className="text-primary hover:bg-muted/70 w-full px-3 py-2 text-start text-xs font-medium"
              onClick={openProductList}
            >
              {t('See all product matches')}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
