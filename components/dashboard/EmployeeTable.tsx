'use client';

import { useState } from 'react';
import {
  useReactTable, getCoreRowModel, getSortedRowModel,
  flexRender, createColumnHelper, SortingState,
} from '@tanstack/react-table';
import { EmployeeMonthlyStats } from '@/lib/queries/attendance';
import { StatusBadge } from './StatusBadge';
import { EmployeeDrawer } from './EmployeeDrawer';

const col = createColumnHelper<EmployeeMonthlyStats>();

const columns = [
  col.accessor('employeeId', {
    header: 'Employee ID',
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
    cell: (info) => <span className="text-muted text-[12px]">{info.getValue() ?? '—'}</span>,
  }),
  col.accessor('immediateSupervisor', {
    header: 'Supervisor',
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
}

export function EmployeeTable({ data, year, month }: EmployeeTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [selected, setSelected] = useState<EmployeeMonthlyStats | null>(null);

  const table = useReactTable({
    data, columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <>
      <div className="bg-white border border-border rounded-[7px] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
          <span className="text-[13.5px] font-semibold text-app-text">Employees</span>
          <span className="text-[11.5px] text-muted">{data.length} employees</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id} className="bg-ground border-b border-border">
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
                <tr
                  key={row.id}
                  onClick={() => setSelected(row.original)}
                  className={`border-b border-[#EEF1F4] cursor-pointer transition-colors ${i % 2 === 1 ? 'bg-[#F6F8FA]' : ''} ${selected?.employeeId === row.original.employeeId ? 'bg-[#E4ECFA]' : 'hover:bg-[#EBF0FA]'}`}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-3.5 py-[11px] text-[13px] first:pl-5 last:pr-5">
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
