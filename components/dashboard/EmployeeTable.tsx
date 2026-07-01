'use client';

import { useState, useMemo } from 'react';
import {
  useReactTable, getCoreRowModel, getSortedRowModel, getPaginationRowModel,
  flexRender, createColumnHelper, SortingState, PaginationState,
} from '@tanstack/react-table';
import { EmployeeMonthlyStats } from '@/lib/queries/attendance';
import { StatusBadge } from './StatusBadge';
import { EmployeeDrawer } from './EmployeeDrawer';

const col = createColumnHelper<EmployeeMonthlyStats>();

const hide = { hideMobile: true };

const columns = [
  col.accessor('employeeId', {
    header: 'Employee ID',
    meta: hide,
    cell: (info) => <span className="font-mono text-[12px]">{info.getValue()}</span>,
  }),
  col.display({
    id: 'name',
    header: 'Name',
    cell: ({ row }) => (
      <span className="font-medium">
        {row.original.lastName}, {row.original.firstName}
        {row.original.middleName ? ` ${row.original.middleName.charAt(0)}.` : ''}
      </span>
    ),
  }),
  col.accessor('department', {
    header: 'Department',
    meta: hide,
    cell: (info) => <span className="text-muted text-[12px]">{info.getValue() ?? '—'}</span>,
  }),
  col.accessor('immediateSupervisor', {
    header: 'Supervisor',
    meta: hide,
    cell: (info) => <span className="text-muted text-[12px]">{info.getValue() ?? '—'}</span>,
  }),
  col.accessor('lateCount', {
    header: () => <span className="block text-right">Late Count</span>,
    cell: (info) => (
      <span className="font-mono text-[13px] block text-right">
        {info.getValue()} <span className="text-[10px] text-muted">×</span>
      </span>
    ),
  }),
  col.accessor('accumulatedMinutes', {
    header: () => <span className="block text-right">Accum. Min</span>,
    meta: hide,
    cell: (info) => (
      <span className="font-mono text-[13px] block text-right">
        {info.getValue()} <span className="text-[10px] text-muted">min</span>
      </span>
    ),
  }),
  col.accessor('nteStatus', {
    header: 'Status',
    cell: (info) => <StatusBadge status={info.getValue()} />,
  }),
];

interface EmployeeTableProps {
  data: EmployeeMonthlyStats[];
  year: number;
  month: number;
  dept?: string;
  supervisor?: string;
  manager?: string;
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function escCsv(v: string | number | null | undefined): string {
  const s = v == null ? '' : String(v);
  return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
}

export function EmployeeTable({ data, year, month, dept, supervisor, manager }: EmployeeTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 50 });
  const [selected, setSelected] = useState<EmployeeMonthlyStats | null>(null);
  const [search, setSearch] = useState('');
  const [hideZero, setHideZero] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  const filtered = useMemo(() => {
    let result = data;
    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter((e) => {
        const fullName = `${e.lastName} ${e.firstName} ${e.middleName ?? ''}`.toLowerCase();
        const altName = `${e.firstName} ${e.lastName}`.toLowerCase();
        return fullName.includes(q) || altName.includes(q) || e.employeeId.toLowerCase().includes(q);
      });
    }
    if (hideZero) result = result.filter((e) => e.lateCount > 0);
    if (statusFilter) result = result.filter((e) => e.nteStatus === statusFilter);
    return result;
  }, [data, search, hideZero, statusFilter]);

  function exportCsv() {
    const periodLabel = `${MONTHS[month - 1]} ${year}`;
    const rows: string[][] = [
      ['Period', periodLabel],
      ['Department', dept || 'All'],
      ['Supervisor', supervisor || 'All'],
      ['Manager', manager || 'All'],
      ['Records exported', String(filtered.length)],
      [],
      ['Employee ID', 'Last Name', 'First Name', 'Middle Name', 'Department', 'Supervisor', 'Manager', 'Late Count', 'Accumulated Minutes (min)', 'NTE Status'],
      ...filtered.map((e) => [
        e.employeeId,
        e.lastName,
        e.firstName,
        e.middleName ?? '',
        e.department ?? '',
        e.immediateSupervisor ?? '',
        e.approver2 ?? '',
        String(e.lateCount),
        String(e.accumulatedMinutes),
        e.nteStatus,
      ]),
    ];
    const csv = rows.map((r) => r.map(escCsv).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tardiness-${MONTHS[month - 1].toLowerCase()}-${year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const table = useReactTable({
    data: filtered, columns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    autoResetPageIndex: true,
  });

  return (
    <>
      <div className="bg-white border border-border rounded-[7px] overflow-clip flex flex-col flex-1 min-h-0">
        <div className="px-5 py-3 border-b border-border flex items-center gap-3 flex-shrink-0">
          <span className="text-[13.5px] font-semibold text-app-text flex-shrink-0">Employees</span>
          <span className="text-[11px] text-muted flex-shrink-0 hidden lg:inline">Click a row to view details</span>
          <div className="flex-1 relative">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or ID…"
              className="w-full pl-8 pr-3 py-1.5 text-[12.5px] bg-ground border border-border rounded-[5px] focus:outline-none focus:ring-2 focus:ring-app-blue/40 placeholder:text-muted"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="flex-shrink-0 bg-ground border border-border rounded-[5px] px-2.5 py-1.5 text-[12.5px] text-app-text focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="required">NTE Required</option>
            <option value="warning">Approaching</option>
            <option value="issued">Issued</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="safe">On Track</option>
          </select>
          <button
            onClick={() => setHideZero((v) => !v)}
            className={`flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[5px] border text-[11.5px] transition-colors ${
              hideZero
                ? 'bg-app-blue/10 border-app-blue/30 text-app-blue font-medium'
                : 'border-border text-muted hover:text-app-text'
            }`}
          >
            {hideZero && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
            Hide zero
          </button>
          <span className="text-[11.5px] text-muted flex-shrink-0">
            {filtered.length}{(search || hideZero) ? ` of ${data.length}` : ''} employees
          </span>
          <button
            onClick={exportCsv}
            disabled={filtered.length === 0}
            className="flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[5px] border border-border text-[11.5px] text-muted hover:text-app-text hover:border-app-text/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export CSV
          </button>
        </div>
        <div className="overflow-auto flex-1 min-h-0">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-10 bg-ground">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id} className="border-b border-border">
                  {hg.headers.map((header) => (
                    <th
                      key={header.id}
                      onClick={header.column.getToggleSortingHandler()}
                      className={`px-3.5 py-2.5 text-left font-mono text-[10px] tracking-[0.09em] uppercase text-muted cursor-pointer hover:text-app-text select-none first:pl-5 last:pr-5${(header.column.columnDef as any).meta?.hideMobile ? ' hidden md:table-cell' : ''}`}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {{ asc: ' ↑', desc: ' ↓' }[header.column.getIsSorted() as string] ?? ''}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row, i) => (
                <tr
                  key={row.id}
                  tabIndex={0}
                  onClick={() => setSelected(row.original)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(row.original); } }}
                  aria-selected={selected?.employeeId === row.original.employeeId}
                  className={`border-b border-row-border cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-blue focus-visible:ring-inset ${i % 2 === 1 ? 'bg-row-alt' : ''} ${selected?.employeeId === row.original.employeeId ? 'bg-row-active' : 'hover:bg-row-hover'}`}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className={`px-3.5 py-[11px] text-[13px] first:pl-5 last:pr-5${(cell.column.columnDef as any).meta?.hideMobile ? ' hidden md:table-cell' : ''}`}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
              {data.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-muted text-[13px]">
                    No employees found. Upload an attendance report to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {table.getPageCount() > 1 && (
          <div className="px-5 py-2 border-t border-border flex items-center justify-between flex-shrink-0">
            <span className="text-[11.5px] text-muted">
              {pagination.pageIndex * pagination.pageSize + 1}–{Math.min((pagination.pageIndex + 1) * pagination.pageSize, filtered.length)} of {filtered.length}
            </span>
            <div className="flex items-center gap-2">
              <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}
                className="px-2.5 py-1 rounded-[5px] border border-border text-[11.5px] text-muted hover:text-app-text disabled:opacity-40 disabled:cursor-not-allowed">
                ← Prev
              </button>
              <span className="text-[11.5px] text-muted">{pagination.pageIndex + 1} / {table.getPageCount()}</span>
              <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}
                className="px-2.5 py-1 rounded-[5px] border border-border text-[11.5px] text-muted hover:text-app-text disabled:opacity-40 disabled:cursor-not-allowed">
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      <EmployeeDrawer
        employee={selected}
        year={year}
        month={month}
        onClose={() => setSelected(null)}
        onNteAction={() => setSelected(null)}
      />
    </>
  );
}
