import type { DiagnosticQuestion } from "@/types/funnel";

export const diagnosticQuestions: DiagnosticQuestion[] = [
  {
    id: "water-feature",
    type: "single-select",
    required: true,
    title: "What type of setup do you have?",
    options: [
      { code: "pool", label: "Pool only" },
      { code: "spa", label: "Spa only" },
      { code: "pool_and_spa", label: "Pool and spa" },
    ],
  },
  {
    id: "installation-type",
    type: "single-select",
    required: true,
    title: "How is your pool installed?",
    options: [
      { code: "in_ground", label: "In-ground" },
      { code: "above_ground", label: "Above ground" },
      { code: "not_sure", label: "I\u2019m not sure" },
    ],
  },
  {
    id: "current-treatment",
    type: "single-select",
    required: true,
    title: "What system are you currently using?",
    options: [
      { code: "chlorine", label: "Chlorine" },
      { code: "salt", label: "Saltwater" },
      { code: "other", label: "Another system" },
      { code: "not_sure", label: "I\u2019m not sure" },
    ],
  },
  {
    id: "primary-goal",
    type: "single-select",
    required: true,
    title:
      "What is the biggest reason you are looking into Fusion44X?",
    options: [
      {
        code: "family_confidence",
        label:
          "I want water I can feel better about for my family",
      },
      {
        code: "eliminate_chemicals",
        label:
          "I want to eliminate chlorine, salt, and harsh chemicals",
      },
      {
        code: "tired_of_balancing",
        label:
          "I am tired of constant chemical balancing",
      },
      {
        code: "algae_quality_problems",
        label:
          "I keep dealing with algae or water-quality problems",
      },
      {
        code: "simpler_routine",
        label: "I want a simpler pool-care routine",
      },
    ],
  },
  {
    id: "pool-size",
    type: "single-select",
    required: true,
    title: "How would you describe the size of your pool?",
    options: [
      { code: "small", label: "Small" },
      { code: "average", label: "Average size" },
      { code: "large", label: "Large" },
      { code: "not_sure", label: "I\u2019m not sure" },
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
] as const;
