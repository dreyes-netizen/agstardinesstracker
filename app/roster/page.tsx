import { RosterTable } from '@/components/roster/RosterTable';
import { getAllEmployees, getLastRosterUpdate } from '@/lib/queries/employees';

export const dynamic = 'force-dynamic';

export default async function RosterPage() {
  const [employees, lastUpdated] = await Promise.all([
    getAllEmployees(),
    getLastRosterUpdate(),
  ]);

  const lastUpdatedLabel = lastUpdated
    ? new Date(lastUpdated).toLocaleDateString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila',
      })
    : null;

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white border-b border-border flex-shrink-0 px-6 py-4">
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="text-[15px] font-semibold text-app-text tracking-tight">Roster</h1>
          {lastUpdatedLabel && (
            <span className="text-[11.5px] text-muted flex-shrink-0">
              Last updated <span className="font-medium text-app-text">{lastUpdatedLabel}</span>
            </span>
          )}
        </div>
        <p className="text-[12px] text-muted mt-0.5">All employees imported from the Sprout roster. Update by uploading a new roster file.</p>
      </div>
      <div className="flex-1 min-h-0 flex flex-col p-6">
        <RosterTable employees={employees} />
      </div>
    </div>
  );
}
