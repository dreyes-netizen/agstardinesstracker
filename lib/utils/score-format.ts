// Shared number/color formatting for the Attendance Score table and detail
// drawer, so both render identically.

export const h2 = (n: number) => n.toFixed(2);
export const pct2 = (n: number) => `${(n * 100).toFixed(2)}%`;

// Small hours value → readable duration (0.4167 -> "25m", 1.5 -> "1h 30m").
export function fmtDuration(hours: number): string {
  const totalMin = Math.round(hours * 60);
  if (totalMin < 60) return `${totalMin}m`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

// Color tiers mirror the "Attendance Score" sheet's conditional formatting.
export function pctClass(p: number): string {
  if (p < 0.9) return 'bg-nte-red/10 text-nte-red';
  if (p < 0.95) return 'bg-amber/10 text-amber';
  if (p < 1) return 'bg-app-blue/10 text-app-blue';
  return 'bg-safe-green/10 text-safe-green';
}
export function gradeClass(g: number): string {
  if (g === 1) return 'bg-nte-red/10 text-nte-red';
  if (g === 2) return 'bg-amber/10 text-amber';
  if (g === 3) return 'bg-app-blue/10 text-app-blue';
  return 'bg-safe-green/10 text-safe-green';
}
