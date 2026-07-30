import type { DiagnosticAnswers } from "@/types/funnel";

export interface LeadSubmitPayload {
  session_id: string;
  event_id?: string;
  contact: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    zip_code: string;
    preferred_contact_method?: "email" | "phone" | "text";
  };
  diagnostic: {
    water_feature: string;
    installation_type: string;
    pool_size: string;
    current_treatment: string;
    current_issues: string[];
    primary_goal: string;
  };
  consent: {
    consent_to_contact: boolean;
    marketing_consent: boolean;
    consent_text_version: string;
  };
  source?: string;
}

export async function submitLead(
  payload: LeadSubmitPayload,
): Promise<{ lead_id?: string; status: number; duplicate?: boolean }> {
  const response = await fetch("/api/leads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (response.status === 409) {
    return { status: 409, duplicate: true };
  }

  if (!response.ok) {
    return { status: response.status };
  }

  const data = (await response.json()) as { lead_id: string };
  return { lead_id: data.lead_id, status: 201 };
}

export function buildLeadPayload(params: {
  session_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  zip_code: string;
  preferred_contact_method?: "email" | "phone" | "text";
  diagnostic_answers: DiagnosticAnswers;
  marketing_consent: boolean;
  source?: string;
  event_id?: string;
}): LeadSubmitPayload {
  const da = params.diagnostic_answers;
  return {
    session_id: params.session_id,
    event_id: params.event_id,
    contact: {
      first_name: params.first_name,
      last_name: params.last_name,
      email: params.email,
      phone: params.phone,
      zip_code: params.zip_code,
      preferred_contact_method: params.preferred_contact_method,
    },
    diagnostic: {
      water_feature: da.water_feature ?? "",
      installation_type: da.installation_type ?? "",
      pool_size: da.pool_size ?? "",
      current_treatment: da.current_treatment ?? "",
      current_issues: da.current_issues ?? [],
      primary_goal: da.primary_goal ?? "",
    },
    consent: {
      consent_to_contact: true,
      marketing_consent: params.marketing_consent,
      consent_text_version: "v1",
    },
    source: params.source,
  };
}
