import { useTranslation } from 'react-i18next';

import { PlaceholderScreen } from '@/components/PlaceholderScreen';

export default function FoodScreen() {
  const { t } = useTranslation();
  return <PlaceholderScreen title={t('tabs.food')} description={t('placeholder.food')} />;
}
