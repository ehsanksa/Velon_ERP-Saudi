import { createFileRoute, Link } from '@tanstack/react-router';
import { BookOpen, Package, Upload } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useT } from '@/lib/i18n/locale-context';
import { CSV_TO_UI_MAP, USER_GUIDE_SECTIONS } from '@/lib/workspace/user-guide';

export const Route = createFileRoute('/app/help')({
  component: WorkspaceHelpPage,
});

function WorkspaceHelpPage() {
  const t = useT();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Card className="border-border bg-card p-5">
        <div className="flex flex-wrap items-start gap-3">
          <div className="bg-primary/10 text-primary rounded-md p-2">
            <BookOpen className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold">{t('User guide')}</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              {t(
                'Short how-to for daily work in Velon. Start with Inventory if you are importing a catalog.',
              )}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                asChild
                size="sm"
                variant="outline"
              >
                <Link to="/app/inventory/products">
                  <Package className="mr-2 h-4 w-4" />
                  {t('Open Products')}
                </Link>
              </Button>
              <Button
                asChild
                size="sm"
                variant="outline"
              >
                <Link to="/app/inventory">
                  <Upload className="mr-2 h-4 w-4" />
                  {t('Open Stock')}
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </Card>

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
                  <TableCell className="text-sm">{t(row.products)}</TableCell>
                  <TableCell className="text-sm">{t(row.stock)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="text-muted-foreground mt-3 text-xs">
          {t(
            'Stock-only UI fields such as Ext. value, Mfg date, Exp date, and ABC are managed on the Stock screen (or calculated), not in the import template.',
          )}
        </p>
      </Card>

      <Card className="border-border bg-card p-2 sm:p-4">
        <Accordion
          type="multiple"
          defaultValue={['inventory-tabs', 'csv-import']}
          className="w-full"
        >
          {USER_GUIDE_SECTIONS.map((section) => (
            <AccordionItem
              key={section.id}
              value={section.id}
            >
              <AccordionTrigger className="px-2 text-left sm:px-3">
                <span className="flex flex-wrap items-center gap-2">
                  {t(section.title)}
                  {section.id === 'csv-import' ? (
                    <Badge variant="secondary">{t('Import')}</Badge>
                  ) : null}
                </span>
              </AccordionTrigger>
              <AccordionContent className="space-y-3 px-2 sm:px-3">
                <p className="text-muted-foreground text-sm">{t(section.summary)}</p>
                {section.steps && section.steps.length > 0 ? (
                  <ol className="list-decimal space-y-1.5 pl-5 text-sm">
                    {section.steps.map((step) => (
                      <li key={step}>{t(step)}</li>
                    ))}
                  </ol>
                ) : null}
                {section.tips && section.tips.length > 0 ? (
                  <div className="bg-muted/40 rounded-md border p-3">
                    <p className="mb-2 text-xs font-medium tracking-wide uppercase">
                      {t('Quick map')}
                    </p>
                    <ul className="space-y-1 text-sm">
                      {section.tips.map((tip) => (
                        <li key={tip}>{t(tip)}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Card>
    </div>
  );
}
