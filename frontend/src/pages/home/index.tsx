import { useTranslation } from 'react-i18next';

export default function HomePage() {
  const { t } = useTranslation('common');

  return (
    <main>
      <h1>{t('appName')}</h1>
    </main>
  );
}
