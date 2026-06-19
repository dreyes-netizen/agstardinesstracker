interface StatCardsProps {
  nteRequired: number;
  approaching: number;
  totalIncidents: number;
}

export function StatCards({ nteRequired, approaching, totalIncidents }: StatCardsProps) {
  return (
    <div className="grid grid-cols-3 gap-3.5">
      <div className="bg-white border border-border border-l-[3px] border-l-nte-red rounded-[7px] px-5 py-[18px]">
        <p className="font-mono text-[10px] tracking-[0.1em] uppercase text-muted mb-1.5">NTE Required</p>
        <p className="text-[32px] font-bold text-nte-red leading-none tracking-tight">{nteRequired}</p>
        <p className="text-[11.5px] text-muted mt-1.5">Crossed 6 lates or 60 min this month</p>
      </div>

      <div className="bg-white border border-border border-l-[3px] border-l-amber rounded-[7px] px-5 py-[18px]">
        <p className="font-mono text-[10px] tracking-[0.1em] uppercase text-muted mb-1.5">Approaching Threshold</p>
        <p className="text-[32px] font-bold leading-none tracking-tight" style={{ color: '#B86D00' }}>{approaching}</p>
        <p className="text-[11.5px] text-muted mt-1.5">4–5 lates or 45–59 min accumulated</p>
      </div>

      <div className="bg-white border border-border border-l-[3px] border-l-app-blue rounded-[7px] px-5 py-[18px]">
        <p className="font-mono text-[10px] tracking-[0.1em] uppercase text-muted mb-1.5">Total Late Incidents</p>
        <p className="text-[32px] font-bold text-app-text leading-none tracking-tight">{totalIncidents}</p>
        <p className="text-[11.5px] text-muted mt-1.5">Across all employees this month</p>
      </div>
    </div>
  );
}
