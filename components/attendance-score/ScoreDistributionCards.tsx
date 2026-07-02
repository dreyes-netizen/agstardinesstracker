'use client';

import type { AttendanceScore } from '@/lib/queries/attendance-score';

const BANDS = [
  { grade: 1, band: 'Below 90%', ring: 'ring-nte-red border-nte-red', text: 'text-nte-red' },
  { grade: 2, band: '90–94%', ring: 'ring-amber border-amber', text: 'text-amber-dark' },
  { grade: 3, band: '95–99%', ring: 'ring-app-blue border-app-blue', text: 'text-app-blue' },
  { grade: 5, band: '100%+', ring: 'ring-safe-green border-safe-green', text: 'text-safe-green' },
] as const;

interface ScoreDistributionCardsProps {
  scores: AttendanceScore[];
  selectedGrade: number | null;
  onSelectGrade: (grade: number | null) => void;
}

export function ScoreDistributionCards({ scores, selectedGrade, onSelectGrade }: ScoreDistributionCardsProps) {
  const total = scores.length;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
      {BANDS.map(({ grade, band, ring, text }) => {
        const count = scores.filter((s) => s.attendanceGrade === grade).length;
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        const selected = selectedGrade === grade;

        return (
          <button
            key={grade}
            type="button"
            onClick={() => onSelectGrade(selected ? null : grade)}
            aria-pressed={selected}
            title={selected ? 'Clear filter' : `Filter table to Score ${grade}`}
            className={`relative text-left bg-white border rounded-[7px] px-4 py-3.5 transition-all hover:border-app-text/30 hover:shadow-sm ${
              selected ? `border-2 ring-1 ${ring}` : 'border-border'
            }`}
          >
            <svg
              className={`absolute top-3.5 right-4 ${selected ? text : 'text-muted/40'}`}
              width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            >
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
            <p className="text-[11px] font-medium text-muted mb-1 pr-4">Score {grade} &middot; {band}</p>
            <p className={`text-[24px] font-bold leading-none tracking-tight ${text}`}>{count}</p>
            <p className="text-[11px] text-muted mt-1">{pct}% of employees</p>
          </button>
        );
      })}
    </div>
  );
}
