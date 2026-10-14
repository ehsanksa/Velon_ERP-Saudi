import { useMemo, useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { AlertTriangle, BookOpen, ExternalLink, Lightbulb, Search } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useLocale, useT } from '@/lib/i18n/locale-context';
import { cn } from '@/lib/utils';
import {
  CSV_TO_UI_MAP,
  guideText,
  USER_GUIDE_MODULES,
  USER_GUIDE_TOPICS,
  type UserGuideTopic,
} from '@/lib/workspace/user-guide';

export const Route = createFileRoute('/app/help')({
  validateSearch: (search: Record<string, unknown>): { topic?: string; module?: string } => {
    const topic = typeof search.topic === 'string' ? search.topic.trim() : '';
    const module = typeof search.module === 'string' ? search.module.trim() : '';
    return {
      ...(topic ? { topic } : {}),
      ...(module ? { module } : {}),
    };
  },
  component: WorkspaceHelpPage,
});

function topicMatches(topic: UserGuideTopic, query: string, locale: 'en' | 'ar'): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  const bag = [
    guideText(topic.title, locale),
    guideText(topic.summary, locale),
    ...(topic.steps ?? []).map((s) => guideText(s, locale)),
    ...(topic.tips ?? []).map((s) => guideText(s, locale)),
    ...(topic.warnings ?? []).map((s) => guideText(s, locale)),
    topic.id,
    topic.moduleId,
  ]
    .join(' ')
    .toLowerCase();
  return bag.includes(q);
}

function WorkspaceHelpPage() {
  const t = useT();
  const { locale } = useLocale();
  const { topic: topicFromUrl, module: moduleFromUrl } = Route.useSearch();
  const navigate = Route.useNavigate();

  const [query, setQuery] = useState('');
  const activeModule = moduleFromUrl || USER_GUIDE_MODULES[0]?.id || 'basics';

  const filteredTopics = useMemo(() => {
    return USER_GUIDE_TOPICS.filter(
      (topic) => topic.moduleId === activeModule && topicMatches(topic, query.trim(), locale),
    );
  }, [activeModule, query, locale]);

  const moduleCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const mod of USER_GUIDE_MODULES) {
      map.set(
        mod.id,
        USER_GUIDE_TOPICS.filter(
          (topic) => topic.moduleId === mod.id && topicMatches(topic, query.trim(), locale),
        ).length,
      );
    }
    return map;
  }, [query, locale]);

  const openAccordion = useMemo(() => {
    if (topicFromUrl && filteredTopics.some((topic) => topic.id === topicFromUrl)) {
      return [topicFromUrl];
    }
    return filteredTopics.slice(0, 2).map((topic) => topic.id);
  }, [topicFromUrl, filteredTopics]);

  function selectModule(moduleId: string) {
    void navigate({
      to: '/app/help',
      search: { module: moduleId },
    });
  }

  return (
    <div className="space-y-6">
      <Card className="border-border bg-card p-5">
        <div className="flex flex-wrap items-start gap-3">
          <div className="bg-primary/10 text-primary rounded-md p-2">
            <BookOpen className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <h2 className="text-lg font-semibold">{t('User guide')}</h2>
            <p className="text-muted-foreground text-sm">
              {t(
                'Complete how-to for every workspace module — Dashboard, Sales, Invoices, Purchases, Inventory, Customers, Accounting, HR, Reports, and Settings.',
              )}
            </p>
            <div className="relative max-w-md">
              <Search className="text-muted-foreground absolute start-3 top-2.5 h-4 w-4" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('Search the user guide…')}
                className="ps-9"
              />
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <Card className="border-border bg-card h-fit p-3 lg:sticky lg:top-4">
          <p className="text-muted-foreground mb-2 px-2 text-[11px] font-medium tracking-wider uppercase">
            {t('Modules')}
          </p>
          <nav className="flex flex-col gap-1">
            {USER_GUIDE_MODULES.map((mod) => {
              const count = moduleCounts.get(mod.id) ?? 0;
              const active = activeModule === mod.id;
              return (
                <button
                  key={mod.id}
                  type="button"
                  onClick={() => selectModule(mod.id)}
                  className={cn(
                    'flex items-start justify-between gap-2 rounded-md px-2 py-2 text-start text-sm transition-colors',
                    active
                      ? 'bg-primary text-primary-foreground'
                      : 'text-foreground hover:bg-muted',
                  )}
                >
                  <span>
                    <span className="block font-medium">{guideText(mod.title, locale)}</span>
                    <span
                      className={cn(
                        'mt-0.5 block text-xs',
                        active ? 'text-primary-foreground/80' : 'text-muted-foreground',
                      )}
                    >
                      {guideText(mod.blurb, locale)}
                    </span>
                  </span>
                  <Badge
                    variant={active ? 'secondary' : 'outline'}
                    className="shrink-0"
                  >
                    {count}
                  </Badge>
                </button>
              );
            })}
          </nav>
        </Card>

        <div className="space-y-4">
          {activeModule === 'inventory' ? (
            <Card className="border-border bg-card p-5">
              <h3 className="font-medium">{t('Why CSV looks different from Inventory screens')}</h3>
              <p className="text-muted-foreground mt-2 text-sm">
                {t(
                  'The CSV is a create/update worksheet — one flat row per item. Products and Stock are two screens that show different slices of that same item after import.',
                )}
              </p>
              <div className="mt-4 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('CSV column')}</TableHead>
                      <TableHead>{t('Products tab')}</TableHead>
                      <TableHead>{t('Stock tab')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {CSV_TO_UI_MAP.map((row) => (
                      <TableRow key={row.csv}>
                        <TableCell className="font-mono text-xs">{row.csv}</TableCell>
                        <TableCell className="text-sm">{guideText(row.products, locale)}</TableCell>
                        <TableCell className="text-sm">{guideText(row.stock, locale)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          ) : null}

          {filteredTopics.length === 0 ? (
            <Card className="border-border bg-card p-8 text-center">
              <p className="text-muted-foreground text-sm">
                {t('No guide topics match your search in this module.')}
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-3"
                onClick={() => setQuery('')}
              >
                {t('Clear search')}
              </Button>
            </Card>
          ) : (
            <Card className="border-border bg-card p-2 sm:p-4">
              <Accordion
                type="multiple"
                defaultValue={openAccordion}
                key={`${activeModule}-${openAccordion.join(',')}`}
                className="w-full"
              >
                {filteredTopics.map((topic) => (
                  <AccordionItem
                    key={topic.id}
                    value={topic.id}
                  >
                    <AccordionTrigger className="px-2 text-left sm:px-3">
                      <span className="font-medium">{guideText(topic.title, locale)}</span>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-3 px-2 sm:px-3">
                      <p className="text-muted-foreground text-sm">
                        {guideText(topic.summary, locale)}
                      </p>

                      {topic.href ? (
                        <Button
                          asChild
                          size="sm"
                          variant="outline"
                        >
                          <Link to={topic.href as '/app'}>
                            <ExternalLink className="me-2 h-3.5 w-3.5" />
                            {t('Open this feature')}
                          </Link>
                        </Button>
                      ) : null}

                      {topic.steps && topic.steps.length > 0 ? (
                        <div>
                          <p className="mb-2 text-xs font-medium tracking-wide uppercase">
                            {t('How to use')}
                          </p>
                          <ol className="list-decimal space-y-1.5 ps-5 text-sm">
                            {topic.steps.map((step) => (
                              <li key={step.en}>{guideText(step, locale)}</li>
                            ))}
                          </ol>
                        </div>
                      ) : null}

                      {topic.tips && topic.tips.length > 0 ? (
                        <div className="bg-muted/40 rounded-md border p-3">
                          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase">
                            <Lightbulb className="h-3.5 w-3.5" />
                            {t('Tips')}
                          </p>
                          <ul className="space-y-1 text-sm">
                            {topic.tips.map((tip) => (
                              <li key={tip.en}>{guideText(tip, locale)}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}

                      {topic.warnings && topic.warnings.length > 0 ? (
                        <div className="border-destructive/30 bg-destructive/5 rounded-md border p-3">
                          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            {t('Watch out')}
                          </p>
                          <ul className="space-y-1 text-sm">
                            {topic.warnings.map((warning) => (
                              <li key={warning.en}>{guideText(warning, locale)}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
