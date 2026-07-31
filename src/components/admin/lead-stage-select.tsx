"use client";

import { useState } from "react";
import { LEAD_STAGES, LEAD_STAGE_LABELS, type LeadStage } from "@/lib/admin/stages";

export function LeadStageSelect({
  leadId,
  value,
  onChange,
}: {
  leadId: string;
  value: string | null;
  onChange?: (stage: LeadStage | null) => void;
}) {
  const [stage, setStage] = useState<LeadStage | null>(
    value as LeadStage | null,
  );

  async function handleChange(next: string) {
    const nextStage = (next || null) as LeadStage | null;
    const previous = stage;
    setStage(nextStage);
    onChange?.(nextStage);

    try {
      const response = await fetch(`/api/admin/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: nextStage }),
      });

      if (!response.ok) {
        setStage(previous);
        onChange?.(previous);
      }
    } catch {
      setStage(previous);
      onChange?.(previous);
    }
  }

  return (
    <select
      value={stage ?? ""}
      onChange={(e) => handleChange(e.target.value)}
      aria-label="Lead stage"
      className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-700 focus:border-brand-aqua focus:outline-none"
    >
      <option value="">Unstaged</option>
      {LEAD_STAGES.map((s) => (
        <option key={s} value={s}>
          {LEAD_STAGE_LABELS[s]}
        </option>
      ))}
    </select>
  );
}
