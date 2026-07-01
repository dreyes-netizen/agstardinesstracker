'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';

interface ScoreFilters {
  start: string;
  end: string;
  dept: string;
  supervisor: string;
  manager: string;
}

interface LeaveFilters {
  start: string;
  end: string;
}

interface FilterState {
  score: ScoreFilters | null;
  leave: LeaveFilters | null;
  setScore: (f: ScoreFilters) => void;
  setLeave: (f: LeaveFilters) => void;
}

const FilterContext = createContext<FilterState>({
  score: null,
  leave: null,
  setScore: () => {},
  setLeave: () => {},
});

export function FilterProvider({ children }: { children: ReactNode }) {
  const [score, setScore] = useState<ScoreFilters | null>(null);
  const [leave, setLeave] = useState<LeaveFilters | null>(null);
  return (
    <FilterContext.Provider value={{ score, leave, setScore, setLeave }}>
      {children}
    </FilterContext.Provider>
  );
}

export const useFilterContext = () => useContext(FilterContext);
