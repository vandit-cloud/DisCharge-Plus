import { useTranslation } from 'react-i18next';

/** An ApiError as a sentence in the current language (falls back to the server's message). */
export function useErrorText() {
  const { t } = useTranslation();
  return (error) => {
    if (!error) return '';
    if (error.code === 'NETWORK' || error.status >= 500) return t('app.error');
    return t(`errors.${error.code}`, { defaultValue: error.message || t('app.error') });
  };
}
