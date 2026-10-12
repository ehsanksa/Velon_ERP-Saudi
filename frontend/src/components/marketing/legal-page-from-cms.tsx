import { LegalPageLayout } from '@/components/marketing/legal-page-layout';
import type { CmsLegalPage } from '@/lib/cms/defaults';
import { useT } from '@/lib/i18n/locale-context';

export function LegalPageFromCms({
  page,
  relatedLinks,
}: {
  page: CmsLegalPage;
  relatedLinks: { label: string; to: string }[];
}) {
  const t = useT();

  return (
    <LegalPageLayout
      label="Legal"
      title={page.title}
      description={page.description}
      effectiveDate={page.effectiveDate}
      lastUpdated={page.lastUpdated}
      sections={page.sections.map((section) => ({
        id: section.id,
        title: section.title,
        content: section.body
          .split('\n\n')
          .map((paragraph, index) => <p key={index}>{t(paragraph)}</p>),
      }))}
      relatedLinks={relatedLinks}
    />
  );
}
