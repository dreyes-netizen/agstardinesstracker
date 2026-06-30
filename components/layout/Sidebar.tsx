'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';
import type { NavUser } from './ClientLayout';

const navItems: { href: string; label: string; icon: string; adminOnly?: boolean }[] = [
  { href: '/',                 label: 'Dashboard',        icon: '▦' },
  { href: '/attendance-score', label: 'Attendance Score', icon: '◊' },
  { href: '/leave-report',     label: 'Leave Report',     icon: '☷' },
  { href: '/nte',              label: 'NTE Management',   icon: '⚑' },
  { href: '/audit',            label: 'Audit Log',        icon: '◷' },
  { href: '/roster',           label: 'Roster',           icon: '☰' },
  { href: '/upload',           label: 'Upload Report',    icon: '↑', adminOnly: true },
  { href: '/users',            label: 'Users',            icon: '◉', adminOnly: true },
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
  user: NavUser | null;
}

export function Sidebar({ open, onClose, user }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const visibleNav = navItems.filter((item) => !item.adminOnly || user?.role === 'admin');

  async function handleSignOut() {
    try { await fetch('/api/auth/session', { method: 'DELETE' }); } catch { /* ignore */ }
    try { await signOut(auth); } catch { /* ignore */ }
    router.replace('/login');
    router.refresh();
  }

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
        <div className="px-5 py-[18px] border-b border-white/[0.07] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="bg-white rounded-[6px] p-1 flex-shrink-0">
              <Image src="/agslogo.png" alt="Alliance Global Solutions" width={42} height={36} className="h-9 w-auto" />
            </div>
            <div className="min-w-0">
              <p className="font-mono text-[9px] tracking-[0.16em] uppercase text-white/50 mb-0.5">
                AGS Internal
              </p>
              <p className="text-[14px] font-semibold text-white tracking-tight truncate">
                Attendance Hub
              </p>
            </div>
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

        <nav className="flex-1 px-2.5 py-4 flex flex-col gap-0.5 overflow-y-auto">
          {visibleNav.map((item) => {
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
                Score
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

        {/* Account footer */}
        {user && (
          <div className="border-t border-white/[0.07] px-3 py-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[12px] text-white/85 truncate" title={user.email}>
                  {user.displayName || user.email}
                </p>
                <p className="text-[10px] uppercase tracking-[0.08em] text-white/40">
                  {user.role}
                </p>
              </div>
              <button
                onClick={handleSignOut}
                className="flex-shrink-0 text-[11.5px] text-white/60 hover:text-white border border-white/15 hover:border-white/30 rounded-[5px] px-2 py-1 transition-colors"
              >
                Sign out
              </button>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
