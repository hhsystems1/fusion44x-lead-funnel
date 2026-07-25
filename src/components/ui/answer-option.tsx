interface AnswerOptionProps {
  code: string;
  label: string;
  selected: boolean;
  type: "single" | "multi";
  onSelect: (code: string) => void;
}

export function AnswerOption({
  code,
  label,
  selected,
  type,
  onSelect,
}: AnswerOptionProps) {
  const id = `option-${code}`;

  return (
    <button
      id={id}
      role={type === "single" ? "radio" : "checkbox"}
      aria-checked={selected}
      onClick={() => onSelect(code)}
      className={`w-full rounded-lg border px-4 py-3 text-left text-sm transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-aqua motion-reduce:transition-none ${
        selected
          ? "border-brand-aqua bg-brand-aqua text-white shadow-sm shadow-brand-aqua/20"
          : "border-neutral-200 bg-white text-brand-navy hover:border-brand-aqua/40 hover:bg-brand-aqua-pale"
      }`}
    >
      {label}
    </button>
  );
}
