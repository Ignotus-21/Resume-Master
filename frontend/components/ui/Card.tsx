export function Card({
  children,
  className = '',
  hoverable = false,
}: {
  children: React.ReactNode;
  className?: string;
  hoverable?: boolean;
}) {
  return (
    <div
      className={`bg-slate-800/60 border border-slate-700 rounded-2xl shadow-lg backdrop-blur-sm ${
        hoverable ? 'transition hover:border-slate-600 hover:shadow-xl' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
}
