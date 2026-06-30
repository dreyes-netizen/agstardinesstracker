import { UploadForm } from '@/components/upload/UploadForm';
import { ApiDocs } from '@/components/upload/ApiDocs';
import { getRosterStatus } from '@/lib/queries/employees';
import { getLeaveStatus } from '@/lib/queries/leave';
import { getAttendanceCoverage } from '@/lib/queries/attendance';
import { formatDate } from '@/lib/utils/date';
import { requireRole } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

function fmtRange(start: string | null, end: string | null): string {
  if (!start || !end) return '—';
  return `${formatDate(start)} – ${formatDate(end)}`;
}

export default async function UploadPage() {
  await requireRole('admin'); // managers are redirected home
  const [roster, attendance, leave] = await Promise.all([
    getRosterStatus(),
    getAttendanceCoverage(),
    getLeaveStatus(),
  ]);

  const cards = [
    {
      label: 'Employee Roster',
      primary: roster.count > 0 ? `${roster.count.toLocaleString()} employees` : 'No roster yet',
      secondary: roster.count > 0 ? `Updated ${formatDate(roster.lastUpdated)}` : 'Upload the Employee List Report',
      filled: roster.count > 0,
    },
    {
      label: 'Attendance',
      primary: attendance.count > 0 ? fmtRange(attendance.start, attendance.end) : 'No attendance yet',
      secondary: attendance.count > 0
        ? `${attendance.count.toLocaleString()} daily records`
        : 'Upload an Attendance Report',
      filled: attendance.count > 0,
    },
    {
      label: 'Leave',
      primary: leave.count > 0 ? fmtRange(leave.start, leave.end) : 'No leave yet',
      secondary: leave.count > 0 ? `${leave.count.toLocaleString()} transactions` : 'Upload a Leave Report',
      filled: leave.count > 0,
    },
  ];

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-app-text tracking-tight">
          Import reports
        </h1>
        <p className="text-[14px] text-muted mt-1.5">
          Upload your Sprout exports to update attendance records and the employee roster.
        </p>
      </div>

      {/* Current data status — what's already loaded, and through what date */}
      <div className="mb-4">
        <p className="text-[11px] font-semibold text-muted uppercase tracking-[0.06em] mb-2">
          Current data
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {cards.map((c) => (
            <div key={c.label} className="bg-white rounded-[7px] border border-border p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <span className={`w-1.5 h-1.5 rounded-full ${c.filled ? 'bg-safe-green' : 'bg-muted/40'}`} aria-hidden="true" />
                <p className="text-[11px] font-semibold text-muted uppercase tracking-[0.06em]">{c.label}</p>
              </div>
              <p className={`text-[14px] font-semibold ${c.filled ? 'text-app-text' : 'text-muted'}`}>{c.primary}</p>
              <p className="text-[11.5px] text-muted mt-0.5">{c.secondary}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-[7px] border border-border p-6">
        <UploadForm />
      </div>

      <div className="mt-4">
        <ApiDocs />
      </div>
    </div>
  );
}
