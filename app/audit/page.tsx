import { requireUser } from '@/lib/auth/session';
import { getNteAuditLog } from '@/lib/queries/audit';
import { AuditTable } from '@/components/audit/AuditTable';

export const dynamic = 'force-dynamic';

export default async function AuditPage() {
  await requireUser();
  const rows = await getNteAuditLog({});

  const data = rows.map((r) => ({
    id: Number(r.id),
    createdAt: String(r.created_at),
    action: String(r.action),
    actorEmail: String(r.actor_email),
    actorRole: r.actor_role ? String(r.actor_role) : '',
    employeeId: String(r.employee_id),
    name: [r.last_name, r.first_name].filter(Boolean).join(', ') || String(r.employee_id),
    month: String(r.month),
    details: r.details ? String(r.details) : '',
  }));

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white border-b border-border flex-shrink-0 px-6 py-4">
        <h1 className="text-[15px] font-semibold text-app-text tracking-tight">NTE Audit Log</h1>
        <p className="text-[11.5px] text-muted mt-0.5">Every NTE action, with who performed it and when.</p>
      </div>
      <div className="flex-1 min-h-0 flex flex-col p-6">
        {data.length > 0 ? (
          <AuditTable data={data} />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <p className="text-[15px] font-medium text-app-text">No NTE activity yet</p>
            <p className="text-[13px] text-muted mt-1">Issued and acknowledged NTEs will appear here.</p>
          </div>
        )}
      </div>
    </div>
  );
}
