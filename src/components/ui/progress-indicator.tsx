interface ProgressIndicatorProps {
  current: number;
  total: number;
  label?: string;
}

export function ProgressIndicator({
  current,
  total,
  label,
}: ProgressIndicatorProps) {
  const percent = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <div className="w-full" role="group" aria-label={label ?? "Progress"}>
      <div className="mb-2 flex items-center justify-between text-sm text-neutral-500">
        <span aria-hidden="true">
          Step {current} of {total}
        </span>
        <span aria-hidden="true">{percent}%</span>
      </div>
      <div
        className="h-2.5 w-full overflow-hidden rounded-full bg-brand-aqua/10"
        role="progressbar"
        aria-valuenow={current}
        aria-valuemin={1}
        aria-valuemax={total}
        aria-label={label ?? `Step ${current} of ${total}`}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-brand-aqua to-brand-aqua-light transition-all duration-300 motion-reduce:transition-none"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
