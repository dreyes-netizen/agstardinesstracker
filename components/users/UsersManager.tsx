'use client';

import { useState, useMemo, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { addUserAction, setRoleAction, setActiveAction, removeUserAction, setNameAction } from '@/app/users/actions';

interface Row {
  email: string;
  role: 'admin' | 'manager';
  displayName: string | null;
  employeeId: string | null;
  department: string | null;
  active: boolean;
}

interface EmployeeOption {
  employeeId: string;
  name: string;
  department: string | null;
}

const SELECT = 'bg-ground border border-border rounded-[5px] px-2 py-1 text-[12.5px] text-app-text focus:outline-none h-8';
const FIELD = 'block text-[13px] text-app-text bg-ground border border-border rounded-[5px] px-2.5 h-9 focus:outline-none focus:ring-2 focus:ring-app-blue/40 placeholder:text-muted';
const HEAD = 'px-4 py-2.5 text-left font-mono text-[10px] tracking-[0.09em] uppercase text-muted whitespace-nowrap';

export function UsersManager({
  users, currentEmail, employees,
}: { users: Row[]; currentEmail: string; employees: EmployeeOption[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [empId, setEmpId] = useState('');
  const [manualName, setManualName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'manager'>('manager');
  const [error, setError] = useState<string | null>(null);

  const matched = useMemo(() => employees.find((e) => e.employeeId === empId.trim()), [employees, empId]);
  const resolvedName = matched ? matched.name : manualName;

  const admins = users.filter((u) => u.role === 'admin');
  const managers = users.filter((u) => u.role === 'manager');

  function run(fn: () => Promise<{ ok: true } | { error: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if ('error' in res) setError(res.error);
      else router.refresh();
    });
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const idValue = empId;
    const nameValue = resolvedName;
    const emailValue = email;
    run(async () => {
      const res = await addUserAction(emailValue, role, idValue, nameValue);
      if ('ok' in res) { setEmpId(''); setManualName(''); setEmail(''); }
      return res;
    });
  }

  function renderRow(u: Row, i: number) {
    return (
      <tr key={u.email} className={`border-b border-row-border ${i % 2 === 1 ? 'bg-row-alt' : ''}`}>
        <td className="px-4 py-2.5 font-mono text-[12px] text-muted whitespace-nowrap">{u.employeeId ?? '—'}</td>
        <td className="px-4 py-2.5">
          <input
            type="text"
            aria-label={`Edit name for ${u.email}`}
            defaultValue={u.displayName ?? ''}
            disabled={pending}
            placeholder="—"
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v !== (u.displayName ?? '')) run(() => setNameAction(u.email, v));
            }}
            className="w-40 text-[13px] text-app-text bg-transparent border border-transparent hover:border-border focus:border-app-blue/40 rounded-[4px] px-1.5 py-1 focus:outline-none placeholder:text-muted"
          />
        </td>
        <td className="px-4 py-2.5 text-[12.5px] text-muted whitespace-nowrap">{u.department ?? '—'}</td>
        <td className="px-4 py-2.5 text-[13px] whitespace-nowrap">
          {u.email}
          {u.email === currentEmail && <span className="ml-2 text-[10px] uppercase tracking-[0.06em] text-muted">you</span>}
        </td>
        <td className="px-4 py-2.5">
          <select
            value={u.role}
            disabled={pending}
            onChange={(e) => run(() => setRoleAction(u.email, e.target.value))}
            className={SELECT}
          >
            <option value="manager">Manager</option>
            <option value="admin">Admin</option>
          </select>
        </td>
        <td className="px-4 py-2.5">
          <button
            onClick={() => run(() => setActiveAction(u.email, !u.active))}
            disabled={pending}
            className={`inline-flex items-center gap-1.5 text-[11.5px] px-2 py-1 rounded-[5px] border transition-colors whitespace-nowrap ${
              u.active ? 'border-safe-green/30 text-safe-green bg-safe-green/5' : 'border-border text-muted'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${u.active ? 'bg-safe-green' : 'bg-muted/50'}`} />
            {u.active ? 'Active' : 'Disabled'}
          </button>
        </td>
        <td className="px-4 py-2.5 text-right">
          <button
            onClick={() => run(() => removeUserAction(u.email))}
            disabled={pending}
            className="text-[11.5px] text-muted hover:text-nte-red transition-colors disabled:opacity-40"
          >
            Remove
          </button>
        </td>
      </tr>
    );
  }

  function group(title: string, rows: Row[], emptyText: string) {
    return (
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
          {title} <span className="text-app-text">· {rows.length}</span>
        </p>
        <div className="bg-white border border-border rounded-[7px] overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="bg-ground">
              <tr className="border-b border-border">
                {['Emp ID', 'Name', 'Department', 'Email', 'Role', 'Status', ''].map((h, i) => (
                  <th key={i} className={HEAD}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(renderRow)}
              {rows.length === 0 && (
                <tr><td colSpan={7} className="text-center py-8 text-muted text-[13px]">{emptyText}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-5">
      {/* Add user — type an Employee ID to auto-fill the name from the roster */}
      <form onSubmit={handleAdd} className="bg-white border border-border rounded-[7px] p-4 flex items-end gap-3 flex-wrap">
        <div className="space-y-1">
          <label className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">Employee ID</label>
          <input
            type="text" list="employee-options" value={empId}
            onChange={(e) => setEmpId(e.target.value)}
            placeholder="e.g. 24251"
            className={`${FIELD} w-32`}
          />
          <datalist id="employee-options">
            {employees.map((e) => <option key={e.employeeId} value={e.employeeId}>{e.name}</option>)}
          </datalist>
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">Name</label>
          {matched ? (
            <div className={`${FIELD} w-44 bg-safe-green/5 border-safe-green/30 flex items-center`}>{matched.name}</div>
          ) : (
            <input
              type="text" value={manualName}
              onChange={(e) => setManualName(e.target.value)}
              placeholder="Auto-fills from ID"
              className={`${FIELD} w-44`}
            />
          )}
        </div>

        <div className="flex-1 min-w-[180px] space-y-1">
          <label className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">Email</label>
          <input
            type="email" value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@allianceglobalsolutions.com"
            required
            className={`${FIELD} w-full`}
          />
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">Role</label>
          <select value={role} onChange={(e) => setRole(e.target.value as 'admin' | 'manager')} className={`${SELECT} h-9`}>
            <option value="manager">Manager</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        <Button type="submit" disabled={pending} className="bg-navy hover:bg-navy/90 text-white h-9">
          {pending ? 'Saving…' : 'Add user'}
        </Button>
      </form>

      {error && (
        <p className="text-[12.5px] text-nte-red bg-nte-red/10 rounded-[5px] px-3 py-2">{error}</p>
      )}

      {group('Admins', admins, 'No admins yet.')}
      {group('Managers', managers, 'No managers yet.')}
    </div>
  );
}
