'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/',                 label: 'Dashboard',        icon: '▦' },
  { href: '/attendance-score', label: 'Attendance Score', icon: '◊' },
  { href: '/leave-report',     label: 'Leave Report',     icon: '☷' },
  { href: '/nte',              label: 'NTE Management',   icon: '⚑' },
  { href: '/roster',           label: 'Roster',           icon: '☰' },
  { href: '/upload',           label: 'Upload Report',    icon: '↑' },
];

// Attendance grade scale (matches gradeFor() in lib/queries/attendance-score.ts
// and the color tiers in ScoreTable). Shown in the sidebar on /attendance-score.
const KPI_GRADES = [
  { grade: 5, range: '100% and above', dot: 'bg-safe-green' },
  { grade: 3, range: '95% – 99%',      dot: 'bg-app-blue' },
  { grade: 2, range: '90% – 94%',      dot: 'bg-amber' },
  { grade: 1, range: 'Below 90%',      dot: 'bg-nte-red' },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Backdrop — mobile only */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={`
          w-[220px] bg-navy flex flex-col flex-shrink-0 h-screen
          fixed inset-y-0 left-0 z-50
          transition-transform duration-200 ease-out
          md:static md:translate-x-0
          ${open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        <div className="px-5 py-[22px] border-b border-white/[0.07] flex items-center justify-between">
          <div>
            <p className="font-mono text-[9px] tracking-[0.16em] uppercase text-white/50 mb-1">
              AGS Internal
            </p>
            <p className="text-[15px] font-semibold text-white tracking-tight">
              Tardiness Tracker
            </p>
          </div>
          {/* Close button — mobile only */}
          <button
            onClick={onClose}
            className="md:hidden text-white/50 hover:text-white w-7 h-7 flex items-center justify-center rounded text-xl leading-none"
            aria-label="Close navigation"
          >
            ×
          </button>
        </div>

        <nav className="flex-1 px-2.5 py-4 flex flex-col gap-0.5">
          {navItems.map((item) => {
            const active = item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-2.5 px-2.5 py-2 rounded-[5px] text-[13px] transition-colors ${
                  active
                    ? 'bg-white/10 text-white'
                    : 'text-white/65 hover:bg-white/[0.07] hover:text-white/85'
                }`}
              >
                <span className="w-4 text-center opacity-80">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Contextual KPI guide — only on the Attendance Score page */}
        {pathname.startsWith('/attendance-score') && (
          <div className="px-2.5 pb-4">
            <div className="rounded-[6px] border border-white/[0.09] bg-white/[0.04] p-3">
              <p className="font-mono text-[9px] tracking-[0.16em] uppercase text-white/45 mb-2.5">
                KPI Score Guide
              </p>

              {/* How the score is computed */}
              <div className="text-[11px] leading-snug text-white/55 space-y-1.5 mb-3">
                <p>
                  <span className="text-white/85">Score %</span> = hours present ÷ required hours
                </p>
                <p>
                  <span className="text-white/85">Present</span> = (present days × 8h) − undertime − sick
                </p>
                <p>
                  <span className="text-white/85">Required</span> = (present + absent days) × 8h
                </p>
              </div>

              <p className="font-mono text-[9px] tracking-[0.16em] uppercase text-white/45 mb-2">
                Grade
              </p>
              <ul className="flex flex-col gap-2">
                {KPI_GRADES.map(({ grade, range, dot }) => (
                  <li key={grade} className="flex items-center gap-2.5">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dot}`} aria-hidden="true" />
                    <span className="font-mono text-[12px] text-white/90 w-3 text-center">{grade}</span>
                    <span className="text-[11.5px] text-white/55">{range}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
