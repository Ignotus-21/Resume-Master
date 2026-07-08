import { LucideIcon } from 'lucide-react';

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6 rounded-2xl border border-dashed border-slate-700 bg-slate-800/30">
      <div className="h-12 w-12 rounded-full bg-slate-800 flex items-center justify-center mb-4 text-blue-400">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="text-slate-200 font-semibold mb-1">{title}</h3>
      {description && <p className="text-slate-500 text-sm max-w-sm mb-4">{description}</p>}
      {action}
    </div>
  );
}
