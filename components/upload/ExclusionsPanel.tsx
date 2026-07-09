'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { EyeOff, Search, X, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmployeeOption {
  employeeId: string;
  name: string;
  department: string | null;
}
interface ExcludedDepartment {
  id: number;
  name: string;
}

interface Props {
  employeeOptions: EmployeeOption[];
  excludedEmployees: EmployeeOption[];
  excludedDepartments: ExcludedDepartment[];
  departmentOptions: string[];
}

export function ExclusionsPanel({
  employeeOptions,
  excludedEmployees,
  excludedDepartments,
  departmentOptions,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Employee search picker
  const [query, setQuery] = useState('');
  const [showList, setShowList] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const excludedIds = useMemo(
    () => new Set(excludedEmployees.map((e) => e.employeeId)),
    [excludedEmployees],
  );
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return employeeOptions
      .filter((e) => !excludedIds.has(e.employeeId))
      .filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.employeeId.toLowerCase().includes(q) ||
          (e.department ?? '').toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [query, employeeOptions, excludedIds]);

  const [deptInput, setDeptInput] = useState('');

  async function call(url: string, method: 'POST' | 'DELETE', body?: unknown) {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(url, {
        method,
        ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setErr(data.error || 'Something went wrong.');
        return;
      }
      router.refresh();
    } catch {
      setErr('Network error — please try again.');
    } finally {
      setBusy(false);
    }
  }

  const addEmployee = async (employeeId: string) => {
    setQuery('');
    setShowList(false);
    await call('/api/exclusions/employees', 'POST', { employeeId });
  };
  const removeEmployee = (employeeId: string) =>
    call(`/api/exclusions/employees?employeeId=${encodeURIComponent(employeeId)}`, 'DELETE');
  const addDepartment = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setDeptInput('');
    await call('/api/exclusions/departments', 'POST', { name: trimmed });
  };
  const removeDepartment = (id: number) => call(`/api/exclusions/departments?id=${id}`, 'DELETE');

  const empCount = excludedEmployees.length;
  const deptCount = excludedDepartments.length;

  return (
    <section className="bg-white rounded-[7px] border border-border overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <EyeOff className="w-[15px] h-[15px] text-muted" aria-hidden="true" />
          <h2 className="text-[14px] font-semibold text-app-text tracking-tight">Exclusions</h2>
          {(empCount > 0 || deptCount > 0) && (
            <span className="text-[11px] text-muted ml-auto tabular-nums">
              {empCount} {empCount === 1 ? 'employee' : 'employees'} · {deptCount}{' '}
              {deptCount === 1 ? 'department' : 'departments'}
            </span>
          )}
        </div>
        <p className="text-[11.5px] text-muted mt-1.5 leading-relaxed">
          Excluded employees and departments are hidden from the Tardiness Tracker, Attendance
          Score, and NTE views for everyone. Their data is kept — clear an exclusion any time to
          bring them back.
        </p>
      </div>

      {err && (
        <p className="mx-6 mt-4 text-[12px] text-nte-red border border-nte-red/40 bg-nte-red/5 rounded-[5px] px-3 py-2">
          {err}
        </p>
      )}

      <div className="p-6 space-y-6">
        {/* ── Employees ─────────────────────────────────────────── */}
        <div>
          <div className="flex items-baseline justify-between gap-3 mb-2">
            <p className="text-[11px] font-semibold text-muted uppercase tracking-[0.06em]">
              Excluded employees
            </p>
          </div>

          {/* Search-to-add */}
          <div className="relative mb-3">
            <Search
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none w-[13px] h-[13px]"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              disabled={busy}
              role="combobox"
              aria-expanded={showList && matches.length > 0}
              aria-controls="excl-emp-listbox"
              aria-autocomplete="list"
              onChange={(e) => {
                setQuery(e.target.value);
                setShowList(true);
                setActiveIndex(-1);
              }}
              onFocus={() => setShowList(true)}
              onBlur={() => setTimeout(() => setShowList(false), 150)}
              onKeyDown={(e) => {
                if (!showList || matches.length === 0) return;
                if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex((i) => Math.min(i + 1, matches.length - 1)); }
                else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex((i) => Math.max(i - 1, 0)); }
                else if (e.key === 'Enter' && activeIndex >= 0) { e.preventDefault(); addEmployee(matches[activeIndex].employeeId); }
                else if (e.key === 'Escape') { setShowList(false); }
              }}
              placeholder="Search an employee by name or ID to exclude…"
              className="w-full pl-8 pr-3 py-2 text-[12.5px] bg-ground border border-border rounded-[5px] focus:outline-none focus:ring-2 focus:ring-app-blue/40 placeholder:text-muted"
            />
            {showList && matches.length > 0 && (
              <ul id="excl-emp-listbox" role="listbox" className="absolute z-20 mt-1 w-full max-h-64 overflow-auto bg-white border border-border rounded-[6px] shadow-lg">
                {matches.map((e, i) => (
                  <li key={e.employeeId} role="option" aria-selected={i === activeIndex}>
                    <button
                      type="button"
                      onMouseDown={(ev) => ev.preventDefault()}
                      onClick={() => addEmployee(e.employeeId)}
                      className={`w-full text-left px-3 py-2 text-[12.5px] flex items-center justify-between gap-3 ${i === activeIndex ? 'bg-ground' : 'hover:bg-ground'}`}
                    >
                      <span className="font-medium text-app-text">{e.name}</span>
                      <span className="text-[11px] text-muted font-mono">
                        {e.employeeId}
                        {e.department ? ` · ${e.department}` : ''}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Table */}
          <div className="border border-border rounded-[6px] overflow-hidden">
            <div className="overflow-auto max-h-[360px]">
              <table className="w-full border-collapse">
                <thead className="sticky top-0 z-10 bg-ground">
                  <tr className="border-b border-border">
                    <th className="px-4 py-2.5 text-left font-mono text-[10px] tracking-[0.09em] uppercase text-muted first:pl-4">
                      Name
                    </th>
                    <th className="px-4 py-2.5 text-left font-mono text-[10px] tracking-[0.09em] uppercase text-muted hidden sm:table-cell">
                      Employee ID
                    </th>
                    <th className="px-4 py-2.5 text-left font-mono text-[10px] tracking-[0.09em] uppercase text-muted">
                      Department
                    </th>
                    <th className="px-4 py-2.5 text-right font-mono text-[10px] tracking-[0.09em] uppercase text-muted last:pr-4">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {excludedEmployees.map((e, i) => (
                    <tr
                      key={e.employeeId}
                      className={`border-b border-row-border last:border-0 ${i % 2 === 1 ? 'bg-row-alt' : ''}`}
                    >
                      <td className="px-4 py-2.5 font-medium text-[13px] text-app-text whitespace-nowrap">
                        {e.name}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[12px] text-muted hidden sm:table-cell">
                        {e.employeeId}
                      </td>
                      <td className="px-4 py-2.5 text-[12px] text-muted">{e.department ?? '—'}</td>
                      <td className="px-4 py-2.5 text-right last:pr-4">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => removeEmployee(e.employeeId)}
                          className="inline-flex items-center gap-1 text-[11.5px] text-muted hover:text-nte-red border border-border hover:border-nte-red/40 rounded-[5px] px-2 py-1 transition-colors disabled:opacity-50"
                        >
                          <X className="w-3 h-3" aria-hidden="true" />
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                  {excludedEmployees.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center py-10 text-muted text-[12.5px]">
                        No employees excluded yet — search above to add one.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ── Departments ───────────────────────────────────────── */}
        <div>
          <p className="text-[11px] font-semibold text-muted uppercase tracking-[0.06em] mb-2">
            Excluded departments
          </p>
          <div className="flex items-center gap-2 mb-3">
            <input
              list="dept-options"
              value={deptInput}
              disabled={busy}
              onChange={(e) => setDeptInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addDepartment(deptInput);
                }
              }}
              placeholder="Department name…"
              className="flex-1 min-w-[180px] px-3 py-2 text-[12.5px] bg-ground border border-border rounded-[5px] focus:outline-none focus:ring-2 focus:ring-app-blue/40 placeholder:text-muted"
            />
            <datalist id="dept-options">
              {departmentOptions.map((d) => (
                <option key={d} value={d} />
              ))}
            </datalist>
            <Button
              type="button"
              disabled={busy || !deptInput.trim()}
              onClick={() => addDepartment(deptInput)}
              className="bg-navy hover:bg-navy/90 text-white px-3 py-2 h-auto text-[12.5px] gap-1"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              Add
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {excludedDepartments.length === 0 && (
              <span className="text-[11.5px] text-muted">No departments excluded.</span>
            )}
            {excludedDepartments.map((d) => (
              <span
                key={d.id}
                className="inline-flex items-center gap-1.5 bg-ground border border-border rounded-[5px] pl-2.5 pr-1.5 py-1 text-[12px] text-app-text"
              >
                {d.name}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => removeDepartment(d.id)}
                  aria-label={`Remove ${d.name}`}
                  className="text-muted hover:text-nte-red rounded-[4px] w-4 h-4 flex items-center justify-center leading-none disabled:opacity-50"
                >
                  <X className="w-3 h-3" aria-hidden="true" />
                </button>
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
