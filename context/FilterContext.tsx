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

interface DashboardFilters {
  year: string;
  month: string;
  dept: string;
  supervisor: string;
  manager: string;
}

interface FilterState {
  score: ScoreFilters | null;
  leave: LeaveFilters | null;
  dashboard: DashboardFilters | null;
  setScore: (f: ScoreFilters) => void;
  setLeave: (f: LeaveFilters) => void;
  setDashboard: (f: DashboardFilters) => void;
}

const FilterContext = createContext<FilterState>({
  score: null,
  leave: null,
  dashboard: null,
  setScore: () => {},
  setLeave: () => {},
  setDashboard: () => {},
});

export function FilterProvider({ children }: { children: ReactNode }) {
  const [score, setScore] = useState<ScoreFilters | null>(null);
  const [leave, setLeave] = useState<LeaveFilters | null>(null);
  const [dashboard, setDashboard] = useState<DashboardFilters | null>(null);
  return (
    <FilterContext.Provider value={{ score, leave, dashboard, setScore, setLeave, setDashboard }}>
      {children}
    </FilterContext.Provider>
  );
}

export const useFilterContext = () => useContext(FilterContext);
