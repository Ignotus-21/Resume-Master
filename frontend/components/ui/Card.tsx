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
      className={`bg-zinc-900/40 border border-white/5 rounded-2xl shadow-xl shadow-black/40 backdrop-blur-md relative overflow-hidden ${
        hoverable ? 'transition-all duration-300 hover:bg-zinc-900/60 hover:border-white/10 hover:shadow-2xl hover:shadow-purple-900/20 hover:-translate-y-1' : ''
      } ${className}`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
