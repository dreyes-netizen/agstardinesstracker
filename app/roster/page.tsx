import { RosterTable } from '@/components/roster/RosterTable';
import { getAllEmployees } from '@/lib/queries/employees';

export default async function RosterPage() {
  const employees = await getAllEmployees();
  return (
    <div className="p-6">
      <div className="mb-6">
        <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-muted mb-1">Employees</p>
        <h1 className="text-2xl font-semibold text-app-text tracking-tight">Roster</h1>
        <p className="text-[14px] text-muted mt-1.5">All employees imported from the Sprout roster. Update by uploading a new roster file.</p>
      </div>
      <RosterTable employees={employees} />
    </div>
  );
}
