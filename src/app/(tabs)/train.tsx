import { useTranslation } from 'react-i18next';

import { PlaceholderScreen } from '@/components/PlaceholderScreen';

export default function TrainScreen() {
  const { t } = useTranslation();
  return <PlaceholderScreen title={t('tabs.train')} description={t('placeholder.train')} />;
}
