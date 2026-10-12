import { createRootRoute, HeadContent, Link, Outlet, Scripts } from '@tanstack/react-router';
import { SiteFooter } from '@/components/marketing/site-footer';
import { LanguageSwitch } from '@/components/shared/language-switch';
import { Toaster } from '@/components/ui/sonner';
import { localeBootScript, LocaleProvider, useT } from '@/lib/i18n/locale-context';
import favicon from '@/Logo assets/07 VelonERP logo - favicon - Primary.svg';
import appCss from '../styles.css?url';

function NotFoundComponent() {
  const t = useT();

  return (
    <div className="bg-background flex min-h-screen flex-col">
      <div className="flex justify-end px-4 pt-4">
        <LanguageSwitch />
      </div>
      <div className="flex flex-1 items-center justify-center px-4">
        <div className="max-w-md text-center">
          <h1 className="text-foreground text-7xl font-bold">404</h1>
          <h2 className="text-foreground mt-4 text-xl font-semibold">{t('Page not found')}</h2>
          <p className="text-muted-foreground mt-2 text-sm">
            {t("The page you're looking for doesn't exist or has been moved.")}
          </p>
          <div className="mt-6">
            <Link
              to="/"
              className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors"
            >
              {t('Go home')}
            </Link>
          </div>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'VelonERP Saudi Arabia' },
      {
        name: 'description',
        content: 'Saudi Arabia ERP for VAT invoicing, inventory, CRM, and operations.',
      },
      { name: 'author', content: 'VelonERP' },
      { property: 'og:title', content: 'VelonERP Saudi Arabia' },
      {
        property: 'og:description',
        content: 'ERP for Saudi businesses, with Arabic and English and SAR accounting.',
      },
      { property: 'og:type', content: 'website' },
      { property: 'og:url', content: 'https://velonerp.sa' },
      { name: 'twitter:card', content: 'summary' },
      { name: 'twitter:site', content: '@velonerp' },
    ],
    links: [
      { rel: 'canonical', href: 'https://velonerp.sa' },
      {
        rel: 'stylesheet',
        href: appCss,
      },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap',
      },
      { rel: 'icon', type: 'image/svg+xml', href: favicon },
      { rel: 'apple-touch-icon', href: favicon },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="ar"
      dir="rtl"
    >
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: localeBootScript() }} />
      </head>
      <body>
        <LocaleProvider>{children}</LocaleProvider>
        <Toaster
          richColors
          closeButton
        />
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return <Outlet />;
}
