export interface FaqItem {
  id: string;
  question: string;
  answer: string;
  /** Used for items needing approval before publish. */
  pendingApproval?: boolean;
}

export const faqItems: FaqItem[] = [
  {
    id: "what-is-fusion-44x",
    question: "What is Fusion44X?",
    answer:
      "Fusion44X is a hardware-based pool and spa water-treatment system that uses Hydro-pH-Infusion technology to create hydrogen-rich, balanced water in compatible pools and spas.",
  },
  {
    id: "is-it-a-chemical",
    question: "Is Fusion44X another pool chemical?",
    answer:
      "No. Fusion44X is not a chemical that is poured into the water. It is a hardware system installed as part of a compatible pool or spa setup.",
  },
  {
    id: "why-families-choose",
    question: "Why do families choose Fusion44X?",
    answer:
      "Many pool owners are looking for water that feels clean, comfortable, and better suited for the people they care about. Fusion44X offers an alternative to the traditional chlorine, salt, and weekly chemical cycle.",
  },
  {
    id: "existing-equipment",
    question: "Does Fusion44X work with existing pool equipment?",
    answer:
      "Fusion44X is designed to retrofit onto many existing pool and spa systems. Compatibility depends on your equipment, installation, pool size, and current setup.",
  },
  {
    id: "chlorine-or-salt",
    question: "Does Fusion44X use chlorine or salt?",
    answer:
      "Fusion44X is designed as a zero-chlorine and zero-salt water-treatment system for compatible installations. Your pool setup should be reviewed before installation.",
  },
  {
    id: "who-can-install",
    question: "Who can install Fusion44X?",
    answer:
      "Depending on the setup, Fusion44X may be installed by the homeowner or a local pool technician. Direct manufacturer support is available during installation.",
  },
  {
    id: "eliminate-every-task",
    question: "Does Fusion44X eliminate every pool-maintenance task?",
    answer:
      "No pool system removes every maintenance responsibility. Fusion44X is designed to reduce dependence on the traditional chemical cycle, but normal cleaning, monitoring, and installation-specific care may still be required.",
  },
  {
    id: "right-for-my-pool",
    question: "How do I know which Fusion44X system I need?",
    answer:
      "Complete the free pool assessment. The Fusion44X team will review your pool type, current equipment, size, and primary concerns before recommending the appropriate next step.",
  },
  {
    id: "what-happens-consultation",
    question: "What happens during the consultation?",
    answer:
      "A Fusion44X specialist will review your pool setup, discuss your concerns, explain compatibility, and answer your questions. There is no obligation to purchase.",
  },
];
