import type { DiagnosticQuestion } from "@/types/funnel";

/**
 * Diagnostic question definitions.
 *
 * Design rules:
 *  - `code` values are stable identifiers stored in the database.
 *    Never change a code after launch — add new codes instead.
 *  - `label` values are display text that can be changed freely.
 *    Wording updates never break existing database records.
 *
 * Adding a new question:
 *  1. Add a stable ID to DIAGNOSTIC_QUESTION_IDS in types/funnel.ts.
 *  2. Add the answer code array and type alias in types/funnel.ts.
 *  3. Add the display configuration below.
 *  4. Add a Zod schema in src/lib/validation/schemas.ts.
 */

export const diagnosticQuestions: DiagnosticQuestion[] = [
  {
    id: "water-feature",
    type: "single-select",
    required: true,
    title: "What type of water feature do you have?",
    subtitle: "Select the option that best describes your setup.",
    options: [
      { code: "pool", label: "Pool" },
      { code: "spa", label: "Spa" },
      { code: "pool_and_spa", label: "Pool & Spa" },
    ],
  },
  {
    id: "installation-type",
    type: "single-select",
    required: true,
    title: "How is your pool installed?",
    subtitle: "Not sure? Select \"I'm not sure\".",
    options: [
      { code: "in_ground", label: "In-Ground" },
      { code: "above_ground", label: "Above Ground" },
      { code: "not_sure", label: "I'm not sure" },
    ],
  },
  {
    id: "pool-size",
    type: "single-select",
    required: true,
    title: "What is your approximate pool size?",
    subtitle: "Estimate is fine — we just need a general idea.",
    options: [
      { code: "under_10000", label: "Under 10,000 gallons" },
      { code: "10000_to_20000", label: "10,000 – 20,000 gallons" },
      { code: "20001_to_30000", label: "20,001 – 30,000 gallons" },
      { code: "over_30000", label: "Over 30,000 gallons" },
      { code: "not_sure", label: "I'm not sure" },
    ],
  },
  {
    id: "current-treatment",
    type: "single-select",
    required: true,
    title: "What sanitization method do you currently use?",
    subtitle: "Choose the primary method for your pool or spa.",
    options: [
      { code: "chlorine", label: "Chlorine" },
      { code: "salt", label: "Salt System" },
      { code: "bromine", label: "Bromine" },
      { code: "pool_service", label: "Pool Service" },
      { code: "other", label: "Other" },
      { code: "not_sure", label: "I'm not sure" },
    ],
  },
  {
    id: "current-issues",
    type: "multi-select",
    required: true,
    title: "What issues are you currently experiencing?",
    subtitle: "Select all that apply.",
    options: [
      { code: "chemical_smell", label: "Strong chemical smell" },
      { code: "skin_eye_irritation", label: "Skin or eye irritation" },
      { code: "cloudy_water", label: "Cloudy or dull water" },
      { code: "algae", label: "Algae growth" },
      { code: "scaling_staining", label: "Scaling or staining" },
      { code: "frequent_adjustment", label: "Frequent chemical adjustment" },
      { code: "high_cost", label: "High chemical costs" },
      {
        code: "children_pet_concerns",
        label: "Concerns about children or pets",
      },
      { code: "other", label: "Other issues" },
    ],
  },
  {
    id: "primary-goal",
    type: "single-select",
    required: true,
    title: "What is your primary goal?",
    subtitle: "What matters most to you in your water care routine?",
    options: [
      { code: "reduce_chemicals", label: "Reduce chemical usage" },
      { code: "clearer_water", label: "Crystal clear water" },
      {
        code: "more_comfortable_water",
        label: "More comfortable swimming experience",
      },
      { code: "easier_maintenance", label: "Easier maintenance" },
      { code: "protect_equipment", label: "Protect pool equipment" },
      { code: "all_of_the_above", label: "All of the above" },
    ],
  },
] as const;
