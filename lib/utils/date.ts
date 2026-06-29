// Shared user-facing date formatting → e.g. "Jan 01, 2026".
// Accepts an ISO date ("YYYY-MM-DD") or a full timestamp string;
// returns "—" for null / empty / invalid input.
export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value.length <= 10 ? value + 'T00:00:00' : value);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}
