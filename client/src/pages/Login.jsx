import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router';
import { AuthLayout } from '../components/AuthLayout.jsx';
import { Button, ErrorState, Field, Spinner, inputClass } from '../components/ui.jsx';
import { homeFor } from '../components/RequireRole.jsx';
import { useAuth } from '../lib/auth.jsx';
import { useErrorText } from '../lib/useErrorText.js';

export default function Login() {
  const { t } = useTranslation();
  const errorText = useErrorText();
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const user = await login(phone, password);
      const from = location.state?.from;
      navigate(from?.startsWith(homeFor(user)) ? from : homeFor(user), { replace: true });
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  return (
    <AuthLayout title={t('login.title')} subtitle={t('login.subtitle')}>
      <form onSubmit={submit} className="space-y-5" noValidate>
        <Field label={t('login.phone')} htmlFor="phone">
          <input id="phone" type="tel" inputMode="numeric" autoComplete="tel" required value={phone}
            onChange={(e) => setPhone(e.target.value)} className={inputClass} placeholder="98765 43210" />
        </Field>
        <Field label={t('login.password')} htmlFor="password">
          <input id="password" type="password" autoComplete="current-password" required value={password}
            onChange={(e) => setPassword(e.target.value)} className={inputClass} />
        </Field>
        {error && <ErrorState message={errorText(error.code === 'VALIDATION_FAILED' ? { code: 'UNAUTHORIZED' } : error)} />}
        <Button type="submit" size="lg" className="w-full" disabled={busy || !phone || !password}>
          {busy && <Spinner />} {t('login.submit')}
        </Button>
      </form>
      <p className="mt-6 text-center text-ink-soft">
        {t('login.newPatient')}{' '}
        <Link to="/register" className="font-semibold text-ink underline decoration-haldi decoration-2 underline-offset-4">
          {t('login.register')}
        </Link>
      </p>
    </AuthLayout>
  );
}
