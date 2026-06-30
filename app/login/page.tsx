import Image from 'next/image';
import { LoginForm } from '@/components/auth/LoginForm';

export const metadata = { title: 'Sign in — AGS Attendance Hub' };

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-ground px-4">
      <div className="w-full max-w-sm bg-white border border-border rounded-[10px] p-8 shadow-sm animate-fade-in-up">
        <div className="mb-6 flex flex-col items-center text-center">
          <Image
            src="/agslogo.png"
            alt="Alliance Global Solutions"
            width={104}
            height={90}
            priority
            className="h-[72px] w-auto mb-4"
          />
          <p className="font-mono text-[10px] tracking-[0.16em] uppercase text-muted mb-1">
            AGS Internal
          </p>
          <h1 className="text-[20px] font-semibold text-app-text tracking-tight">
            Attendance Hub
          </h1>
          <p className="text-[13px] text-muted mt-1.5">
            Sign in with your authorized Google account to continue.
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
