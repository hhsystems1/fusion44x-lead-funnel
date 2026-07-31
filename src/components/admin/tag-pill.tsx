export function TagPill({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "aqua" | "muted";
}) {
  const tones = {
    neutral: "bg-gray-100 text-gray-700",
    aqua: "bg-brand-aqua-pale text-brand-navy",
    muted: "bg-gray-50 text-gray-500",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}
    >
      {label}
    </span>
  );
}
