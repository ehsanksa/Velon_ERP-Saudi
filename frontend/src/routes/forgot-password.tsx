import { useState } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { KeyRound, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { AuthPortalShell } from '@/components/auth/auth-portal-shell';
import { PasswordRequirementsChecklist } from '@/components/auth/password-requirements-checklist';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { isApiEnabled } from '@/lib/api/config';
import { formatApiError, loginSearch } from '@/lib/auth/login-utils';
import { isPasswordStrong } from '@/lib/auth/password-policy';
import {
  apiCompletePasswordReset,
  apiRequestPasswordReset,
  apiVerifyPasswordResetOtp,
  PASSWORD_RESET_GENERIC_MESSAGE,
} from '@/lib/auth/password-reset-api';
import { redirectIfWorkspaceAuthenticated } from '@/lib/auth/route-guard';
import { useT } from '@/lib/i18n/locale-context';

export const Route = createFileRoute('/forgot-password')({
  beforeLoad: () => {
    redirectIfWorkspaceAuthenticated();
  },
  head: () => ({
    meta: [
      { title: 'Forgot Password · Velon-ERP' },
      {
        name: 'description',
        content: 'Reset your Velon-ERP workspace password with email verification.',
      },
    ],
  }),
  component: ForgotPasswordPage,
});

type Step = 'email' | 'otp' | 'password';

const signals = [
  {
    icon: ShieldCheck,
    title: 'Account privacy',
    desc: 'We never reveal whether an email is registered — same response every time.',
  },
  {
    icon: Mail,
    title: 'Verification code',
    desc: 'Codes expire in 10 minutes and are single-use.',
  },
];

function ForgotPasswordPage() {
  const navigate = useNavigate();
  const t = useT();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [devOtpHint, setDevOtpHint] = useState<string | null>(null);
  const [verificationToken, setVerificationToken] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [requestSent, setRequestSent] = useState(false);

  async function onSendOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!isApiEnabled()) {
      toast.error(t('Configure VITE_API_URL to use password reset.'));
      return;
    }
    setBusy(true);
    try {
      const res = await apiRequestPasswordReset(email);
      setRequestSent(true);
      setDevOtpHint(res.devCode ?? null);
      setStep('otp');
      setOtp('');
      setVerificationToken(null);
      toast.success(
        res.delivered ? t('Verification code sent') : t(PASSWORD_RESET_GENERIC_MESSAGE),
      );
    } catch (err) {
      toast.error(formatApiError(err, t('Could not send verification code')));
    } finally {
      setBusy(false);
    }
  }

  async function onVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!isApiEnabled()) return;
    setBusy(true);
    try {
      const res = await apiVerifyPasswordResetOtp(email, otp);
      setVerificationToken(res.verificationToken);
      setStep('password');
      setPassword('');
      setConfirm('');
    } catch (err) {
      toast.error(formatApiError(err, t('Invalid verification code')));
    } finally {
      setBusy(false);
    }
  }

  async function onSavePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!verificationToken) {
      toast.error(t('Complete verification first.'));
      return;
    }
    if (!isPasswordStrong(password)) {
      toast.error(t('Password does not meet all requirements.'));
      return;
    }
    if (password !== confirm) {
      toast.error(t('Passphrases do not match.'));
      return;
    }
    setBusy(true);
    try {
      await apiCompletePasswordReset({ email, verificationToken, password });
      await navigate({ to: '/login', search: loginSearch({ reset: 'success' }) });
    } catch (err) {
      toast.error(formatApiError(err, t('Could not reset password')));
    } finally {
      setBusy(false);
    }
  }

  const portalTitle =
    step === 'email'
      ? 'Reset your password'
      : step === 'otp'
        ? 'Enter verification code'
        : 'Choose a new passphrase';

  const headline =
    step === 'email'
      ? 'Secure password recovery.'
      : step === 'otp'
        ? 'Check your email for the code.'
        : 'Create your new passphrase.';

  const description =
    step === 'email'
      ? "Enter your work email and we'll send a verification code."
      : step === 'otp'
        ? 'Enter the 6-digit code we sent. You can request a new code if it expired.'
        : 'Choose a strong password with uppercase, lowercase, a number, and a symbol.';

  const passwordSignals =
    step === 'password'
      ? [
          {
            icon: KeyRound,
            title: 'Password standard',
            desc: 'Minimum 8 characters with uppercase, lowercase, number, and symbol.',
          },
          {
            icon: ShieldCheck,
            title: 'Breach protection',
            desc: 'Known compromised passwords are rejected automatically.',
          },
        ]
      : signals;

  return (
    <AuthPortalShell
      variant="workspace"
      badge="Workspace portal"
      portalLabel="Velon-ERP Workspace"
      portalTitle={portalTitle}
      headline={headline}
      description={description}
      signals={passwordSignals}
      complianceIcon={LockKeyhole}
      complianceText={
        step === 'password'
          ? "You'll receive a confirmation email when your password changes."
          : 'Stay on this page — no need to open your mail app to continue.'
      }
      crossLink={{ label: 'Back to sign in', to: '/login', search: loginSearch() }}
    >
      <Card className="border-border bg-card p-6">
        {step === 'email' ? (
          <form
            className="space-y-4"
            onSubmit={onSendOtp}
          >
            <Input
              type="email"
              autoComplete="email"
              placeholder={t('Work email')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Button
              type="submit"
              disabled={busy}
              className="bg-foreground text-background hover:bg-foreground/90 w-full"
            >
              {busy ? t('Sending…') : t('Send OTP')}
            </Button>
          </form>
        ) : null}

        {step === 'otp' ? (
          <form
            className="space-y-4"
            onSubmit={onVerifyOtp}
          >
            {requestSent ? (
              <p className="text-muted-foreground text-sm">{t(PASSWORD_RESET_GENERIC_MESSAGE)}</p>
            ) : null}
            <p className="text-muted-foreground text-xs">
              {t('Code sent to')} <span className="text-foreground font-medium">{email}</span>
            </p>
            <Input
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder={t('6-digit code')}
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              required
            />
            {devOtpHint ? (
              <p className="text-muted-foreground text-xs">
                {t('Dev code: {code}', { code: devOtpHint })}
              </p>
            ) : null}
            <Button
              type="submit"
              disabled={busy || otp.length !== 6}
              className="bg-foreground text-background hover:bg-foreground/90 w-full"
            >
              {busy ? t('Verifying…') : t('Verify code')}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              className="w-full rounded-lg"
              onClick={() => {
                setStep('email');
                setRequestSent(false);
                setDevOtpHint(null);
              }}
            >
              {t('Use a different email')}
            </Button>
          </form>
        ) : null}

        {step === 'password' ? (
          <form
            className="space-y-4"
            onSubmit={onSavePassword}
          >
            <div className="space-y-2">
              <Label htmlFor="new-pass">{t('New passphrase')}</Label>
              <Input
                id="new-pass"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <PasswordRequirementsChecklist password={password} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-pass">{t('Confirm passphrase')}</Label>
              <Input
                id="confirm-pass"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </div>
            <Button
              type="submit"
              disabled={
                busy || !isPasswordStrong(password) || password !== confirm || confirm.length === 0
              }
              className="bg-foreground text-background hover:bg-foreground/90 w-full"
            >
              {busy ? t('Saving…') : t('Save password')}
            </Button>
          </form>
        ) : null}
      </Card>
    </AuthPortalShell>
  );
}
