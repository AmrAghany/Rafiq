import type { TFunction } from 'i18next';

import { WORKOUTS } from '@/features/plan/engine';
import { workoutName } from '@/features/plan/names';

import type { TimelineItem } from './timeline';

/** Title and description of a timeline item; shared by the Today screen and reminders. */
export function timelineText(item: TimelineItem, t: TFunction, language: string) {
  const workout =
    item.id === 'workout' && item.workoutKey ? workoutName(item.workoutKey, language) : '';
  const tomorrow =
    item.id === 'wind_down'
      ? item.workoutKey
        ? workoutName(item.workoutKey, language)
        : t('timeline.restDay')
      : '';
  const count = item.workoutKey ? (WORKOUTS[item.workoutKey]?.exerciseKeys.length ?? 0) : 0;
  return {
    title: t(`timeline.${item.id}.title`, { workout }),
    body: t(`timeline.${item.id}.body`, { tomorrow, count }),
  };
}
