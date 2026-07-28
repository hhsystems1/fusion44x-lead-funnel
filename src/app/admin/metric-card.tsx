export function MetricCard({
  label,
  value,
  subtitle,
  accent,
}: {
  label: string;
  value: string | number;
  subtitle?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`bg-white rounded-lg border px-4 py-3 ${
        accent ? "border-brand-aqua/30 bg-brand-aqua-pale/30" : "border-gray-200"
      }`}
    >
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
        {label}
      </p>
      <p className="text-2xl font-semibold text-gray-900 mt-1">{value}</p>
      {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
    </div>
  );
}

export function StatusBadge({
  status,
  variant,
}: {
  status: string;
  variant?: "success" | "warning" | "error" | "neutral";
}) {
  const colors: Record<string, string> = {
    success: "bg-green-100 text-green-800",
    warning: "bg-yellow-100 text-yellow-800",
    error: "bg-red-100 text-red-800",
    neutral: "bg-gray-100 text-gray-600",
  };

  const autoVariant =
    status === "confirmed" || status === "delivered" || status === "booked"
      ? "success"
      : status === "pending" || status === "processing" || status === "retrying"
        ? "warning"
        : status === "failed" || status === "dead_letter"
          ? "error"
          : "neutral";

  const v = variant ?? autoVariant;

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors[v]}`}
    >
      {status}
    </span>
  );
}
