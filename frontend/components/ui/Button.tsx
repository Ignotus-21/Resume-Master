import { Loader2 } from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    'bg-[#202124] text-white hover:bg-black shadow-[0_4px_14px_0_rgba(0,0,0,0.1)]',
  secondary:
    'bg-[#f8f9fa] text-[#202124] hover:bg-[#f1f3f4] border border-[#dadce0]',
  danger:
    'bg-[#d93025] text-white hover:bg-[#b3261e] shadow-[0_4px_14px_0_rgba(217,48,37,0.2)]',
  ghost: 'bg-transparent text-[#5f6368] hover:bg-[#f8f9fa] hover:text-[#202124]',
  outline: 'bg-transparent text-[#202124] border border-[#dadce0] hover:bg-[#f8f9fa]',
};

export function Button({
  children,
  variant = 'primary',
  loading = false,
  className = '',
  disabled,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  loading?: boolean;
}) {
  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full font-medium text-sm transition disabled:opacity-50 disabled:cursor-not-allowed ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}
