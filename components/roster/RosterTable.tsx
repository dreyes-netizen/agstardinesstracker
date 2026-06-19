import { Employee } from '@/lib/db/schema';

export function RosterTable({ employees }: { employees: Employee[] }) {
  return (
    <div className="bg-white border border-border rounded-[7px] overflow-hidden">
      <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
        <span className="text-[13.5px] font-semibold text-app-text">All Employees</span>
        <span className="text-[11.5px] text-muted">{employees.length} employees</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-ground border-b border-border">
              {['Employee ID', 'Name', 'Department', 'Immediate Supervisor', 'Manager (Approver 2)', 'Hire Date'].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left font-mono text-[10px] tracking-[0.09em] uppercase text-muted first:pl-5 last:pr-5 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {employees.map((emp, i) => (
              <tr key={emp.employeeId} className={`border-b border-[#EEF1F4] ${i % 2 === 1 ? 'bg-[#F6F8FA]' : ''}`}>
                <td className="px-4 py-2.5 first:pl-5 font-mono text-[12px]">{emp.employeeId}</td>
                <td className="px-4 py-2.5 font-medium text-[13px]">
                  {emp.lastName}, {emp.firstName}{emp.middleName ? ` ${emp.middleName.charAt(0)}.` : ''}
                </td>
                <td className="px-4 py-2.5 text-[12px] text-muted">{emp.department ?? '—'}</td>
                <td className="px-4 py-2.5 text-[12px] text-muted">{emp.immediateSupervisor ?? '—'}</td>
                <td className="px-4 py-2.5 text-[12px] text-muted">{emp.approver2 ?? '—'}</td>
                <td className="px-4 py-2.5 last:pr-5 font-mono text-[12px] text-muted">{emp.hireDate ?? '—'}</td>
              </tr>
            ))}
            {employees.length === 0 && (
              <tr><td colSpan={6} className="text-center py-12 text-muted text-[13px]">No employees yet. Upload the employee roster to get started.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
