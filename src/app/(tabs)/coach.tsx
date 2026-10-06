import { useTranslation } from 'react-i18next';

import { PlaceholderScreen } from '@/components/PlaceholderScreen';

export default function CoachScreen() {
  const { t } = useTranslation();
  return <PlaceholderScreen title={t('tabs.coach')} description={t('placeholder.coach')} />;
}
