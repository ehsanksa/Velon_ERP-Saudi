import { useState } from 'react';
import { createFileRoute, Link, useRouter } from '@tanstack/react-router';
import { Activity, FileKey2, Headphones, LockKeyhole, Server, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { VELON_CONTACT_EMAIL } from '@velon/shared';
import { AuthPortalShell } from '@/components/auth/auth-portal-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiLogin } from '@/lib/api/client';
import { isApiEnabled } from '@/lib/api/config';
import { formatApiError, loginSearch } from '@/lib/auth/login-utils';
import { redirectIfAdminAuthenticated } from '@/lib/auth/route-guard';
import { saveSession } from '@/lib/auth/session';
import { useT } from '@/lib/i18n/locale-context';

export const Route = createFileRoute('/platform/login')({
  beforeLoad: () => {
    redirectIfAdminAuthenticated();
  },
  head: () => ({
    meta: [
      { title: 'Platform Admin · Velon-ERP' },
      {
        name: 'description',
        content: 'Secure sign-in for Velon-ERP platform operators and super administrators.',
      },
    ],
  }),
  component: PlatformLoginPage,
});

const platformSignals = [
  {
    icon: ShieldAlert,
    title: 'Privileged access',
    desc: 'Super Admin, billing ops, and security roles only. All actions are audited.',
  },
  {
    icon: Server,
    title: 'Multi-tenant control',
    desc: 'Manage tenants, subscriptions, infrastructure, and platform-wide policies.',
  },
  {
    icon: FileKey2,
    title: 'MFA enforced',
    desc: 'Step-up authentication required for destructive or cross-tenant operations.',
  },
];

function PlatformLoginPage() {
  const router = useRouter();
  const useApi = isApiEnabled();
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  async function onSignIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (!useApi) {
        toast.error(t('Configure VITE_API_URL — demo platform auth was removed in Phase 2C.'));
        return;
      }
      const res = await apiLogin(email, password);
      if (res.route !== 'admin') {
        toast.error(t('This portal is for platform administrators only. Use workspace sign-in.'));
        return;
      }
      saveSession({
        accessToken: res.accessToken,
        refreshToken: res.refreshToken,
        route: 'admin',
        email,
        scope: res.scope ?? 'platform',
      });
      toast.success(t('Signed in to platform control plane'));
      // Full navigation avoids a loader race while pathname is still /platform/login.
      window.location.assign('/admin');
    } catch (err) {
      toast.error(formatApiError(err, t('Platform sign-in failed')));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthPortalShell
      variant="platform"
      badge="Platform control plane"
      portalLabel="Velon-ERP Platform"
      portalTitle="Super Admin gateway"
      headline="Operator access to the multi-tenant control plane."
      description="Sign in with your platform administrator credentials. Tenant users and dealers should use the workspace portal instead."
      signals={platformSignals}
      complianceIcon={LockKeyhole}
      complianceText={
        <>
          {t(
            'Restricted to authorized Velon platform staff. Impersonation, tenant freeze, and billing changes are logged with tamper-evident audit trails. See',
          )}{' '}
          <Link
            to="/privacy"
            className="text-[#b7f3df]"
          >
            {t('Privacy Policy')}
          </Link>{' '}
          {t('and')}{' '}
          <Link
            to="/terms"
            className="text-[#b7f3df]"
          >
            {t('Terms')}
          </Link>
          .
        </>
      }
      crossLink={{ label: 'Tenant workspace sign-in →', to: '/login', search: loginSearch() }}
    >
      <form
        className="space-y-4"
        onSubmit={onSignIn}
      >
        <div className="space-y-1">
          <p className="text-xs font-medium tracking-wider text-white/45 uppercase">
            {t('Platform administrator')}
          </p>
          <p className="text-sm text-white/70">
            {t(
              'Use the email provisioned for Super Admin access. MFA may be required after password verification.',
            )}
          </p>
        </div>
        <Input
          placeholder={VELON_CONTACT_EMAIL}
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="border-white/15 bg-white/5 text-white placeholder:text-white/35"
        />
        <Input
          placeholder={t('Password')}
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="border-white/15 bg-white/5 text-white placeholder:text-white/35"
        />
        <Button
          type="submit"
          disabled={busy}
          className="bg-gradient-primary shadow-glow w-full text-white hover:opacity-95"
        >
          {busy ? t('Verifying…') : t('Enter control plane')}
        </Button>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-4 text-xs text-white/45">
          <span className="flex items-center gap-1.5">
            <Headphones className="h-3.5 w-3.5" /> {VELON_CONTACT_EMAIL}
          </span>
          <span className="flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5" /> {t('SOC2 audit trail active')}
          </span>
        </div>
      </form>
    </AuthPortalShell>
  );
}
