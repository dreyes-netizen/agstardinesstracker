interface StatCardsProps {
  nteRequired: number;
  approaching: number;
  totalIncidents: number;
  latePercent: number;
  lateCount: number;
  totalEmployees: number;
}

export function StatCards({ nteRequired, approaching, totalIncidents, latePercent, lateCount, totalEmployees }: StatCardsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
      <div className="bg-white border border-border rounded-[7px] px-4 py-3.5">
        <p className="text-[11px] font-medium text-muted mb-1">NTE Required</p>
        <p className="text-[24px] font-bold text-nte-red leading-none tracking-tight">{nteRequired}</p>
        <p className="text-[11px] text-muted mt-1">Crossed 6 lates or 60 min</p>
      </div>

      <div className="bg-white border border-border rounded-[7px] px-4 py-3.5">
        <p className="text-[11px] font-medium text-muted mb-1">Approaching Threshold</p>
        <p className="text-[24px] font-bold text-amber-dark leading-none tracking-tight">{approaching}</p>
        <p className="text-[11px] text-muted mt-1">4–5 lates or 45–59 min</p>
      </div>

      <div className="bg-white border border-border rounded-[7px] px-4 py-3.5">
        <p className="text-[11px] font-medium text-muted mb-1">Total Late Incidents</p>
        <p className="text-[24px] font-bold text-app-text leading-none tracking-tight">{totalIncidents}</p>
        <p className="text-[11px] text-muted mt-1">Across all employees</p>
      </div>

      <div className="bg-white border border-border rounded-[7px] px-4 py-3.5">
        <p className="text-[11px] font-medium text-muted mb-1">Employees Late</p>
        <p className="text-[24px] font-bold text-app-blue leading-none tracking-tight">{latePercent}<span className="text-[14px] font-semibold text-muted ml-0.5">%</span></p>
        <p className="text-[11px] text-muted mt-1">{lateCount} of {totalEmployees} employees</p>
      </div>
    </div>
  );
}
