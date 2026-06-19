import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Tardiness Tracker',
  description: 'AGS internal tardiness tracking',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
