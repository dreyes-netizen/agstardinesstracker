'use client';

import { useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { FilterProvider } from '@/context/FilterContext';

export interface NavUser {
  email: string;
  role: 'admin' | 'manager';
  displayName: string | null;
}

export function ClientLayout({ children, user }: { children: ReactNode; user: NavUser | null }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  // The login page has no app shell (no sidebar).
  if (pathname === '/login') return <>{children}</>;

  return (
    <div className="flex h-screen overflow-hidden bg-ground print:block print:h-auto print:overflow-visible print:bg-white">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} user={user} />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0 print:overflow-visible">
        {/* Mobile top bar — hidden on md+ */}
        <header className="md:hidden print:hidden flex-shrink-0 h-12 bg-white border-b border-border flex items-center px-4 gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-app-text text-[18px] leading-none w-8 h-8 flex items-center justify-center rounded-[4px] hover:bg-ground transition-colors"
            aria-label="Open navigation"
          >
            ☰
          </button>
          <span className="text-[14px] font-semibold text-app-text tracking-tight">Attendance Hub</span>
        </header>

        <main className="flex-1 overflow-y-auto print:overflow-visible">
          <FilterProvider>{children}</FilterProvider>
        </main>
      </div>
    </div>
  );
}
