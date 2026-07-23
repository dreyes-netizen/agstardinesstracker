// Classifies an attendance row's "Shift/Schedule" text (Detailed col 3,
// stored as attendance_records.shift_schedule) into a working vs.
// non-working day. Sprout encodes holidays, approved leave, and pre-hire
// days as suffixes/labels on that same column instead of a dedicated
// status field (e.g. "09:00 PM To 06:00 AM (HOLIDAY)", "ON LEAVE",
// "NOT YET HIRED", "(UNPAID LEAVE)"). These are 0-hour days, but the
// employee wasn't expected to work — they must not count as Absent or
// inflate Required Hours. ("REST DAY" is a separate, pre-existing case
// already filtered out at ingest in lib/parsers/attendance.ts.)
export type DayType = 'working' | 'holiday' | 'on-leave' | 'unpaid-leave' | 'not-yet-hired';

// Order matters: first match wins. NOT YET HIRED / UNPAID LEAVE checked
// before the broader HOLIDAY / ON LEAVE so more specific labels win.
const DAY_TYPE_PATTERNS: [pattern: string, type: DayType][] = [
  ['NOT YET HIRED', 'not-yet-hired'],
  ['UNPAID LEAVE', 'unpaid-leave'],
  ['HOLIDAY', 'holiday'],
  ['ON LEAVE', 'on-leave'],
];

// The raw uppercase substrings, shared with the SQL predicate in
// getAttendanceScores so the query and the UI classify identically.
export const NON_WORKING_PATTERNS: string[] = DAY_TYPE_PATTERNS.map(([p]) => p);

export const DAY_TYPE_LABEL: Record<DayType, string> = {
  working: 'Working',
  holiday: 'Holiday',
  'on-leave': 'On Leave',
  'unpaid-leave': 'Unpaid Leave',
  'not-yet-hired': 'Not Yet Hired',
};

export function classifyDayType(shiftSchedule: string | null | undefined): DayType {
  const s = (shiftSchedule ?? '').toUpperCase();
  for (const [pattern, type] of DAY_TYPE_PATTERNS) {
    if (s.includes(pattern)) return type;
  }
  return 'working';
}
