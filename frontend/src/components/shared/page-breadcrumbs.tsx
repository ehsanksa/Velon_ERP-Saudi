import { Link } from '@tanstack/react-router';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { useT } from '@/lib/i18n/locale-context';

export type BreadcrumbSegment = {
  label: string;
  to?: string;
  search?: Record<string, string>;
};

export function PageBreadcrumbs({ segments }: { segments: BreadcrumbSegment[] }) {
  const t = useT();
  if (segments.length === 0) return null;

  return (
    <Breadcrumb className="mb-4 hidden sm:block">
      <BreadcrumbList>
        {segments.map((segment, index) => {
          const isLast = index === segments.length - 1;
          return (
            <span
              key={`${segment.label}-${index}`}
              className="contents"
            >
              <BreadcrumbItem>
                {isLast || !segment.to ? (
                  <BreadcrumbPage>{t(segment.label)}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link
                      to={segment.to}
                      search={segment.search}
                    >
                      {t(segment.label)}
                    </Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!isLast ? <BreadcrumbSeparator /> : null}
            </span>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

/** Derive breadcrumb segments from a workspace pathname. */
export function breadcrumbsFromPath(pathname: string, pageTitle: string): BreadcrumbSegment[] {
  const normalized = pathname !== '/' && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  const segments: BreadcrumbSegment[] = [{ label: 'Dashboard', to: '/app' }];

  if (normalized === '/app' || normalized === '/app/') {
    return [{ label: 'Dashboard' }];
  }

  const parts = normalized
    .replace(/^\/app\/?/, '')
    .split('/')
    .filter(Boolean);
  let acc = '/app';

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    acc += `/${part}`;
    const isLast = i === parts.length - 1;
    const label = isLast
      ? pageTitle
      : part
          .split('-')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ');
    segments.push(isLast ? { label } : { label, to: acc });
  }

  return segments;
}
