import { Loader2 } from 'lucide-react';

export function Spinner({ label, className = '' }: { label?: string; className?: string }) {
  return (
    <div className={`flex items-center justify-center gap-2 text-slate-400 ${className}`}>
      <Loader2 className="h-5 w-5 animate-spin" />
      {label && <span className="text-sm">{label}</span>}
    </div>
  );
}

export function PageSpinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
      <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
      <p className="text-slate-400 text-sm">{label}</p>
    </div>
  );
}
