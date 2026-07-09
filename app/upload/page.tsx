import { Users, Clock, CalendarDays } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { UploadForm } from '@/components/upload/UploadForm';
import { ApiDocs } from '@/components/upload/ApiDocs';
import { ExclusionsPanel } from '@/components/upload/ExclusionsPanel';
import { getRosterStatus, getEmployeeOptions, getFilterOptions } from '@/lib/queries/employees';
import { getExcludedEmployees, getExcludedDepartments } from '@/lib/queries/exclusions';
import { getLeaveStatus } from '@/lib/queries/leave';
import { getAttendanceCoverage } from '@/lib/queries/attendance';
import { formatDate } from '@/lib/utils/date';
import { requireRole } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

function fmtRange(start: string | null, end: string | null): string {
  if (!start || !end) return '—';
  return `${formatDate(start)} – ${formatDate(end)}`;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold text-muted uppercase tracking-[0.06em] mb-2">
      {children}
    </p>
  );
}

export default async function UploadPage() {
  await requireRole('admin'); // managers are redirected home
  const [roster, attendance, leave, employeeOptions, excludedEmployees, excludedDepartments, filterOptions] =
    await Promise.all([
      getRosterStatus(),
      getAttendanceCoverage(),
      getLeaveStatus(),
      getEmployeeOptions(),
      getExcludedEmployees(),
      getExcludedDepartments(),
      getFilterOptions(),
    ]);

  const cards: { label: string; icon: LucideIcon; primary: string; secondary: string; filled: boolean }[] = [
    {
      label: 'Employee Roster',
      icon: Users,
      primary: roster.count > 0 ? `${roster.count.toLocaleString()} employees` : 'No roster yet',
      secondary: roster.count > 0 ? `Updated ${formatDate(roster.lastUpdated)}` : 'Upload the Employee List Report',
      filled: roster.count > 0,
    },
    {
      label: 'Attendance',
      icon: Clock,
      primary: attendance.count > 0 ? fmtRange(attendance.start, attendance.end) : 'No attendance yet',
      secondary: attendance.count > 0
        ? `${attendance.count.toLocaleString()} daily records`
        : 'Upload an Attendance Report',
      filled: attendance.count > 0,
    },
    {
      label: 'Leave',
      icon: CalendarDays,
      primary: leave.count > 0 ? fmtRange(leave.start, leave.end) : 'No leave yet',
      secondary: leave.count > 0 ? `${leave.count.toLocaleString()} transactions` : 'Upload a Leave Report',
      filled: leave.count > 0,
    },
  ];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-app-text tracking-tight">
          Import reports
        </h1>
        <p className="text-[14px] text-muted mt-1.5">
          Upload your Sprout exports to update attendance records and the employee roster.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Left column: current data + upload */}
        <div className="space-y-8">
          {/* Current data status — what's already loaded, and through what date */}
          <section>
            <SectionLabel>Current data</SectionLabel>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {cards.map((c) => (
                <div key={c.label} className="bg-white rounded-[7px] border border-border p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-8 h-8 rounded-[6px] bg-ground border border-border flex items-center justify-center">
                      <c.icon className="w-4 h-4 text-navy" aria-hidden="true" />
                    </div>
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${c.filled ? 'bg-safe-green' : 'bg-muted/40'}`}
                      aria-hidden="true"
                    />
                  </div>
                  <p className="text-[11px] font-semibold text-muted uppercase tracking-[0.06em]">{c.label}</p>
                  <p className={`text-[14px] font-semibold mt-1 ${c.filled ? 'text-app-text' : 'text-muted'}`}>{c.primary}</p>
                  <p className="text-[11.5px] text-muted mt-0.5">{c.secondary}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Upload files */}
          <section>
            <SectionLabel>Upload files</SectionLabel>
            <div className="bg-white rounded-[7px] border border-border p-6">
              <UploadForm />
            </div>
          </section>
        </div>

        {/* Right column: tracking exclusions */}
        <section>
          <SectionLabel>Tracking exclusions</SectionLabel>
          <ExclusionsPanel
            employeeOptions={employeeOptions}
            excludedEmployees={excludedEmployees}
            excludedDepartments={excludedDepartments.map((d) => ({ id: d.id, name: d.name }))}
            departmentOptions={filterOptions.departments}
          />
        </section>
      </div>

      {/* Developer reference — full width below the two columns */}
      <section className="mt-8">
        <SectionLabel>Developer reference</SectionLabel>
        <ApiDocs />
      </section>
    </div>
  );
}
