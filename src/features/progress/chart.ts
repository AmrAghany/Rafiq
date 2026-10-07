// Geometry for the small trend charts on the Progress screen. Pure: the component draws
// what this returns with plain Views (2px line segments, dots with a surface ring).

import { daysBetween, type SeriesPoint } from './rescan';

export interface ChartBox {
  width: number;
  height: number;
  /** Room kept inside the box so dots don't touch the edges; the left side also holds
   * the y-axis labels. */
  padLeft: number;
  padRight: number;
  padY: number;
}

export interface Dot {
  x: number;
  y: number;
  point: SeriesPoint;
}

export interface Segment {
  /** Centre of the segment, its length and its angle in degrees. */
  cx: number;
  cy: number;
  length: number;
  angle: number;
}

export interface ChartGeometry {
  dots: Dot[];
  segments: Segment[];
  /** Clean whole-number y-axis bounds, drawn as two hairline gridlines. */
  yMin: number;
  yMax: number;
  /** y position of the gridlines for yMin and yMax. */
  yMinAt: number;
  yMaxAt: number;
}

/** Whole-number bounds with some air around the data, at least 2 units apart. */
export function niceDomain(values: readonly number[]): [number, number] {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = Math.max(0.5, (hi - lo) * 0.15);
  let min = Math.floor(lo - pad);
  let max = Math.ceil(hi + pad);
  if (max - min < 2) {
    min -= 1;
    max += 1;
  }
  return [min, max];
}

/**
 * Places the points: x by date (so a late rescan shows as a longer gap), y on a clean
 * whole-number scale. Left to right is oldest to newest in both languages.
 */
export function chartGeometry(points: readonly SeriesPoint[], box: ChartBox): ChartGeometry {
  const { width, height, padLeft, padRight, padY } = box;
  if (!points.length || width <= padLeft + padRight) {
    return { dots: [], segments: [], yMin: 0, yMax: 0, yMinAt: height - padY, yMaxAt: padY };
  }
  const [yMin, yMax] = niceDomain(points.map((p) => p.value));
  const span = daysBetween(points[0].date, points[points.length - 1].date);
  const plotW = width - padLeft - padRight;
  const plotH = height - 2 * padY;
  const xOf = (date: string) =>
    span === 0 ? padLeft + plotW / 2 : padLeft + (daysBetween(points[0].date, date) / span) * plotW;
  const yOf = (v: number) => padY + ((yMax - v) / (yMax - yMin)) * plotH;

  const dots = points.map((point) => ({ x: xOf(point.date), y: yOf(point.value), point }));
  const segments = dots.slice(1).map((b, i) => {
    const a = dots[i];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    return {
      cx: (a.x + b.x) / 2,
      cy: (a.y + b.y) / 2,
      length: Math.hypot(dx, dy),
      angle: (Math.atan2(dy, dx) * 180) / Math.PI,
    };
  });
  return { dots, segments, yMin, yMax, yMinAt: yOf(yMin), yMaxAt: yOf(yMax) };
}
