const STATUS_STYLES: Record<string, string> = {
  Applied: 'bg-blue-900/50 text-blue-200 border-blue-800',
  Interviewing: 'bg-yellow-900/50 text-yellow-200 border-yellow-800',
  Offer: 'bg-emerald-900/50 text-emerald-200 border-emerald-800',
  Rejected: 'bg-red-900/50 text-red-200 border-red-800',
  Wishlist: 'bg-slate-700 text-slate-300 border-slate-600',
};

export function Badge({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center text-xs font-semibold rounded-full px-2.5 py-1 border ${className}`}>
      {children}
    </span>
  );
}

export function StatusBadgeClass(status: string) {
  return STATUS_STYLES[status] || STATUS_STYLES.Wishlist;
}
