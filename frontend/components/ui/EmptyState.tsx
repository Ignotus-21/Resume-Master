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
    <div className="flex flex-col items-center justify-center text-center py-16 px-6 rounded-3xl border border-dashed border-[#dadce0] bg-[#f8f9fa]">
      <div className="h-12 w-12 rounded-full bg-blue-50 flex items-center justify-center mb-4 text-[#1a73e8]">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="text-[#202124] font-bold mb-1">{title}</h3>
      {description && <p className="text-[#5f6368] text-sm max-w-sm mb-4">{description}</p>}
      {action}
    </div>
  );
}
