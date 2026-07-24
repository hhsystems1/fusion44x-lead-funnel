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
      className={`w-full rounded-lg border px-4 py-3 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 motion-reduce:transition-none ${
        selected
          ? "border-neutral-900 bg-neutral-900 text-white"
          : "border-neutral-300 bg-white text-neutral-900 hover:border-neutral-400 hover:bg-neutral-50"
      }`}
    >
      {label}
    </button>
  );
}
