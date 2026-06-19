import { NteTable } from '@/components/nte/NteTable';
import { getNteList } from '@/lib/queries/nte';

export default async function NtePage() {
  const rows = await getNteList();
  return (
    <div className="p-6">
      <div className="mb-6">
        <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-muted mb-1">Management</p>
        <h1 className="text-2xl font-semibold text-app-text tracking-tight">NTE Management</h1>
        <p className="text-[14px] text-muted mt-1.5">Employees who have crossed the tardiness threshold. Issue and track NTE documents here.</p>
      </div>
      <NteTable rows={rows as Parameters<typeof NteTable>[0]['rows']} />
    </div>
  );
}
