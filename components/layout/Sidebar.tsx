'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/',        label: 'Dashboard',       icon: '▦' },
  { href: '/nte',     label: 'NTE Management',  icon: '⚑' },
  { href: '/roster',  label: 'Roster',          icon: '☰' },
  { href: '/upload',  label: 'Upload Report',   icon: '↑' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-[220px] bg-navy flex flex-col flex-shrink-0 h-screen sticky top-0">
      <div className="px-5 py-[22px] border-b border-white/[0.07]">
        <p className="font-mono text-[9px] tracking-[0.16em] uppercase text-white/35 mb-1">
          AGS Internal
        </p>
        <p className="text-[15px] font-semibold text-white tracking-tight">
          Tardiness Tracker
        </p>
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
              className={`flex items-center gap-2.5 px-2.5 py-2 rounded-[5px] text-[13px] transition-colors ${
                active
                  ? 'bg-white/10 text-white'
                  : 'text-white/55 hover:bg-white/[0.07] hover:text-white/85'
              }`}
            >
              <span className="w-4 text-center opacity-80">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-4 pb-4">
        <Link
          href="/upload"
          className="flex items-center justify-center gap-2 w-full py-2.5 bg-amber text-white rounded-[5px] text-[12.5px] font-semibold hover:bg-amber/90 transition-colors"
        >
          ↑ Upload Report
        </Link>
      </div>
    </aside>
  );
}
