const STATUS_STYLES: Record<string, string> = {
  Applied: 'bg-blue-900/50 text-blue-200 border-blue-800',
  Interviewing: 'bg-yellow-900/50 text-yellow-700 border-yellow-200',
  Offer: 'bg-emerald-900/50 text-emerald-200 border-emerald-800',
  Rejected: 'bg-[#fce8e6] text-[#d93025] border-[#d93025]',
  Wishlist: 'bg-white text-[#202124] border-[#dadce0]',
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
