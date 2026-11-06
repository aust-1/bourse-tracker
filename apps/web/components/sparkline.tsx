/** Mini-courbe sans axes (SVG serveur). Le texte alternatif porte l'information. */
export function Sparkline({
  values,
  reference,
  label,
  width = 240,
  height = 48,
}: {
  values: readonly number[];
  /** Courbe de référence en pointillés (ex. montant investi), alignée sur `values` */
  reference?: readonly number[];
  label: string;
  width?: number;
  height?: number;
}) {
  if (values.length < 2) return null;
  const ref = reference && reference.length === values.length ? reference : null;
  const all = ref ? [...values, ...ref] : values;
  const min = Math.min(...all);
  const max = Math.max(...all);
  const span = max - min || 1;
  const pad = 3;
  const toPts = (series: readonly number[]) =>
    series.map((v, i) => {
      const x = pad + (i / (series.length - 1)) * (width - 2 * pad);
      const y = pad + (1 - (v - min) / span) * (height - 2 * pad);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
  const pts = toPts(values);
  const last = pts[pts.length - 1]!.split(',');

  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${width} ${height}`}
      className="viz-root h-12 w-full max-w-xs"
    >
      {ref && (
        <polyline
          points={toPts(ref).join(' ')}
          fill="none"
          stroke="var(--series-ref)"
          strokeWidth={1.5}
          strokeDasharray="4 3"
        />
      )}
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke="var(--series-1)"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle
        cx={last[0]}
        cy={last[1]}
        r={4}
        fill="var(--series-1)"
        stroke="var(--viz-surface)"
        strokeWidth={2}
      />
    </svg>
  );
}
