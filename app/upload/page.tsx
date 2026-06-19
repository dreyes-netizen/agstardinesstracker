import { UploadForm } from '@/components/upload/UploadForm';

export default function UploadPage() {
  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-muted mb-1">
          Upload
        </p>
        <h1 className="text-2xl font-semibold text-app-text tracking-tight">
          Import reports
        </h1>
        <p className="text-[14px] text-muted mt-1.5">
          Upload your Sprout exports to update attendance records and the employee roster.
        </p>
      </div>

      <div className="bg-white rounded-[7px] border border-border p-6">
        <UploadForm />
      </div>
    </div>
  );
}
