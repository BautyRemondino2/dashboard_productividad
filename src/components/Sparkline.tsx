/** Minimal inline SVG sparkline with gradient fill. Shared by Glosario (precios) y Mercado (panel). */
export default function Sparkline({ data, color = "currentColor", width = 84, height = 26 }: {
  data: number[]; color?: string; width?: number; height?: number;
}) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = width / (data.length - 1);
  const pts = data.map((v, i) => [
    (i * stepX).toFixed(1),
    (height - 2 - ((v - min) / range) * (height - 4)).toFixed(1),
  ] as [string, string]);
  const d = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x},${y}`).join(" ");
  const [lx, ly] = pts[pts.length - 1]!;
  const gid = `sg${data.length}${Math.round(data[0] ?? 0)}`;
  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d} L${lx},${height} L0,${height} Z`} fill={`url(#${gid})`} />
      <path d={d} stroke={color} strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lx} cy={ly} r="2" fill={color} />
    </svg>
  );
}
