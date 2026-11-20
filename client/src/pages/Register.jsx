import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { AuthLayout } from '../components/AuthLayout.jsx';
import { Button, ErrorState, Field, Spinner, inputClass } from '../components/ui.jsx';
import { LANGUAGES } from '../i18n/index.js';
import { useAuth } from '../lib/auth.jsx';
import { istTodayISO } from '../lib/format.js';
import { useErrorText } from '../lib/useErrorText.js';

const DISTRICTS = [
  'Ahmedabad', 'Amreli', 'Anand', 'Aravalli', 'Banaskantha', 'Bharuch', 'Bhavnagar', 'Botad', 'Chhota Udepur', 'Dahod',
  'Dang', 'Devbhumi Dwarka', 'Gandhinagar', 'Gir Somnath', 'Jamnagar', 'Junagadh', 'Kheda', 'Kutch', 'Mahisagar', 'Mehsana',
  'Morbi', 'Narmada', 'Navsari', 'Panchmahal', 'Patan', 'Porbandar', 'Rajkot', 'Sabarkantha', 'Surat', 'Surendranagar',
  'Tapi', 'Vadodara', 'Valsad',
];

export default function Register() {
  const { t, i18n } = useTranslation();
  const errorText = useErrorText();
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    fullName: '', phone: '', password: '', dateOfBirth: '', gender: '', district: '',
    preferredLanguage: i18n.language, abhaId: '',
  });
  // After the first attempt, field errors update live as the form is corrected.
  const [attempted, setAttempted] = useState(false);
  const [serverErrors, setServerErrors] = useState({});
  const [serverError, setServerError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (key) => (event) => {
    setForm((f) => ({ ...f, [key]: event.target.value }));
    setServerErrors(({ [key]: _gone, ...rest }) => rest);
  };

  function check() {
    const next = {};
    for (const key of ['fullName', 'phone', 'password', 'dateOfBirth', 'gender', 'district']) {
      if (!form[key].trim()) next[key] = t('errors.required');
    }
    const digits = form.phone.replace(/\D/g, '').replace(/^(91|0)(?=\d{10}$)/, '');
    if (form.phone && !/^[6-9]\d{9}$/.test(digits)) next.phone = t('errors.phone');
    if (form.password && form.password.length < 8) next.password = t('errors.password');
    if (form.abhaId && !/^\d{14}$/.test(form.abhaId.replace(/[\s-]/g, ''))) next.abhaId = t('errors.abha');
    return next;
  }

  const errors = attempted ? { ...serverErrors, ...check() } : {};

  async function submit(event) {
    event.preventDefault();
    setAttempted(true);
    setServerError(null);
    setServerErrors({});
    if (Object.keys(check()).length) return;
    setBusy(true);
    try {
      await register({ ...form, abhaId: form.abhaId || undefined });
      navigate('/p', { replace: true });
    } catch (err) {
      setServerError(err);
      if (err.code === 'PHONE_TAKEN') setServerErrors({ phone: errorText(err) });
      else if (err.code === 'ABHA_TAKEN') setServerErrors({ abhaId: errorText(err) });
      else setServerErrors(err.fields ?? {});
      setBusy(false);
    }
  }

  const input = (key, props = {}) => (
    <input id={key} value={form[key]} onChange={set(key)} aria-invalid={Boolean(errors[key])} className={inputClass} {...props} />
  );

  return (
    <AuthLayout title={t('register.title')}>
      <form onSubmit={submit} className="space-y-5" noValidate>
        <Field label={t('register.fullName')} htmlFor="fullName" error={errors.fullName}>
          {input('fullName', { autoComplete: 'name' })}
        </Field>
        <Field label={t('register.phone')} htmlFor="phone" error={errors.phone}>
          {input('phone', { type: 'tel', inputMode: 'numeric', autoComplete: 'tel', placeholder: '98765 43210' })}
        </Field>
        <Field label={t('register.password')} htmlFor="password" hint={t('register.passwordHint')} error={errors.password}>
          {input('password', { type: 'password', autoComplete: 'new-password' })}
        </Field>
        <Field label={t('register.dateOfBirth')} htmlFor="dateOfBirth" error={errors.dateOfBirth}>
          {input('dateOfBirth', { type: 'date', max: istTodayISO(), min: '1900-01-01' })}
        </Field>

        <fieldset className="space-y-1.5">
          <legend className="font-semibold">{t('register.gender')}</legend>
          <div className="grid grid-cols-3 gap-2">
            {['female', 'male', 'other'].map((g) => (
              <label key={g} className={`flex min-h-12 cursor-pointer items-center justify-center rounded-xl border font-semibold ${form.gender === g ? 'border-brand bg-brand text-on-brand' : 'border-line bg-surface'}`}>
                <input type="radio" name="gender" value={g} checked={form.gender === g} onChange={set('gender')} className="sr-only" />
                {t(`gender.${g}`)}
              </label>
            ))}
          </div>
          {errors.gender && <p className="text-sm font-medium text-kumkum">{errors.gender}</p>}
        </fieldset>

        <Field label={t('register.district')} htmlFor="district" error={errors.district}>
          <select id="district" value={form.district} onChange={set('district')} aria-invalid={Boolean(errors.district)} className={inputClass}>
            <option value="" />
            {DISTRICTS.map((d) => <option key={d}>{d}</option>)}
          </select>
        </Field>

        <fieldset className="space-y-1.5">
          <legend className="font-semibold">{t('register.language')}</legend>
          <div className="grid grid-cols-3 gap-2">
            {LANGUAGES.map(({ code, label }) => (
              <label key={code} lang={code} className={`flex min-h-12 cursor-pointer items-center justify-center rounded-xl border font-semibold ${form.preferredLanguage === code ? 'border-brand bg-brand text-on-brand' : 'border-line bg-surface'}`}>
                <input type="radio" name="language" value={code} checked={form.preferredLanguage === code}
                  onChange={(e) => { set('preferredLanguage')(e); i18n.changeLanguage(code); }} className="sr-only" />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        <Field label={t('register.abhaId')} htmlFor="abhaId" hint={t('register.abhaHint')} error={errors.abhaId}>
          {input('abhaId', { inputMode: 'numeric', placeholder: '12-3456-7890-1234' })}
        </Field>

        {serverError && !Object.keys(errors).length && <ErrorState message={errorText(serverError)} />}
        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy && <Spinner />} {t('register.submit')}
        </Button>
      </form>
      <p className="mt-6 text-center text-ink-soft">
        {t('register.haveAccount')}{' '}
        <Link to="/login" className="font-semibold text-ink underline decoration-haldi decoration-2 underline-offset-4">
          {t('register.login')}
        </Link>
      </p>
    </AuthLayout>
  );
}
