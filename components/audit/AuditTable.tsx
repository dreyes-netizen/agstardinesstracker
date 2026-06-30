'use client';

import { useState, useMemo } from 'react';
import {
  useReactTable, getCoreRowModel, getSortedRowModel,
  flexRender, createColumnHelper, SortingState,
} from '@tanstack/react-table';

export interface AuditEntry {
  id: number;
  createdAt: string;
  action: string;
  actorEmail: string;
  actorRole: string;
  employeeId: string;
  name: string;
  month: string;
  details: string;
}

function fmtWhen(iso: string): string {
  const d = new Date(iso.includes('T') || iso.includes(' ') ? iso : iso + 'T00:00:00');
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString('en-US', { month: 'short', day: '2-digit', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}
function fmtMonth(m: string): string {
  const d = new Date(`${m}-01T00:00:00`);
  return Number.isNaN(d.getTime()) ? m : d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}
function actionClass(a: string): string {
  if (a === 'issued') return 'bg-app-blue/10 text-app-blue';
  if (a === 'acknowledged') return 'bg-safe-green/10 text-safe-green';
  return 'bg-muted/10 text-muted';
}

const col = createColumnHelper<AuditEntry>();
const columns = [
  col.accessor('createdAt', {
    header: 'When',
    cell: (info) => <span className="text-[12px] text-muted whitespace-nowrap">{fmtWhen(info.getValue())}</span>,
  }),
  col.accessor('actorEmail', {
    header: 'Actor',
    cell: (info) => (
      <span className="text-[12.5px]">
        {info.getValue()}
        {info.row.original.actorRole && (
          <span className="ml-1.5 text-[10px] uppercase tracking-[0.06em] text-muted">{info.row.original.actorRole}</span>
        )}
      </span>
    ),
  }),
  col.accessor('action', {
    header: 'Action',
    cell: (info) => (
      <span className={`inline-block text-[11px] font-medium px-1.5 py-0.5 rounded-[3px] capitalize ${actionClass(info.getValue())}`}>
        {info.getValue()}
      </span>
    ),
  }),
  col.accessor('name', {
    header: 'Employee',
    cell: (info) => (
      <span className="text-[12.5px]">
        {info.getValue()} <span className="font-mono text-[11px] text-muted">{info.row.original.employeeId}</span>
      </span>
    ),
  }),
  col.accessor('month', {
    header: 'Period',
    cell: (info) => <span className="text-[12px] text-muted">{fmtMonth(info.getValue())}</span>,
  }),
  col.accessor('details', {
    header: 'Notes',
    cell: (info) => <span className="text-[12px] text-muted">{info.getValue() || '—'}</span>,
  }),
];

function escCsv(v: string | number | null | undefined): string {
  const s = v == null ? '' : String(v);
  return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
}

export function AuditTable({ data }: { data: AuditEntry[] }) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  const filtered = useMemo(() => {
    let result = data;
    if (actionFilter) result = result.filter((e) => e.action === actionFilter);
    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter((e) =>
        e.actorEmail.toLowerCase().includes(q) ||
        e.name.toLowerCase().includes(q) ||
        e.employeeId.toLowerCase().includes(q));
    }
    return result;
  }, [data, search, actionFilter]);

  function exportCsv() {
    const rows: string[][] = [
      ['When', 'Actor', 'Role', 'Action', 'Employee', 'Employee ID', 'Period', 'Notes'],
      ...filtered.map((e) => [
        fmtWhen(e.createdAt), e.actorEmail, e.actorRole, e.action, e.name, e.employeeId, e.month, e.details,
      ]),
    ];
    const csv = rows.map((r) => r.map(escCsv).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'nte-audit-log.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  const table = useReactTable({
    data: filtered, columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="bg-white border border-border rounded-[7px] overflow-clip flex flex-col flex-1 min-h-0">
      <div className="px-5 py-3 border-b border-border flex items-center gap-3 flex-shrink-0">
        <span className="text-[13.5px] font-semibold text-app-text flex-shrink-0">Activity</span>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search actor or employee…"
          className="flex-1 px-3 py-1.5 text-[12.5px] bg-ground border border-border rounded-[5px] focus:outline-none focus:ring-2 focus:ring-app-blue/40 placeholder:text-muted"
        />
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="flex-shrink-0 bg-ground border border-border rounded-[5px] px-2.5 py-1.5 text-[12.5px] text-app-text focus:outline-none"
        >
          <option value="">All actions</option>
          <option value="issued">Issued</option>
          <option value="acknowledged">Acknowledged</option>
        </select>
        <span className="text-[11.5px] text-muted flex-shrink-0">{filtered.length} entries</span>
        <button
          onClick={exportCsv}
          disabled={filtered.length === 0}
          className="flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[5px] border border-border text-[11.5px] text-muted hover:text-app-text hover:border-app-text/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
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
                    className="px-3.5 py-2.5 text-left font-mono text-[10px] tracking-[0.09em] uppercase text-muted cursor-pointer hover:text-app-text select-none first:pl-5 last:pr-5"
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
              <tr key={row.id} className={`border-b border-row-border ${i % 2 === 1 ? 'bg-row-alt' : ''} hover:bg-row-hover`}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-3.5 py-[10px] text-[13px] first:pl-5 last:pr-5">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
