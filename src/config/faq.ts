export interface FaqItem {
  id: string;
  question: string;
  answer: string;
  /** When true, the answer still needs client approval before publish. */
  pendingApproval?: boolean;
}

export const faqItems: FaqItem[] = [
  {
    id: "what-is-fusion-44x",
    question: "What is Fusion 44X?",
    answer:
      "Fusion 44X is a probe-based water treatment system designed for pools and spas. A sensor probe monitors your water conditions and responds in real time to help maintain consistent water quality.",
  },
  {
    id: "existing-equipment",
    question: "Does it work with existing pool equipment?",
    answer:
      "Fusion 44X is designed to retrofit onto your existing pool or spa equipment. A full system replacement is not required in most setups. Compatibility depends on your current configuration, which a consultation can confirm.",
    pendingApproval: true,
  },
  {
    id: "who-can-install",
    question: "Who can install it?",
    answer:
      "Fusion 44X supports professional installation by a qualified pool technician. Some owners may also choose a self-install option depending on the setup. The Fusion 44X team can help you decide which approach fits your situation.",
    pendingApproval: true,
  },
  {
    id: "local-technician",
    question: "Can a local pool technician install it?",
    answer:
      "Yes. Fusion 44X is designed so that a local pool technician with standard pool-equipment experience can handle installation. Direct manufacturer support is also available during setup.",
    pendingApproval: true,
  },
  {
    id: "support-available",
    question: "What support is available?",
    answer:
      "Fusion 44X provides direct manufacturer support for questions about setup, operation, and ongoing use. You can also schedule a consultation through this site.",
  },
  {
    id: "replace-everything",
    question: "Does it replace every part of normal pool care?",
    answer:
      "Fusion 44X is intended to work alongside standard pool maintenance. It does not replace all routine care. Your consultation can help clarify what remains part of a normal maintenance plan.",
    pendingApproval: true,
  },
  {
    id: "right-for-my-pool",
    question: "How do I know whether it is right for my pool?",
    answer:
      "The best way to find out is to complete the free pool assessment on this page and schedule a consultation. A specialist can review your setup and help you understand whether Fusion 44X is a good fit.",
  },
  {
    id: "what-happens-consultation",
    question: "What happens during the consultation?",
    answer:
      "During the consultation, a Fusion 44X specialist will review your pool details, answer your questions, and discuss whether the system suits your setup. There is no obligation.",
    pendingApproval: true,
  },
];
