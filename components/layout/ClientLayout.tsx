'use client';

import { useState, type ReactNode } from 'react';
import { Sidebar } from './Sidebar';

export function ClientLayout({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-ground">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Mobile top bar — hidden on md+ */}
        <header className="md:hidden flex-shrink-0 h-12 bg-white border-b border-border flex items-center px-4 gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-app-text text-[18px] leading-none w-8 h-8 flex items-center justify-center rounded-[4px] hover:bg-ground transition-colors"
            aria-label="Open navigation"
          >
            ☰
          </button>
          <span className="text-[14px] font-semibold text-app-text tracking-tight">Tardiness Tracker</span>
        </header>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
