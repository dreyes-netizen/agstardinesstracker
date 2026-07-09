'use client';

import { Printer } from 'lucide-react';

// Opens the browser print dialog. The print stylesheet (app/globals.css + print:hidden
// on the app chrome) reduces the page to just the report, so "Save as PDF" produces a
// clean, single-employee document.
export function PrintButton({ disabled }: { disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => window.print()}
      className="inline-flex items-center gap-1.5 bg-navy hover:bg-navy/90 text-white text-[12.5px] font-medium rounded-[5px] px-3 py-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed print:hidden"
    >
      <Printer className="w-3.5 h-3.5" aria-hidden="true" />
      Generate PDF
    </button>
  );
}
