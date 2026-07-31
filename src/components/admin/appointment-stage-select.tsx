"use client";

import { useState } from "react";
import {
  APPOINTMENT_STAGES,
  APPOINTMENT_STAGE_LABELS,
  type AppointmentStage,
} from "@/lib/admin/stages";

function toStage(status: string | null): AppointmentStage | null {
  if (status && (APPOINTMENT_STAGES as readonly string[]).includes(status)) {
    return status as AppointmentStage;
  }
  return null;
}

export function AppointmentStageSelect({
  appointmentId,
  value,
  onChange,
}: {
  appointmentId: string;
  value: string | null;
  onChange?: (stage: AppointmentStage | null) => void;
}) {
  const [stage, setStage] = useState<AppointmentStage | null>(toStage(value));

  async function handleChange(next: string) {
    const nextStage = (next || null) as AppointmentStage | null;
    const previous = stage;
    setStage(nextStage);
    onChange?.(nextStage);

    if (!nextStage) return;

    try {
      const response = await fetch(`/api/admin/appointments/${appointmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStage }),
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
      aria-label="Appointment stage"
      className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-700 focus:border-brand-aqua focus:outline-none"
    >
      <option value="">Unstaged</option>
      {APPOINTMENT_STAGES.map((s) => (
        <option key={s} value={s}>
          {APPOINTMENT_STAGE_LABELS[s]}
        </option>
      ))}
    </select>
  );
}
