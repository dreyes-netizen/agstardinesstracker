'use client';

import { useEffect, useState } from 'react';
import type { AttendanceScore } from '@/lib/queries/attendance-score';
import { ScoreDistributionCards } from './ScoreDistributionCards';
import { ScoreTable } from './ScoreTable';

interface ScoreBoardProps {
  data: AttendanceScore[];
  start: string;
  end: string;
  dept?: string;
  supervisor?: string;
  manager?: string;
}

export function ScoreBoard({ data, start, end, dept, supervisor, manager }: ScoreBoardProps) {
  const [selectedGrade, setSelectedGrade] = useState<number | null>(null);

  // Filters upstream (date range/dept/etc.) produced a new dataset — don't
  // carry a stale grade selection over onto it.
  useEffect(() => {
    setSelectedGrade(null);
  }, [data]);

  return (
    <>
      <ScoreDistributionCards scores={data} selectedGrade={selectedGrade} onSelectGrade={setSelectedGrade} />
      <ScoreTable
        data={data}
        gradeFilter={selectedGrade}
        start={start}
        end={end}
        dept={dept}
        supervisor={supervisor}
        manager={manager}
      />
    </>
  );
}
