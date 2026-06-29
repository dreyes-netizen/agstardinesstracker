// Shared date helpers for Sprout report parsers.
// Sprout exports dates inconsistently: real Date objects (when read with
// cellDates:true), Excel serial numbers, or strings like "YYYY-MM-DD",
// "M/D/YYYY", or "MM-DD-YYYY". These normalize everything to ISO "YYYY-MM-DD".

export function isDateLike(val: unknown): boolean {
  if (val instanceof Date) return !isNaN(val.getTime());
  if (typeof val === 'number') return val > 40000 && val < 60000;
  if (typeof val === 'string') {
    return /^\d{4}-\d{2}-\d{2}$/.test(val)
      || /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(val)
      || /^\d{1,2}-\d{1,2}-\d{4}$/.test(val);
  }
  return false;
}

export function toISODate(val: Date | number | string): string {
  if (typeof val === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
    // M/D/YYYY or MM-DD-YYYY
    const p = val.split(/[/-]/);
    if (p.length === 3) {
      return `${p[2]}-${p[0].padStart(2, '0')}-${p[1].padStart(2, '0')}`;
    }
    return val;
  }
  let d: Date;
  if (val instanceof Date) {
    d = new Date(val.getTime() - val.getTimezoneOffset() * 60000);
  } else {
    d = new Date((val - 25569) * 86400 * 1000);
  }
  return d.toISOString().split('T')[0];
}

// Parses a "YYYY-MM-DD - YYYY-MM-DD" range string (e.g. the "Date:" cell or
// the leave report's "FOR DATE RANGE:" cell).
export function parsePeriod(val: unknown): { start: string; end: string } | null {
  if (typeof val !== 'string') return null;
  const m = val.match(/(\d{4}-\d{2}-\d{2})\s*-\s*(\d{4}-\d{2}-\d{2})/);
  return m ? { start: m[1], end: m[2] } : null;
}
