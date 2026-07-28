import type { ButtonHTMLAttributes, ReactNode } from "react";

interface CtaButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  children: ReactNode;
  loading?: boolean;
}

const variantStyles = {
  primary:
    "bg-brand-aqua text-white hover:bg-brand-aqua-light focus-visible:ring-brand-aqua shadow-sm shadow-brand-aqua/20",
  secondary:
    "bg-white text-brand-navy border border-brand-aqua/30 hover:border-brand-aqua hover:bg-brand-aqua-pale focus-visible:ring-brand-aqua",
  ghost:
    "bg-transparent text-brand-navy hover:bg-brand-surface focus-visible:ring-brand-aqua",
};

const sizeStyles = {
  sm: "px-4 py-2 text-sm",
  md: "px-6 py-3 text-base",
  lg: "px-8 py-4 text-lg",
};

export function CtaButton({
  variant = "primary",
  size = "md",
  children,
  loading = false,
  className = "",
  disabled,
  ...props
}: CtaButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-lg font-semibold transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="flex items-center gap-2">
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          {children}
        </span>
      ) : (
        children
      )}
    </button>
  );
}
