import { NteStatus } from '@/lib/utils/nte-status';

const config: Record<NteStatus, { label: string; className: string }> = {
  safe:         { label: 'Safe',         className: 'bg-safe-green/10 text-safe-green rounded-[3px]' },
  warning:      { label: 'Warning',      className: 'bg-amber/10 text-amber rounded-[3px]' },
  required:     { label: 'NTE Required', className: 'bg-nte-red/10 text-nte-red rounded-[2px]' },
  issued:       { label: 'NTE Issued',   className: 'bg-app-blue/10 text-app-blue rounded-[3px]' },
  acknowledged: { label: 'Acknowledged', className: 'bg-muted/10 text-muted rounded-[3px]' },
};

const dotColor: Record<NteStatus, string> = {
  safe:         'bg-safe-green',
  warning:      'bg-amber',
  required:     'bg-nte-red',
  issued:       'bg-app-blue',
  acknowledged: 'bg-muted',
};

export function StatusBadge({ status }: { status: NteStatus }) {
  const { label, className } = config[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-semibold tracking-[0.03em] ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor[status]}`} />
      {label}
    </span>
  );
}
