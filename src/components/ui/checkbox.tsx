import type { InputHTMLAttributes } from "react";

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
  error?: string;
}

export function Checkbox({
  label,
  error,
  id,
  className = "",
  ...props
}: CheckboxProps) {
  const inputId = id ?? `checkbox-${label.toLowerCase().replace(/\s+/g, "-")}`;
  const errorId = `${inputId}-error`;

  return (
    <div className="w-full">
      <div className="flex items-start gap-3">
        <input
          id={inputId}
          type="checkbox"
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
          className={`mt-1 h-4 w-4 rounded border-neutral-300 text-brand-aqua focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-aqua ${className}`}
          {...props}
        />
        <label htmlFor={inputId} className="text-sm text-brand-navy/80">
          {label}
        </label>
      </div>
      {error && (
        <p id={errorId} className="mt-1 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
