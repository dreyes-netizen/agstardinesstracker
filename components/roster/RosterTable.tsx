'use client';

import { useState, useMemo, useEffect } from 'react';
import { Employee } from '@/lib/db/schema';

const SELECT = 'bg-ground border border-border rounded-[5px] px-2.5 py-1.5 text-[12.5px] text-app-text focus:outline-none max-w-[180px]';

function uniqSorted(values: (string | null)[]): string[] {
  return Array.from(new Set(values.filter(Boolean) as string[])).sort();
}

export function RosterTable({ employees }: { employees: Employee[] }) {
  const [search, setSearch] = useState('');
  const [dept, setDept] = useState('');
  const [supervisor, setSupervisor] = useState('');
  const [manager, setManager] = useState('');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const departments = useMemo(() => uniqSorted(employees.map((e) => e.department)), [employees]);

  // Supervisor/Manager options cascade: narrow to the chosen department.
  const scoped = useMemo(
    () => (dept ? employees.filter((e) => e.department === dept) : employees),
    [employees, dept],
  );
  const supervisors = useMemo(() => uniqSorted(scoped.map((e) => e.immediateSupervisor)), [scoped]);
  const managers = useMemo(() => uniqSorted(scoped.map((e) => e.approver2)), [scoped]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return employees.filter((e) => {
      if (dept && e.department !== dept) return false;
      if (supervisor && e.immediateSupervisor !== supervisor) return false;
      if (manager && e.approver2 !== manager) return false;
      if (q) {
        const name = `${e.lastName} ${e.firstName} ${e.middleName ?? ''}`.toLowerCase();
        const alt = `${e.firstName} ${e.lastName}`.toLowerCase();
        if (!name.includes(q) && !alt.includes(q) && !e.employeeId.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [employees, search, dept, supervisor, manager]);

  function handleDept(value: string) {
    setDept(value);
    // Drop supervisor/manager picks that no longer belong to the new department.
    if (value) {
      const inDept = employees.filter((e) => e.department === value);
      if (supervisor && !inDept.some((e) => e.immediateSupervisor === supervisor)) setSupervisor('');
      if (manager && !inDept.some((e) => e.approver2 === manager)) setManager('');
    }
  }

  useEffect(() => { setPage(0); }, [search, dept, supervisor, manager]);

  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const hasFilters = !!(search || dept || supervisor || manager);

  function clearAll() {
    setSearch(''); setDept(''); setSupervisor(''); setManager('');
  }

  return (
    <div className="bg-white border border-border rounded-[7px] overflow-clip flex flex-col flex-1 min-h-0">
      {/* Filter bar */}
      <div className="px-5 py-3 border-b border-border flex items-center gap-2.5 flex-wrap flex-shrink-0">
        <span className="text-[13.5px] font-semibold text-app-text flex-shrink-0 mr-1">All Employees</span>

        <div className="relative flex-1 min-w-[180px]">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or ID…"
            className="w-full pl-8 pr-3 py-1.5 text-[12.5px] bg-ground border border-border rounded-[5px] focus:outline-none focus:ring-2 focus:ring-app-blue/40 placeholder:text-muted"
          />
        </div>

        <select value={dept} onChange={(e) => handleDept(e.target.value)} className={SELECT}>
          <option value="">All Departments</option>
          {departments.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>

        <select value={supervisor} onChange={(e) => setSupervisor(e.target.value)} className={SELECT}>
          <option value="">{dept ? `All Supervisors (${supervisors.length})` : 'All Supervisors'}</option>
          {supervisors.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        <select value={manager} onChange={(e) => setManager(e.target.value)} className={SELECT}>
          <option value="">{dept ? `All Managers (${managers.length})` : 'All Managers'}</option>
          {managers.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>

        {hasFilters && (
          <button onClick={clearAll} className="text-[11.5px] text-muted hover:text-app-text border border-border hover:border-app-text/30 rounded-[5px] px-2 py-1 transition-colors">
            Clear
          </button>
        )}

        <span className="text-[11.5px] text-muted flex-shrink-0 ml-auto">
          {filtered.length}{hasFilters ? ` of ${employees.length}` : ''} employees
        </span>
      </div>

      <div className="overflow-auto flex-1 min-h-0">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-10 bg-ground">
            <tr className="border-b border-border">
              {[
                { h: 'Employee ID', extra: ' hidden md:table-cell' },
                { h: 'Name', extra: '' },
                { h: 'Department', extra: '' },
                { h: 'Immediate Supervisor', extra: ' hidden md:table-cell' },
                { h: 'Manager (Approver 2)', extra: ' hidden md:table-cell' },
                { h: 'Hire Date', extra: ' hidden md:table-cell' },
              ].map(({ h, extra }) => (
                <th key={h} className={`px-4 py-2.5 text-left font-mono text-[10px] tracking-[0.09em] uppercase text-muted first:pl-5 last:pr-5 whitespace-nowrap${extra}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginated.map((emp, i) => (
              <tr key={emp.employeeId} className={`border-b border-[#EEF1F4] ${i % 2 === 1 ? 'bg-[#F6F8FA]' : ''}`}>
                <td className="px-4 py-2.5 first:pl-5 font-mono text-[12px] hidden md:table-cell">{emp.employeeId}</td>
                <td className="px-4 py-2.5 font-medium text-[13px] whitespace-nowrap">
                  {emp.lastName}, {emp.firstName}{emp.middleName ? ` ${emp.middleName.charAt(0)}.` : ''}
                </td>
                <td className="px-4 py-2.5 text-[12px] text-muted">{emp.department ?? '—'}</td>
                <td className="px-4 py-2.5 text-[12px] text-muted hidden md:table-cell">{emp.immediateSupervisor ?? '—'}</td>
                <td className="px-4 py-2.5 text-[12px] text-muted hidden md:table-cell">{emp.approver2 ?? '—'}</td>
                <td className="px-4 py-2.5 last:pr-5 font-mono text-[12px] text-muted hidden md:table-cell">{emp.hireDate ?? '—'}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="text-center py-12 text-muted text-[13px]">
                {employees.length === 0
                  ? 'No employees yet. Upload the employee roster to get started.'
                  : 'No employees match these filters.'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {pageCount > 1 && (
        <div className="px-5 py-2 border-t border-border flex items-center justify-between flex-shrink-0">
          <span className="text-[11.5px] text-muted">
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
          </span>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}
              className="px-2.5 py-1 rounded-[5px] border border-border text-[11.5px] text-muted hover:text-app-text disabled:opacity-40 disabled:cursor-not-allowed">
              ← Prev
            </button>
            <span className="text-[11.5px] text-muted">{page + 1} / {pageCount}</span>
            <button onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} disabled={page >= pageCount - 1}
              className="px-2.5 py-1 rounded-[5px] border border-border text-[11.5px] text-muted hover:text-app-text disabled:opacity-40 disabled:cursor-not-allowed">
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
