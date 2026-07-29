import { describe, it, expect } from "vitest";
import {
  waterFeatureSchema,
  installationTypeSchema,
  poolSizeSchema,
  currentTreatmentSchema,
  currentIssuesSchema,
  primaryGoalSchema,
  diagnosticAnswersSchema,
  contactNameSchema,
  contactEmailSchema,
  contactPhoneSchema,
  contactInfoSchema,
} from "@/lib/validation/schemas";

describe("waterFeatureSchema", () => {
  it("accepts valid water feature codes", () => {
    expect(waterFeatureSchema.safeParse("pool").success).toBe(true);
    expect(waterFeatureSchema.safeParse("spa").success).toBe(true);
    expect(waterFeatureSchema.safeParse("pool_and_spa").success).toBe(true);
  });

  it("rejects invalid water feature codes", () => {
    expect(waterFeatureSchema.safeParse("pond").success).toBe(false);
    expect(waterFeatureSchema.safeParse("").success).toBe(false);
  });
});

describe("installationTypeSchema", () => {
  it("accepts valid installation type codes", () => {
    expect(installationTypeSchema.safeParse("in_ground").success).toBe(true);
    expect(installationTypeSchema.safeParse("above_ground").success).toBe(true);
    expect(installationTypeSchema.safeParse("not_sure").success).toBe(true);
  });

  it("rejects invalid installation type codes", () => {
    expect(installationTypeSchema.safeParse("indoor").success).toBe(false);
  });
});

describe("poolSizeSchema", () => {
  it("accepts valid pool size codes", () => {
    expect(poolSizeSchema.safeParse("small").success).toBe(true);
    expect(poolSizeSchema.safeParse("average").success).toBe(true);
    expect(poolSizeSchema.safeParse("not_sure").success).toBe(true);
  });

  it("rejects invalid pool size codes", () => {
    expect(poolSizeSchema.safeParse("50000").success).toBe(false);
  });
});

describe("currentTreatmentSchema", () => {
  it("accepts valid treatment codes", () => {
    expect(currentTreatmentSchema.safeParse("chlorine").success).toBe(true);
    expect(currentTreatmentSchema.safeParse("salt").success).toBe(true);
    expect(currentTreatmentSchema.safeParse("other").success).toBe(true);
  });

  it("rejects invalid treatment codes", () => {
    expect(currentTreatmentSchema.safeParse("uv").success).toBe(false);
  });
});

describe("currentIssuesSchema", () => {
  it("accepts an array of valid issue codes", () => {
    const result = currentIssuesSchema.safeParse([
      "algae",
      "cloudy_water",
    ]);
    expect(result.success).toBe(true);
  });

  it("accepts a single-element array", () => {
    expect(
      currentIssuesSchema.safeParse(["chemical_smell"]).success,
    ).toBe(true);
  });

  it("rejects an empty array", () => {
    expect(currentIssuesSchema.safeParse([]).success).toBe(false);
  });

  it("rejects an array containing an invalid code", () => {
    const result = currentIssuesSchema.safeParse(["algae", "leak"]);
    expect(result.success).toBe(false);
  });

  it("rejects a string instead of an array", () => {
    expect(currentIssuesSchema.safeParse("algae").success).toBe(false);
  });
});

describe("primaryGoalSchema", () => {
  it("accepts valid primary goal codes", () => {
    expect(primaryGoalSchema.safeParse("family_confidence").success).toBe(true);
    expect(primaryGoalSchema.safeParse("simpler_routine").success).toBe(true);
  });

  it("rejects invalid primary goal codes", () => {
    expect(primaryGoalSchema.safeParse("save_money").success).toBe(false);
  });
});

describe("diagnosticAnswersSchema", () => {
  it("accepts a complete valid answers object", () => {
    const result = diagnosticAnswersSchema.safeParse({
      water_feature: "pool",
      installation_type: "in_ground",
      pool_size: "average",
      current_treatment: "chlorine",
      current_issues: ["algae", "cloudy_water"],
      primary_goal: "family_confidence",
    });
    expect(result.success).toBe(true);
  });

  it("accepts answers with current_issues", () => {
    const result = diagnosticAnswersSchema.safeParse({
      water_feature: "spa",
      installation_type: "above_ground",
      pool_size: "not_sure",
      current_treatment: "salt",
      current_issues: ["algae"],
      primary_goal: "tired_of_balancing",
    });
    expect(result.success).toBe(true);
  });

  it("rejects answers without required current_issues", () => {
    const result = diagnosticAnswersSchema.safeParse({
      water_feature: "spa",
      installation_type: "above_ground",
      pool_size: "not_sure",
      current_treatment: "salt",
      primary_goal: "tired_of_balancing",
    });
    expect(result.success).toBe(false);
  });

  it("rejects answers with empty current_issues", () => {
    const result = diagnosticAnswersSchema.safeParse({
      water_feature: "pool",
      installation_type: "in_ground",
      pool_size: "small",
      current_treatment: "chlorine",
      current_issues: [],
      primary_goal: "family_confidence",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid value in any required field", () => {
    const result = diagnosticAnswersSchema.safeParse({
      water_feature: "invalid",
      installation_type: "in_ground",
      pool_size: "small",
      current_treatment: "chlorine",
      primary_goal: "family_confidence",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing required field", () => {
    const result = diagnosticAnswersSchema.safeParse({
      water_feature: "pool",
      installation_type: "in_ground",
      // missing pool_size
      current_treatment: "chlorine",
      primary_goal: "family_confidence",
    });
    expect(result.success).toBe(false);
  });
});

describe("contactNameSchema", () => {
  it("accepts a valid name", () => {
    expect(contactNameSchema.safeParse("John Doe").success).toBe(true);
  });

  it("rejects a name that is too short", () => {
    expect(contactNameSchema.safeParse("J").success).toBe(false);
  });

  it("rejects empty string", () => {
    expect(contactNameSchema.safeParse("").success).toBe(false);
  });
});

describe("contactEmailSchema", () => {
  it("accepts a valid email", () => {
    expect(contactEmailSchema.safeParse("john@example.com").success).toBe(
      true,
    );
  });

  it("rejects an invalid email", () => {
    expect(contactEmailSchema.safeParse("not-an-email").success).toBe(false);
  });

  it("rejects empty string", () => {
    expect(contactEmailSchema.safeParse("").success).toBe(false);
  });
});

describe("contactPhoneSchema", () => {
  it("accepts a valid phone number", () => {
    expect(contactPhoneSchema.safeParse("+1 (555) 123-4567").success).toBe(
      true,
    );
  });

  it("accepts digits only", () => {
    expect(contactPhoneSchema.safeParse("5551234567").success).toBe(true);
  });

  it("rejects a number that is too short", () => {
    expect(contactPhoneSchema.safeParse("12345").success).toBe(false);
  });

  it("rejects a number with letters", () => {
    expect(contactPhoneSchema.safeParse("555-ABC-1234").success).toBe(false);
  });
});

describe("contactInfoSchema", () => {
  it("accepts valid contact info", () => {
    const result = contactInfoSchema.safeParse({
      full_name: "Jane Smith",
      email: "jane@example.com",
      phone: "5551234567",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid contact info", () => {
    const result = contactInfoSchema.safeParse({
      full_name: "",
      email: "bad",
      phone: "12",
    });
    expect(result.success).toBe(false);
  });
});
