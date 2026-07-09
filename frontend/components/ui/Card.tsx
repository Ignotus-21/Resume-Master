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
      className={`bg-white rounded-3xl shadow-[0_4px_24px_0_rgba(0,0,0,0.04)] relative overflow-hidden ${
        hoverable ? 'transition-all duration-300 hover:shadow-[0_12px_48px_0_rgba(0,0,0,0.08)] hover:-translate-y-1' : ''
      } ${className}`}
    >
      <div className="relative z-10">{children}</div>
    </div>
  );
}
