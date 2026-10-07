import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Panel, Text } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';

import { chartGeometry } from './chart';
import { change, type SeriesPoint } from './rescan';

const HEIGHT = 132;
const PAD_LEFT = 40; // y-axis labels sit in this gutter
const PAD_RIGHT = 14;
const PAD_Y = 14;
const DOT = 10;
const RING = 2;
const HIT = 44;

/** "5 Oct" in the app language. */
export function shortDate(iso: string, language: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(language, { day: 'numeric', month: 'short' });
}

/**
 * One body measurement over time: a 2px line through the scans, with the selected scan's
 * value and date above the plot (the latest by default). Tap a dot to read another.
 * Single series, so the title names it and there's no legend.
 */
export function TrendChart({
  title,
  unit,
  points,
  testID,
}: {
  title: string;
  unit: string;
  points: SeriesPoint[];
  testID?: string;
}) {
  const { t, i18n } = useTranslation();
  const { colors, spacing } = useTheme();
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState(points.length - 1);
  const geo = chartGeometry(points, {
    width,
    height: HEIGHT,
    padLeft: PAD_LEFT,
    padRight: PAD_RIGHT,
    padY: PAD_Y,
  });
  const current = points[Math.min(selected, points.length - 1)];
  const delta = change(points);
  const fmt = (v: number) => `${v} ${unit}`;
  const signed = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${Math.abs(v)} ${unit}`;

  const summary =
    points.length === 0
      ? t('progress.noData')
      : delta == null
        ? t('progress.a11ySingle', { title, value: fmt(points[0].value) })
        : t('progress.a11yTrend', {
            title,
            from: fmt(points[0].value),
            fromDate: shortDate(points[0].date, i18n.language),
            to: fmt(points[points.length - 1].value),
            toDate: shortDate(points[points.length - 1].date, i18n.language),
            change: signed(delta),
          });

  return (
    <Panel style={{ gap: spacing.xs }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }}>
        <Text variant="label" accessibilityRole="header">
          {title}
        </Text>
        {delta != null ? (
          <Text variant="small" color="muted">
            {t('progress.sinceFirst', { change: signed(delta) })}
          </Text>
        ) : null}
      </View>
      {current ? (
        <Text testID={testID ? `${testID}-value` : undefined} accessibilityLiveRegion="polite">
          <Text variant="heading">{fmt(current.value)}</Text>
          <Text color="muted">{`  ${shortDate(current.date, i18n.language)}`}</Text>
        </Text>
      ) : null}

      {points.length < 2 ? (
        <Text variant="small" color="muted">
          {points.length ? t('progress.oneScan') : t('progress.noData')}
        </Text>
      ) : (
        <View
          testID={testID}
          accessible
          accessibilityLabel={summary}
          onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
          // Time runs left to right (oldest to newest) in both languages.
          style={{ height: HEIGHT, direction: 'ltr' }}>
          {width > 0 ? (
            <>
              {[
                { at: geo.yMaxAt, label: geo.yMax },
                { at: geo.yMinAt, label: geo.yMin },
              ].map(({ at, label }) => (
                <View
                  key={label}
                  importantForAccessibility="no-hide-descendants"
                  style={{ position: 'absolute', left: 0, right: 0, top: at }}>
                  <View
                    style={{
                      marginLeft: PAD_LEFT - 8,
                      height: StyleSheet.hairlineWidth,
                      backgroundColor: colors.line,
                    }}
                  />
                  <Text
                    variant="small"
                    color="muted"
                    maxFontSizeMultiplier={1.4}
                    style={{
                      position: 'absolute',
                      left: 0,
                      width: PAD_LEFT - 12,
                      top: -9,
                      textAlign: 'right',
                    }}>
                    {String(label)}
                  </Text>
                </View>
              ))}
              {geo.segments.map((s, i) => (
                <View
                  key={`s${i}`}
                  style={{
                    position: 'absolute',
                    left: s.cx - s.length / 2,
                    top: s.cy - 1,
                    width: s.length,
                    height: 2,
                    borderRadius: 1,
                    backgroundColor: colors.accent,
                    transform: [{ rotate: `${s.angle}deg` }],
                  }}
                />
              ))}
              {geo.dots.map((d, i) => {
                const isSelected = i === selected;
                const size = DOT + 2 * RING + (isSelected ? 4 : 0);
                return (
                  <Pressable
                    key={d.point.date + i}
                    accessibilityRole="button"
                    accessibilityLabel={`${shortDate(d.point.date, i18n.language)}: ${fmt(d.point.value)}`}
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => setSelected(i)}
                    style={{
                      position: 'absolute',
                      left: d.x - HIT / 2,
                      top: d.y - HIT / 2,
                      width: HIT,
                      height: HIT,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                    <View
                      style={{
                        width: size,
                        height: size,
                        borderRadius: size / 2,
                        borderWidth: RING,
                        borderColor: colors.surface,
                        backgroundColor: isSelected ? colors.ink : colors.accent,
                      }}
                    />
                  </Pressable>
                );
              })}
            </>
          ) : null}
        </View>
      )}
    </Panel>
  );
}
