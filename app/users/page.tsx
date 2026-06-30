import { requireRole } from '@/lib/auth/session';
import { getAppUsers } from '@/lib/queries/users';
import { getEmployeeOptions } from '@/lib/queries/employees';
import { UsersManager } from '@/components/users/UsersManager';

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const me = await requireRole('admin'); // managers redirected home
  const [users, employees] = await Promise.all([getAppUsers(), getEmployeeOptions()]);

  // Department is derived live from the roster via the stored Employee ID.
  const deptByEmpId = new Map(employees.map((e) => [e.employeeId, e.department]));

  const data = users.map((u) => ({
    email: u.email,
    role: (u.role === 'admin' ? 'admin' : 'manager') as 'admin' | 'manager',
    displayName: u.displayName,
    employeeId: u.employeeId,
    department: u.employeeId ? deptByEmpId.get(u.employeeId) ?? null : null,
    active: u.active,
  }));

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white border-b border-border flex-shrink-0 px-6 py-4">
        <h1 className="text-[15px] font-semibold text-app-text tracking-tight">Users &amp; Access</h1>
        <p className="text-[11.5px] text-muted mt-0.5">
          Only emails listed here can sign in. Admins can upload &amp; manage users; managers can view &amp; issue NTEs.
        </p>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-6">
        <UsersManager users={data} currentEmail={me.email} employees={employees} />
      </div>
    </div>
  );
}
