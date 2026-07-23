import type { DiagnosticAnswers } from "@/types/funnel";

export type LeadStatus =
  | "new"
  | "contacted"
  | "qualified"
  | "booked"
  | "converted"
  | "lost";

export interface Lead {
  id?: string;
  full_name: string;
  email: string;
  phone: string;
  diagnostic_answers?: DiagnosticAnswers;
  status?: LeadStatus;
  created_at?: string;
  updated_at?: string;
}

export interface LeadSubmission {
  full_name: string;
  email: string;
  phone: string;
}

export interface LeadWithId extends Lead {
  id: string;
  created_at: string;
}
