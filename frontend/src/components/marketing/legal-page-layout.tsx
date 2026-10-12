import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { SiteFooter } from '@/components/marketing/site-footer';
import { SiteHeader } from '@/components/marketing/site-header';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { useT } from '@/lib/i18n/locale-context';
import { cn } from '@/lib/utils';

export type LegalSection = {
  id: string;
  title: string;
  content: ReactNode;
};

export function LegalPageLayout({
  label,
  title,
  description,
  effectiveDate,
  lastUpdated,
  sections,
  relatedLinks,
}: {
  label: string;
  title: string;
  description: string;
  effectiveDate: string;
  lastUpdated: string;
  sections: LegalSection[];
  relatedLinks: { label: string; to: string }[];
}) {
  const t = useT();

  return (
    <div className="bg-background min-h-screen">
      <SiteHeader />
      <section className="border-border bg-gradient-hero border-b">
        <div className="mx-auto max-w-4xl px-6 py-14">
          <Badge
            variant="outline"
            className="border-border bg-background/80 rounded-full"
          >
            {t(label)}
          </Badge>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">{t(title)}</h1>
          <p className="text-muted-foreground mt-4">{t(description)}</p>
          <p className="text-muted-foreground mt-3 text-xs">
            {t('Effective')}: {t(effectiveDate)} · {t('Last updated')}: {t(lastUpdated)}
          </p>
        </div>
      </section>

      <main className="mx-auto grid max-w-7xl gap-10 px-6 py-12 lg:grid-cols-[240px_1fr]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Card className="border-border bg-card p-4">
            <p className="text-muted-foreground mb-3 text-xs font-semibold tracking-wider uppercase">
              {t('On this page')}
            </p>
            <nav className="flex flex-col gap-1 text-sm">
              {sections.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-md px-2 py-1.5 transition"
                >
                  {t(s.title)}
                </a>
              ))}
            </nav>
            <div className="border-border text-muted-foreground mt-4 border-t pt-4 text-xs">
              {t('Related')}:
              <ul className="mt-2 space-y-1">
                {relatedLinks.map((l) => (
                  <li key={l.to}>
                    <Link
                      to={l.to}
                      className="text-foreground font-medium hover:underline"
                    >
                      {t(l.label)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        </aside>

        <article className="min-w-0 space-y-10">
          {sections.map((section) => (
            <section
              key={section.id}
              id={section.id}
              className="scroll-mt-24"
            >
              <h2 className="text-xl font-semibold tracking-tight">{t(section.title)}</h2>
              <div
                className={cn(
                  'prose prose-sm text-muted-foreground mt-4 max-w-none',
                  'prose-headings:text-foreground prose-strong:text-foreground',
                  'prose-a:text-foreground prose-a:underline prose-a:underline-offset-4',
                  'prose-li:marker:text-muted-foreground',
                )}
              >
                {section.content}
              </div>
            </section>
          ))}
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}
