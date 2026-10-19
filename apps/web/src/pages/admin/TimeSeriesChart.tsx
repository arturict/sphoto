import { useId } from 'react';
import { formatDay } from '../../lib/format';

export interface SeriesPoint {
  date: string;
  value: number;
}

interface TimeSeriesChartProps {
  title: string;
  valueHeader: string;
  kind: 'bars' | 'line';
  points: SeriesPoint[];
  formatValue: (value: number) => string;
}

const WIDTH = 640;
const HEIGHT = 240;
const PAD = { left: 100, right: 16, top: 16, bottom: 32 };
const PLOT_W = WIDTH - PAD.left - PAD.right;
const PLOT_H = HEIGHT - PAD.top - PAD.bottom;

// Each chart ships with a table of the same numbers, so the drawing is never the only way to read the data.
export function TimeSeriesChart({ title, valueHeader, kind, points, formatValue }: TimeSeriesChartProps) {
  const titleId = useId();
  const first = points[0];
  const last = points[points.length - 1];
  const max = Math.max(1, ...points.map((point) => point.value));
  const y = (value: number) => PAD.top + PLOT_H - (value / max) * PLOT_H;
  const baseline = PAD.top + PLOT_H;
  const ticks = [0, max];

  const band = PLOT_W / Math.max(points.length, 1);
  const barX = (index: number) => PAD.left + index * band + band * 0.15;
  const lineX = (index: number) => PAD.left + (points.length === 1 ? PLOT_W / 2 : (index / (points.length - 1)) * PLOT_W);

  const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${lineX(index).toFixed(1)},${y(point.value).toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${lineX(points.length - 1).toFixed(1)},${baseline} L${lineX(0).toFixed(1)},${baseline} Z`;

  return (
    <figure className="rounded-2xl border border-line bg-surface p-5">
      <figcaption id={titleId} className="font-semibold">
        {title}
      </figcaption>
      {first && last ? (
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-labelledby={titleId}
          className="mt-3 h-auto w-full"
        >
          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(tick)} y2={y(tick)} className="stroke-line" strokeWidth="1" />
              <text x={PAD.left - 8} y={y(tick)} textAnchor="end" dominantBaseline="middle" className="fill-muted" fontSize="14">
                {formatValue(tick)}
              </text>
            </g>
          ))}
          {kind === 'bars' ? (
            points.map((point, index) => {
              const height = (point.value / max) * PLOT_H;
              return (
                <rect key={point.date} x={barX(index)} y={baseline - height} width={Math.max(band * 0.7, 1)} height={height} rx="2" className="fill-accent">
                  <title>{`${formatDay(point.date)}: ${formatValue(point.value)}`}</title>
                </rect>
              );
            })
          ) : (
            <>
              <path d={areaPath} className="fill-accent/15" />
              <path d={linePath} className="fill-none stroke-accent" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
              {points.map((point, index) => (
                <circle key={point.date} cx={lineX(index)} cy={y(point.value)} r="6" className="fill-transparent">
                  <title>{`${formatDay(point.date)}: ${formatValue(point.value)}`}</title>
                </circle>
              ))}
            </>
          )}
          <text x={PAD.left} y={HEIGHT - 6} textAnchor="start" className="fill-muted" fontSize="14">
            {formatDay(first.date)}
          </text>
          <text x={WIDTH - PAD.right} y={HEIGHT - 6} textAnchor="end" className="fill-muted" fontSize="14">
            {formatDay(last.date)}
          </text>
        </svg>
      ) : (
        <p className="mt-3 text-sm text-muted">Für diesen Zeitraum liegen keine Daten vor.</p>
      )}
      {points.length > 0 ? (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer font-medium text-accent">Daten als Tabelle anzeigen</summary>
          <div className="mt-2 max-h-72 overflow-auto">
            <table className="w-full text-left" aria-label={title}>
              <thead className="text-muted">
                <tr>
                  <th scope="col" className="py-1.5 pr-4 font-medium">Datum</th>
                  <th scope="col" className="py-1.5 font-medium">{valueHeader}</th>
                </tr>
              </thead>
              <tbody>
                {points.map((point) => (
                  <tr key={point.date} className="border-t border-line">
                    <th scope="row" className="py-1.5 pr-4 font-normal">{formatDay(point.date)}</th>
                    <td className="py-1.5">{formatValue(point.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ) : null}
    </figure>
  );
}
