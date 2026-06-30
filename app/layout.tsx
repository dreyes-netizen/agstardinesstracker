import type { Metadata } from 'next';
import './globals.css';
import { ClientLayout } from '@/components/layout/ClientLayout';
import { getSessionUser } from '@/lib/auth/session';

export const metadata: Metadata = {
  title: 'Attendance Hub — AGS',
  description: 'AGS internal attendance, leave, and NTE management',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  return (
    <html lang="en">
      <body>
        <ClientLayout user={user}>{children}</ClientLayout>
      </body>
    </html>
  );
}
