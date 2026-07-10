const STATUS_STYLES: Record<string, string> = {
  Applied: 'bg-blue-50 text-[#1a73e8] border-blue-200',
  Interviewing: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  Offer: 'bg-green-50 text-[#1e8e3e] border-green-200',
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
