import { useId } from 'react';

/**
 * The overview's four small charts, drawn by hand in SVG.
 *
 * NO CHART LIBRARY, deliberately. A sparkline, a row of bars, a grouped bar chart and a
 * donut are each a few dozen lines of geometry, and a library big enough to draw them would
 * cost more of the bundle budget than the whole overview, and would bring its own idea of
 * what a chart looks like to argue with the design.
 *
 * EVERY CHART DRAWS ITS EMPTY STATE AS A CHART. A clinic whose agent has taken no calls yet
 * sees a flat line, empty bars on a real axis and a grey ring, which is the truth told in
 * the design's own shapes, rather than a different component saying "no data".
 */

/** A smooth path through the points, by midpoints: no overshoot below the baseline. */
const smoothPath = (points: readonly (readonly [number, number])[]): string => {
  const [first, ...rest] = points;

  if (first === undefined) {
    return '';
  }

  let path = `M ${first[0]} ${first[1]}`;
  let previous = first;

  for (const point of rest) {
    const midX = (previous[0] + point[0]) / 2;
    path += ` C ${midX} ${previous[1]}, ${midX} ${point[1]}, ${point[0]} ${point[1]}`;
    previous = point;
  }

  return path;
};

/**
 * The trend line on a KPI card, 96 by 42 as the design draws it, with the area under it
 * faded to nothing in the line's own colour.
 */
export const Sparkline = ({
  values,
  colour,
}: {
  readonly values: readonly number[];
  readonly colour: string;
}) => {
  const gradientId = useId();
  const width = 96;
  const height = 42;
  const max = Math.max(...values, 0);
  const series = values.length < 2 ? [values[0] ?? 0, values[0] ?? 0] : values;

  const points = series.map((value, index): readonly [number, number] => [
    (index / (series.length - 1)) * (width - 2) + 1,
    // A flat series sits on the floor rather than floating mid-card: zero is zero.
    max === 0 ? height - 2 : height - 3 - (value / max) * (height - 8),
  ]);

  const line = smoothPath(points);
  const area = `${line} L ${width - 1} ${height} L 1 ${height} Z`;

  return (
    <svg
      aria-hidden="true"
      width={width}
      height={height}
      viewBox={`0 0 ${String(width)} ${String(height)}`}
      fill="none"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={colour} stopOpacity="0.22" />
          <stop offset="100%" stopColor={colour} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path d={line} stroke={colour} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
};
