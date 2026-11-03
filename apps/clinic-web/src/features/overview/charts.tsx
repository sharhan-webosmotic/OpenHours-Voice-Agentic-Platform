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

/**
 * The revenue card's twelve bars: the earlier eight pale, the latest four strong, as drawn.
 *
 * A slice with nothing in it is a 2px stub rather than a gap, so the row still reads as
 * twelve slices of time instead of a broken chart.
 */
export const RevenueBars = ({ values }: { readonly values: readonly number[] }) => {
  const max = Math.max(...values, 0);

  return (
    <div aria-hidden="true" className="flex h-[37px] items-end gap-[5px]">
      {values.map((value, index) => (
        <span
          // Twelve fixed slices of time that never reorder, so the position IS the identity.
          key={`slice-${String(index)}`}
          className="block w-[19px] rounded-t-[2px]"
          style={{
            height: max === 0 ? 2 : Math.max(2, Math.round((value / max) * 37)),
            backgroundColor: index >= values.length - 4 ? '#8b6ae8' : '#d9cefa',
          }}
        />
      ))}
    </div>
  );
};

/** A tidy axis maximum: four equal steps, each a round number. */
export const niceMax = (value: number): number => {
  if (value <= 4) {
    return 4;
  }

  const step = Math.ceil(value / 4);
  const magnitude = 10 ** Math.floor(Math.log10(step));
  const tidy = [1, 2, 2.5, 5, 10]
    .map((factor) => factor * magnitude)
    .find((candidate) => candidate >= step);

  return (tidy ?? step) * 4;
};

export type ActivityColumn = {
  readonly label: string;
  readonly calls: number;
  readonly bookings: number;
};

/**
 * The paired bars of "AI Call Activity": calls answered in blue, AI bookings in violet,
 * against a five-line axis, as the design draws it.
 */
export const ActivityBars = ({ columns }: { readonly columns: readonly ActivityColumn[] }) => {
  const top = niceMax(Math.max(...columns.flatMap((column) => [column.calls, column.bookings]), 0));
  const ticks = [4, 3, 2, 1, 0].map((step) => (top / 4) * step);
  const dense = columns.length > 7;

  return (
    <div className="grid h-[212px] grid-cols-[28px_minmax(0,1fr)]" aria-hidden="true">
      <div className="flex h-[206px] flex-col justify-between pb-0">
        {ticks.map((tick) => (
          <span key={tick} className="-translate-y-1/2 text-[#9aa5b9] text-xs leading-none">
            {tick}
          </span>
        ))}
      </div>

      <div className="flex flex-col">
        <div
          className="grid h-[206px] items-end border-border-chrome border-b"
          style={{
            gridTemplateColumns: `repeat(${String(columns.length)}, minmax(0, 1fr))`,
            columnGap: dense ? 3 : 11,
          }}
        >
          {columns.map((column) => (
            <div key={column.label} className="flex h-full items-end justify-center gap-1">
              <span
                className="block rounded-t-[4px] rounded-b-[2px] bg-accent shadow-[0px_4px_8px_0px_rgba(53,106,230,0.14)]"
                style={{
                  width: dense ? 4 : 9,
                  height: `${String((column.calls / top) * 100)}%`,
                }}
              />
              <span
                className="block rounded-t-[4px] rounded-b-[2px] bg-[#8b6ae8] shadow-[0px_4px_8px_0px_rgba(139,106,232,0.12)]"
                style={{
                  width: dense ? 4 : 9,
                  height: `${String((column.bookings / top) * 100)}%`,
                }}
              />
            </div>
          ))}
        </div>

        <div
          className="grid pt-1.5"
          style={{ gridTemplateColumns: `repeat(${String(columns.length)}, minmax(0, 1fr))` }}
        >
          {columns.map((column, index) => (
            <span key={column.label} className="text-center font-medium text-default text-xs">
              {/* Every label at a week; every fifth at a month, which is what fits. */}
              {!dense || index % 5 === 0 ? column.label : ''}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export type DonutSegment = {
  readonly label: string;
  readonly value: number;
  readonly colour: string;
};

/**
 * The outcomes ring: 150px across with a 20px band, as drawn, total in the middle.
 *
 * Drawn as one circle per segment with a dash offset, starting at twelve o'clock. A total of
 * zero is a whole grey ring, which is what "no calls yet" looks like in this shape.
 */
export const Donut = ({
  segments,
  total,
  caption,
}: {
  readonly segments: readonly DonutSegment[];
  readonly total: number;
  readonly caption: string;
}) => {
  const radius = 65;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="relative size-[150px] shrink-0">
      <svg aria-hidden="true" viewBox="0 0 150 150" className="-rotate-90 size-full">
        <circle cx="75" cy="75" r={radius} fill="none" stroke="#e9edf5" strokeWidth="20" />
        {total > 0 &&
          segments
            .filter((segment) => segment.value > 0)
            .map((segment) => {
              const length = (segment.value / total) * circumference;
              const circle = (
                <circle
                  key={segment.label}
                  cx="75"
                  cy="75"
                  r={radius}
                  fill="none"
                  stroke={segment.colour}
                  strokeWidth="20"
                  strokeDasharray={`${String(length)} ${String(circumference - length)}`}
                  strokeDashoffset={-offset}
                />
              );
              offset += length;
              return circle;
            })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <strong className="font-bold text-[1.625rem] text-default tracking-[-1px]">{total}</strong>
        <span className="text-default text-xs">{caption}</span>
      </div>
    </div>
  );
};
