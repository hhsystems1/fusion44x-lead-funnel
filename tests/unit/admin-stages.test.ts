import { describe, it, expect } from "vitest";
import {
  LEAD_STAGES,
  LEAD_STAGE_LABELS,
  APPOINTMENT_STAGES,
  APPOINTMENT_STAGE_LABELS,
  leadStageSchema,
  appointmentStageSchema,
  leadStageLabel,
  appointmentStageLabel,
} from "@/lib/admin/stages";

describe("LEAD_STAGES", () => {
  it("exposes the five pipeline stages in order", () => {
    expect(LEAD_STAGES).toEqual([
      "contacted",
      "no_show",
      "follow_up",
      "won",
      "lost",
    ]);
  });

  it("labels every stage", () => {
    for (const stage of LEAD_STAGES) {
      expect(LEAD_STAGE_LABELS[stage]).toBeTypeOf("string");
      expect(LEAD_STAGE_LABELS[stage].length).toBeGreaterThan(0);
    }
  });
});

describe("leadStageSchema", () => {
  it("accepts null (unstaged)", () => {
    expect(leadStageSchema.safeParse(null).success).toBe(true);
  });

  it("accepts every stage value", () => {
    for (const stage of LEAD_STAGES) {
      expect(leadStageSchema.safeParse(stage).success).toBe(true);
    }
  });

  it("rejects unknown values", () => {
    expect(leadStageSchema.safeParse("pending").success).toBe(false);
    expect(leadStageSchema.safeParse("").success).toBe(false);
    expect(leadStageSchema.safeParse("new").success).toBe(false);
  });

  it("rejects non-string types", () => {
    expect(leadStageSchema.safeParse(3).success).toBe(false);
    expect(leadStageSchema.safeParse({}).success).toBe(false);
  });
});

describe("leadStageLabel", () => {
  it("returns the label for a known stage", () => {
    expect(leadStageLabel("follow_up")).toBe(LEAD_STAGE_LABELS.follow_up);
  });

  it("returns a fallback for null", () => {
    expect(leadStageLabel(null)).toBe("Unstaged");
  });
});

describe("APPOINTMENT_STAGES", () => {
  it("exposes the two trackable statuses", () => {
    expect(APPOINTMENT_STAGES).toEqual(["no_show", "completed"]);
  });

  it("labels every stage", () => {
    for (const stage of APPOINTMENT_STAGES) {
      expect(APPOINTMENT_STAGE_LABELS[stage]).toBeTypeOf("string");
    }
  });
});

describe("appointmentStageSchema", () => {
  it("accepts the two valid statuses", () => {
    expect(appointmentStageSchema.safeParse("no_show").success).toBe(true);
    expect(appointmentStageSchema.safeParse("completed").success).toBe(true);
  });

  it("rejects lead stages and other statuses", () => {
    expect(appointmentStageSchema.safeParse("won").success).toBe(false);
    expect(appointmentStageSchema.safeParse("pending").success).toBe(false);
    expect(appointmentStageSchema.safeParse(null).success).toBe(false);
  });
});

describe("appointmentStageLabel", () => {
  it("returns the label for a known status", () => {
    expect(appointmentStageLabel("completed")).toBe(APPOINTMENT_STAGE_LABELS.completed);
  });

  it("returns a fallback for unstaged statuses", () => {
    expect(appointmentStageLabel(null)).toBe("Unstaged");
  });

  it("returns the raw status for unknown statuses", () => {
    expect(appointmentStageLabel("pending")).toBe("pending");
    expect(appointmentStageLabel("cancelled")).toBe("cancelled");
  });
});
