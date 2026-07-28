interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message = "Loading..." }: LoadingStateProps) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 py-12"
      role="status"
      aria-live="polite"
    >
      <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-brand-aqua border-t-transparent" />
      <p className="text-sm text-neutral-500">{message}</p>
    </div>
  );
}
