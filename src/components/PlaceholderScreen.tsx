import { useTranslation } from 'react-i18next';

import { Panel, Screen, Text } from './ui';

/** Phase 1 stand-in for tabs that are built in later phases. */
export function PlaceholderScreen({ title, description }: { title: string; description: string }) {
  const { t } = useTranslation();
  return (
    <Screen>
      <Text variant="title" accessibilityRole="header">
        {title}
      </Text>
      <Panel>
        <Text>{description}</Text>
        <Text variant="small" color="muted">
          {t('placeholder.comingSoon')}
        </Text>
      </Panel>
    </Screen>
  );
}
