'use client';

import { useEffect } from 'react';

export default function RosterError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);

  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
      <p className="text-[15px] font-medium text-app-text">Failed to load roster</p>
      <p className="text-[13px] text-muted mt-1">There was a problem connecting to the database.</p>
      <button
        onClick={reset}
        className="mt-4 text-[13px] text-app-blue hover:underline focus:outline-none"
      >
        Try again
      </button>
    </div>
  );
}
