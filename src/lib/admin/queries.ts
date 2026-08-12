import "server-only";

import { getServerSupabaseClient } from "@/lib/supabase";
import type { LeadStage, AppointmentStage } from "@/lib/admin/stages";

// Supabase without generated Database types returns `never` for query results.
// We use `any` casts on query builder results to work around this.
// All data is validated by the existing RLS policies and server-side checks.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

// =============================================================================
// Date Range Helpers
// =============================================================================

export type DateFilter =
  | { type: "today" }
  | { type: "last7" }
  | { type: "last30" }
  | { type: "custom"; from: string; to: string };

export function resolveDateRange(filter: DateFilter): { from: Date; to: Date } {
  const now = new Date();
  const to = new Date(now);
  to.setHours(23, 59, 59, 999);

  switch (filter.type) {
    case "today": {
      const from = new Date(now);
      from.setHours(0, 0, 0, 0);
      return { from, to };
    }
    case "last7": {
      const from = new Date(now);
      from.setDate(from.getDate() - 7);
      from.setHours(0, 0, 0, 0);
      return { from, to };
    }
    case "last30": {
      const from = new Date(now);
      from.setDate(from.getDate() - 30);
      from.setHours(0, 0, 0, 0);
      return { from, to };
    }
    case "custom": {
      const from = new Date(filter.from + "T00:00:00.000Z");
      const customTo = new Date(filter.to + "T23:59:59.999Z");
      return { from, to: customTo };
    }
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function supabase() {
  return getServerSupabaseClient();
}

// =============================================================================
// Overview Metrics
// =============================================================================

export interface OverviewMetrics {
  uniqueVisitors: number;
  totalPageViews: number;
  uniqueFunnelSessions: number;
  returningSessions: number;
  diagnosticStarts: number;
  diagnosticCompletions: number;
  contactSubmissions: number;
  successfulLeads: number;
  abandonedSessions: number;
  bookingStageVisitors: number;
  confirmedAppointments: number;
  bookingConversionRate: number;
  visitorToLeadRate: number;
  leadToBookingRate: number;
}

export async function getOverviewMetrics(
  filter: DateFilter,
): Promise<OverviewMetrics> {
  const { from, to } = resolveDateRange(filter);
  const fromISO = from.toISOString();
  const toISO = to.toISOString();
  const db = supabase();

  const [
    { count: uniqueVisitors },
    { count: totalPageViews },
    { count: uniqueFunnelSessions },
    { count: diagnosticStarts },
    { count: diagnosticCompletions },
    { count: contactSubmissions },
    { count: successfulLeads },
    { count: bookingStageVisitors },
    { count: confirmedAppointments },
  ] = await Promise.all([
    db.from("funnel_sessions").select("anonymous_id", { count: "exact", head: true }).gte("started_at", fromISO).lte("started_at", toISO),
    db.from("funnel_events").select("id", { count: "exact", head: true }).eq("event_name", "page_viewed").gte("occurred_at", fromISO).lte("occurred_at", toISO),
    db.from("funnel_sessions").select("id", { count: "exact", head: true }).gte("started_at", fromISO).lte("started_at", toISO),
    db.from("funnel_events").select("id", { count: "exact", head: true }).eq("event_name", "diagnostic_started").gte("occurred_at", fromISO).lte("occurred_at", toISO),
    db.from("funnel_events").select("id", { count: "exact", head: true }).eq("event_name", "diagnostic_completed").gte("occurred_at", fromISO).lte("occurred_at", toISO),
    db.from("funnel_events").select("id", { count: "exact", head: true }).eq("event_name", "lead_created").gte("occurred_at", fromISO).lte("occurred_at", toISO),
    db.from("funnel_events").select("id", { count: "exact", head: true }).eq("event_name", "lead_created").gte("occurred_at", fromISO).lte("occurred_at", toISO),
    db.from("funnel_events").select("id", { count: "exact", head: true }).eq("event_name", "calendar_viewed").gte("occurred_at", fromISO).lte("occurred_at", toISO),
    db.from("appointments").select("id", { count: "exact", head: true }).eq("status", "confirmed").gte("created_at", fromISO).lte("created_at", toISO),
  ]);

  // Returning sessions
  const { data: currentAnonymousIds } = await db
    .from("funnel_sessions")
    .select("anonymous_id")
    .gte("started_at", fromISO)
    .lte("started_at", toISO);

  let returningSessions = 0;
  const anonRows = (currentAnonymousIds ?? []) as AnyRow[];
  if (anonRows.length > 0) {
    const anonIds = [...new Set(anonRows.map((s) => s.anonymous_id as string))];
    const { count: priorSessionCount } = await db
      .from("funnel_sessions")
      .select("id", { count: "exact", head: true })
      .in("anonymous_id", anonIds)
      .lt("started_at", fromISO);
    returningSessions = priorSessionCount ?? 0;
  }

  // Abandoned sessions
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { count: abandonedSessions } = await db
    .from("funnel_sessions")
    .select("id", { count: "exact", head: true })
    .eq("status", "active")
    .lte("last_seen_at", thirtyMinAgo)
    .gte("started_at", fromISO)
    .lte("started_at", toISO);

  const sv = uniqueVisitors ?? 0;
  const sl = successfulLeads ?? 0;
  const sa = confirmedAppointments ?? 0;
  const bs = bookingStageVisitors ?? 0;

  return {
    uniqueVisitors: sv,
    totalPageViews: totalPageViews ?? 0,
    uniqueFunnelSessions: uniqueFunnelSessions ?? 0,
    returningSessions,
    diagnosticStarts: diagnosticStarts ?? 0,
    diagnosticCompletions: diagnosticCompletions ?? 0,
    contactSubmissions: contactSubmissions ?? 0,
    successfulLeads: sl,
    abandonedSessions: abandonedSessions ?? 0,
    bookingStageVisitors: bs,
    confirmedAppointments: sa,
    bookingConversionRate: bs > 0 ? round2((sa / bs) * 100) : 0,
    visitorToLeadRate: sv > 0 ? round2((sl / sv) * 100) : 0,
    leadToBookingRate: sl > 0 ? round2((sa / sl) * 100) : 0,
  };
}

// =============================================================================
// Session List
// =============================================================================

export interface SessionRow {
  id: string;
  anonymous_id: string | null;
  started_at: string;
  last_seen_at: string;
  status: string;
  page_version: string;
  referrer: string | null;
  landing_url: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  device_category: string | null;
  lead_id: string | null;
  lead: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    status: string;
    created_at: string;
  } | null;
  appointment: {
    id: string;
    status: string;
    start_time: string;
    end_time: string;
    timezone: string;
  } | null;
  page_view_count: number;
  event_count: number;
  furthest_step: string | null;
  diagnostic_completed: boolean;
  contact_submitted: boolean;
  has_booking: boolean;
}

export type SessionSortBy =
  | "newest"
  | "oldest"
  | "most_page_views"
  | "furthest_progress"
  | "most_recent_activity";

export type SessionStatusFilter =
  | "all"
  | "abandoned"
  | "submitted"
  | "booked"
  | "completed";

export interface SessionFilters {
  dateFilter: DateFilter;
  status?: SessionStatusFilter;
  utmSource?: string;
  campaign?: string;
  device?: string;
  hasError?: boolean;
}

export interface SessionListResult {
  sessions: SessionRow[];
  total: number;
  page: number;
  pageSize: number;
}

const STEP_ORDER = [
  "page_viewed",
  "diagnostic_started",
  "question_viewed",
  "diagnostic_completed",
  "contact_step_viewed",
  "lead_created",
  "calendar_viewed",
  "time_slot_selected",
  "booking_completed",
  "confirmation_viewed",
];

function computeFurthestStep(
  events: Array<Record<string, unknown>>,
): string | null {
  let furthest = -1;
  for (const ev of events) {
    const idx = STEP_ORDER.indexOf(ev.event_name as string);
    if (idx > furthest) furthest = idx;
  }
  return furthest >= 0 ? STEP_ORDER[furthest] : null;
}

export async function getSessionList(
  filters: SessionFilters,
  sort: SessionSortBy,
  page: number,
  pageSize: number = 25,
): Promise<SessionListResult> {
  const { from, to } = resolveDateRange(filters.dateFilter);
  const fromISO = from.toISOString();
  const toISO = to.toISOString();
  const offset = (page - 1) * pageSize;
  const db = supabase();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = db
    .from("funnel_sessions")
    .select(
      "id, anonymous_id, started_at, last_seen_at, status, page_version, referrer, landing_url, utm_source, utm_medium, utm_campaign, utm_content, utm_term, device_category, lead_id, lead:leads!funnel_sessions_lead_id_fkey(id, first_name, last_name, email, phone, status, created_at), appointment:appointments(id, status, start_time, end_time, timezone)",
      { count: "exact" },
    )
    .gte("started_at", fromISO)
    .lte("started_at", toISO);

  if (filters.status === "abandoned") {
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    query = query.eq("status", "active").lte("last_seen_at", thirtyMinAgo);
  } else if (filters.status === "submitted") {
    query = query.eq("status", "lead_created");
  } else if (filters.status === "booked") {
    query = query.eq("status", "booked");
  } else if (filters.status === "completed") {
    query = query.in("status", ["lead_created", "booked"]);
  }

  if (filters.utmSource) {
    query = query.eq("utm_source", filters.utmSource);
  }
  if (filters.campaign) {
    query = query.eq("utm_campaign", filters.campaign);
  }
  if (filters.device) {
    query = query.eq("device_category", filters.device);
  }

  switch (sort) {
    case "oldest":
      query = query.order("started_at", { ascending: true });
      break;
    case "most_recent_activity":
      query = query.order("last_seen_at", { ascending: false });
      break;
    case "newest":
    default:
      query = query.order("started_at", { ascending: false });
      break;
  }

  query = query.range(offset, offset + pageSize - 1);

  const { data, count } = await query as { data: AnyRow[] | null; count: number | null };

  // Enrich with page view counts, events, and status
  const sessionIds = ((data ?? []) as AnyRow[]).map((s: AnyRow) => s.id as string);

  const pageViewCounts: Record<string, number> = {};
  const eventCounts: Record<string, number> = {};
  const furthestSteps: Record<string, string | null> = {};
  const diagnosticStatus: Record<string, boolean> = {};
  const contactStatus: Record<string, boolean> = {};
  const bookingStatus: Record<string, boolean> = {};

  if (sessionIds.length > 0) {
    const [pvResult, evResult, diagResult, contactResult, bookResult] =
      await Promise.all([
        db.from("funnel_events").select("session_id").eq("event_name", "page_viewed").in("session_id", sessionIds),
        db.from("funnel_events").select("session_id, event_name").in("session_id", sessionIds),
        db.from("funnel_events").select("session_id").eq("event_name", "diagnostic_completed").in("session_id", sessionIds),
        db.from("funnel_events").select("session_id").eq("event_name", "lead_created").in("session_id", sessionIds),
        db.from("funnel_events").select("session_id").eq("event_name", "booking_completed").in("session_id", sessionIds),
      ]);

    for (const ev of (pvResult.data ?? []) as AnyRow[]) {
      const sid = ev.session_id as string;
      pageViewCounts[sid] = (pageViewCounts[sid] ?? 0) + 1;
    }

    for (const ev of (evResult.data ?? []) as AnyRow[]) {
      const sid = ev.session_id as string;
      eventCounts[sid] = (eventCounts[sid] ?? 0) + 1;
      const eventName = ev.event_name as string;
      const idx = STEP_ORDER.indexOf(eventName);
      if (idx >= 0) {
        const current = STEP_ORDER.indexOf(furthestSteps[sid] ?? "");
        if (current < 0 || idx > current) {
          furthestSteps[sid] = eventName;
        }
      }
    }

    for (const ev of (diagResult.data ?? []) as AnyRow[]) {
      diagnosticStatus[ev.session_id as string] = true;
    }
    for (const ev of (contactResult.data ?? []) as AnyRow[]) {
      contactStatus[ev.session_id as string] = true;
    }
    for (const ev of (bookResult.data ?? []) as AnyRow[]) {
      bookingStatus[ev.session_id as string] = true;
    }
  }

  const sessions: SessionRow[] = ((data ?? []) as AnyRow[]).map((s: AnyRow) => {
    const rawLead = Array.isArray(s.lead) ? s.lead[0] ?? null : s.lead;
    const rawAppt = Array.isArray(s.appointment) ? s.appointment[0] ?? null : s.appointment;
    return {
      id: s.id as string,
      anonymous_id: s.anonymous_id as string | null,
      started_at: s.started_at as string,
      last_seen_at: s.last_seen_at as string,
      status: s.status as string,
      page_version: s.page_version as string,
      referrer: s.referrer as string | null,
      landing_url: s.landing_url as string | null,
      utm_source: s.utm_source as string | null,
      utm_medium: s.utm_medium as string | null,
      utm_campaign: s.utm_campaign as string | null,
      utm_content: s.utm_content as string | null,
      utm_term: s.utm_term as string | null,
      device_category: s.device_category as string | null,
      lead_id: s.lead_id as string | null,
      lead: rawLead ? {
        id: rawLead.id as string,
        first_name: rawLead.first_name as string,
        last_name: rawLead.last_name as string,
        email: rawLead.email as string,
        phone: rawLead.phone as string,
        status: rawLead.status as string,
        created_at: rawLead.created_at as string,
      } : null,
      appointment: rawAppt ? {
        id: rawAppt.id as string,
        status: rawAppt.status as string,
        start_time: rawAppt.start_time as string,
        end_time: rawAppt.end_time as string,
        timezone: rawAppt.timezone as string,
      } : null,
      page_view_count: pageViewCounts[s.id as string] ?? 0,
      event_count: eventCounts[s.id as string] ?? 0,
      furthest_step: furthestSteps[s.id as string] ?? null,
      diagnostic_completed: diagnosticStatus[s.id as string] ?? false,
      contact_submitted: contactStatus[s.id as string] ?? false,
      has_booking: bookingStatus[s.id as string] ?? false,
    };
  });

  return { sessions, total: count ?? 0, page, pageSize };
}

// =============================================================================
// Session Detail
// =============================================================================

export interface SessionDetail {
  session: SessionRow;
  events: Array<{
    id: string;
    event_name: string;
    occurred_at: string;
    step_id: string | null;
    question_id: string | null;
    answer_code: string | null;
    metadata: Record<string, unknown>;
    lead_id: string | null;
    duration_ms: number | null;
  }>;
  funnelPath: Array<{
    step: string;
    reached: boolean;
    timestamp: string | null;
  }>;
}

function buildFunnelPath(
  events: Array<Record<string, unknown>>,
): Array<{ step: string; reached: boolean; timestamp: string | null }> {
  const reachedMap = new Map<string, string>();
  for (const ev of events) {
    const eventName = ev.event_name as string;
    const occurredAt = ev.occurred_at as string;
    if (STEP_ORDER.includes(eventName)) {
      if (!reachedMap.has(eventName)) {
        reachedMap.set(eventName, occurredAt);
      }
    }
  }

  return STEP_ORDER.map((step) => ({
    step,
    reached: reachedMap.has(step),
    timestamp: reachedMap.get(step) ?? null,
  }));
}

export async function getSessionDetail(
  sessionId: string,
): Promise<SessionDetail | null> {
  const db = supabase();

  const { data: session, error: sessionError } = await db
    .from("funnel_sessions")
    .select("*, lead:leads!funnel_sessions_lead_id_fkey(id, first_name, last_name, email, phone, zip_code, water_feature, installation_type, pool_size, current_treatment, primary_goal, status, created_at), appointment:appointments(id, status, start_time, end_time, timezone, external_event_id, created_at)")
    .eq("id", sessionId)
    .single();

  if (sessionError || !session) return null;

  const rawSession = session as AnyRow;
  const rawLead = Array.isArray(rawSession.lead) ? rawSession.lead[0] ?? null : rawSession.lead;
  const rawAppt = Array.isArray(rawSession.appointment) ? rawSession.appointment[0] ?? null : rawSession.appointment;

  const { data: events } = await db
    .from("funnel_events")
    .select("id, event_name, occurred_at, step_id, question_id, answer_code, metadata, lead_id, duration_ms")
    .eq("session_id", sessionId)
    .order("occurred_at", { ascending: true });

  const { count: pageViewCount } = await db
    .from("funnel_events")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId)
    .eq("event_name", "page_viewed");

  const eventRows = (events ?? []) as AnyRow[];

  const enrichedSession: SessionRow = {
    id: rawSession.id as string,
    anonymous_id: rawSession.anonymous_id as string | null,
    started_at: rawSession.started_at as string,
    last_seen_at: rawSession.last_seen_at as string,
    status: rawSession.status as string,
    page_version: rawSession.page_version as string,
    referrer: rawSession.referrer as string | null,
    landing_url: rawSession.landing_url as string | null,
    utm_source: rawSession.utm_source as string | null,
    utm_medium: rawSession.utm_medium as string | null,
    utm_campaign: rawSession.utm_campaign as string | null,
    utm_content: rawSession.utm_content as string | null,
    utm_term: rawSession.utm_term as string | null,
    device_category: rawSession.device_category as string | null,
    lead_id: rawSession.lead_id as string | null,
    lead: rawLead ? {
      id: rawLead.id as string,
      first_name: rawLead.first_name as string,
      last_name: rawLead.last_name as string,
      email: rawLead.email as string,
      phone: rawLead.phone as string,
      status: rawLead.status as string,
      created_at: rawLead.created_at as string,
    } : null,
    appointment: rawAppt ? {
      id: rawAppt.id as string,
      status: rawAppt.status as string,
      start_time: rawAppt.start_time as string,
      end_time: rawAppt.end_time as string,
      timezone: rawAppt.timezone as string,
    } : null,
    page_view_count: pageViewCount ?? 0,
    event_count: eventRows.length,
    furthest_step: computeFurthestStep(eventRows),
    diagnostic_completed: eventRows.some((e) => e.event_name === "diagnostic_completed"),
    contact_submitted: eventRows.some((e) => e.event_name === "lead_created"),
    has_booking: eventRows.some((e) => e.event_name === "booking_completed"),
  };

  return {
    session: enrichedSession,
    events: eventRows.map((e) => ({
      id: e.id as string,
      event_name: e.event_name as string,
      occurred_at: e.occurred_at as string,
      step_id: e.step_id as string | null,
      question_id: e.question_id as string | null,
      answer_code: e.answer_code as string | null,
      metadata: (typeof e.metadata === "object" && e.metadata !== null ? e.metadata : {}) as Record<string, unknown>,
      lead_id: e.lead_id as string | null,
      duration_ms: e.duration_ms as number | null,
    })),
    funnelPath: buildFunnelPath(eventRows),
  };
}

// =============================================================================
// Funnel Report
// =============================================================================

export interface FunnelStage {
  name: string;
  eventName: string;
  sessionsEntering: number;
  sessionsCompleting: number;
  conversionPct: number;
  dropoff: number;
  dropoffPct: number;
}

export async function getFunnelReport(
  filter: DateFilter,
): Promise<FunnelStage[]> {
  const { from, to } = resolveDateRange(filter);
  const fromISO = from.toISOString();
  const toISO = to.toISOString();
  const db = supabase();

  const { count: totalSessions } = await db
    .from("funnel_sessions")
    .select("id", { count: "exact", head: true })
    .gte("started_at", fromISO)
    .lte("started_at", toISO);

  const total = totalSessions ?? 0;

  const stages: Array<{ name: string; eventName: string }> = [
    { name: "Page Viewed", eventName: "page_viewed" },
    { name: "Diagnostic Started", eventName: "diagnostic_started" },
    { name: "Diagnostic Completed", eventName: "diagnostic_completed" },
    { name: "Contact Viewed", eventName: "contact_step_viewed" },
    { name: "Lead Created", eventName: "lead_created" },
    { name: "Booking Viewed", eventName: "calendar_viewed" },
    { name: "Slot Selected", eventName: "time_slot_selected" },
    { name: "Booking Completed", eventName: "booking_completed" },
    { name: "Confirmation Viewed", eventName: "confirmation_viewed" },
  ];

  const results: FunnelStage[] = [];

  for (let i = 0; i < stages.length; i++) {
    const stage = stages[i];

    const { count: completingCount } = await db
      .from("funnel_events")
      .select("session_id", { count: "exact", head: true })
      .eq("event_name", stage.eventName)
      .gte("occurred_at", fromISO)
      .lte("occurred_at", toISO);

    const completing = completingCount ?? 0;
    const entering = i === 0 ? total : (results[i - 1]?.sessionsCompleting ?? 0);
    const conversionPct =
      entering > 0 ? round2((completing / entering) * 100) : 0;
    const dropoff = entering - completing;
    const dropoffPct =
      entering > 0 ? round2((dropoff / entering) * 100) : 0;

    results.push({
      name: stage.name,
      eventName: stage.eventName,
      sessionsEntering: entering,
      sessionsCompleting: completing,
      conversionPct,
      dropoff,
      dropoffPct,
    });
  }

  return results;
}

// =============================================================================
// Leads List
// =============================================================================

export interface LeadRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  status: string;
  source: string | null;
  stage: string | null;
  lead_origin: string;
  view_count: number;
  created_at: string;
  diagnostic_completed: boolean;
  appointment_status: string | null;
  water_feature: string;
  installation_type: string;
  pool_size: string;
  current_treatment: string;
  primary_goal: string;
  current_issues: string[];
}

export interface LeadDetail extends LeadRow {
  last_name: string;
  zip_code: string;
  water_feature: string;
  installation_type: string;
  pool_size: string;
  current_treatment: string;
  current_issues: string[];
  primary_goal: string;
  qualification_summary: string | null;
  consent_to_contact: boolean;
  consent_to_contact_at: string | null;
  marketing_consent: boolean;
  source: string | null;
  session_id: string | null;
}

export async function getLeadsList(
  filter: DateFilter,
  page: number,
  pageSize: number = 25,
): Promise<{ leads: LeadRow[]; total: number; page: number; pageSize: number }> {
  const { from, to } = resolveDateRange(filter);
  const fromISO = from.toISOString();
  const toISO = to.toISOString();
  const offset = (page - 1) * pageSize;
  const db = supabase();

  const { data, count } = await db
    .from("leads")
    .select("id, first_name, last_name, email, phone, status, source, stage, lead_origin, created_at, session_id, water_feature, installation_type, pool_size, current_treatment, primary_goal", { count: "exact" })
    .gte("created_at", fromISO)
    .lte("created_at", toISO)
    .order("created_at", { ascending: false })
    .range(offset, offset + pageSize - 1) as { data: AnyRow[] | null; count: number | null };

  // Get appointment statuses for these leads
  const leadIds = ((data ?? []) as AnyRow[]).map((l: AnyRow) => l.id as string);
  const appointmentStatuses: Record<string, string> = {};

  // Get funnel view counts for each lead's session
  const sessionIds = ((data ?? []) as AnyRow[]).map(
    (l: AnyRow) => l.session_id as string | null,
  );
  const viewCounts: Record<string, number> = {};

  // Get current-issues answers (multi-select, stored in lead_answers)
  const issuesByLead: Record<string, string[]> = {};

  if (leadIds.length > 0) {
    const apptPromise = db
      .from("appointments")
      .select("lead_id, status")
      .in("lead_id", leadIds);

    const viewPromise = sessionIds.some(Boolean)
      ? db
          .from("funnel_events")
          .select("session_id")
          .eq("event_name", "page_viewed")
          .in(
            "session_id",
            sessionIds.filter((s): s is string => Boolean(s)),
          )
      : Promise.resolve({ data: [] });

    const issuesPromise = db
      .from("lead_answers")
      .select("lead_id, answer_code")
      .eq("question_id", "current-issues")
      .in("lead_id", leadIds);

    const [apptResult, viewResult, issuesResult] = await Promise.all([
      apptPromise,
      viewPromise,
      issuesPromise,
    ]);

    for (const a of (apptResult.data ?? []) as AnyRow[]) {
      appointmentStatuses[a.lead_id as string] = a.status as string;
    }
    for (const ev of (viewResult.data ?? []) as AnyRow[]) {
      const sid = ev.session_id as string;
      viewCounts[sid] = (viewCounts[sid] ?? 0) + 1;
    }
    for (const ans of (issuesResult.data ?? []) as AnyRow[]) {
      const lid = ans.lead_id as string;
      const code = ans.answer_code as string;
      if (!issuesByLead[lid]) issuesByLead[lid] = [];
      issuesByLead[lid].push(code);
    }
  }

  const leads: LeadRow[] = ((data ?? []) as AnyRow[]).map((l: AnyRow) => ({
    id: l.id as string,
    first_name: l.first_name as string,
    last_name: l.last_name as string,
    email: l.email as string,
    phone: (l.phone as string) ?? "",
    status: l.status as string,
    source: l.source as string | null,
    stage: l.stage as string | null,
    lead_origin: l.lead_origin as string ?? "funnel",
    view_count: (l.session_id ? (viewCounts[l.session_id as string] ?? 0) : 0),
    created_at: l.created_at as string,
    diagnostic_completed: true,
    appointment_status: appointmentStatuses[l.id as string] ?? null,
    water_feature: (l.water_feature as string) ?? "",
    installation_type: (l.installation_type as string) ?? "",
    pool_size: (l.pool_size as string) ?? "",
    current_treatment: (l.current_treatment as string) ?? "",
    primary_goal: (l.primary_goal as string) ?? "",
    current_issues: issuesByLead[l.id as string] ?? [],
  }));

  return { leads, total: count ?? 0, page, pageSize };
}

export async function getLeadDetail(leadId: string): Promise<LeadDetail | null> {
  const db = supabase();

  const { data, error } = await db
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .single();

  if (error || !data) return null;

  const raw = data as AnyRow;

  const { data: answers } = await db
    .from("lead_answers")
    .select("answer_code")
    .eq("lead_id", leadId)
    .eq("question_id", "current-issues");

  const currentIssues: string[] = ((answers ?? []) as AnyRow[]).map(
    (a: AnyRow) => a.answer_code as string,
  );

  const { data: apptData } = await db
    .from("appointments")
    .select("status")
    .eq("lead_id", leadId)
    .maybeSingle();

  const appointmentStatus = apptData
    ? (apptData as AnyRow).status as string
    : null;

  let viewCount = 0;
  if (raw.session_id) {
    const { count } = await db
      .from("funnel_events")
      .select("id", { count: "exact", head: true })
      .eq("session_id", raw.session_id as string)
      .eq("event_name", "page_viewed");
    viewCount = count ?? 0;
  }

  return {
    id: raw.id as string,
    first_name: raw.first_name as string,
    last_name: raw.last_name as string,
    email: raw.email as string,
    phone: (raw.phone as string) ?? "",
    zip_code: (raw.zip_code as string) ?? "",
    water_feature: (raw.water_feature as string) ?? "",
    installation_type: (raw.installation_type as string) ?? "",
    pool_size: (raw.pool_size as string) ?? "",
    current_treatment: (raw.current_treatment as string) ?? "",
    current_issues: currentIssues,
    primary_goal: (raw.primary_goal as string) ?? "",
    qualification_summary: raw.qualification_summary as string | null,
    status: raw.status as string,
    stage: raw.stage as string | null,
    source: raw.source as string | null,
    lead_origin: (raw.lead_origin as string) ?? "funnel",
    view_count: viewCount,
    created_at: raw.created_at as string,
    diagnostic_completed: true,
    appointment_status: appointmentStatus,
    consent_to_contact: raw.consent_to_contact as boolean,
    consent_to_contact_at: raw.consent_to_contact_at as string | null,
    marketing_consent: raw.marketing_consent as boolean,
    session_id: raw.session_id as string | null,
  };
}

// =============================================================================
// Lead Stage Update
// =============================================================================

export async function updateLeadStage(
  leadId: string,
  stage: LeadStage | null,
): Promise<boolean> {
  const { error } = await supabase()
    .from("leads")
    .update({ stage } as never)
    .eq("id", leadId);
  return !error;
}

// =============================================================================
// Appointments List
// =============================================================================

export interface AppointmentRow {
  id: string;
  lead_id: string;
  lead_name: string;
  lead_email: string;
  start_time: string;
  end_time: string;
  timezone: string;
  status: string;
  google_calendar_status: string | null;
  customer_email_status: string | null;
  internal_email_status: string | null;
  safe_error_code: string | null;
  created_at: string;
  updated_at: string;
}

export async function getAppointmentsList(
  filter: DateFilter,
  page: number,
  pageSize: number = 25,
): Promise<{ appointments: AppointmentRow[]; total: number; page: number; pageSize: number }> {
  const { from, to } = resolveDateRange(filter);
  const fromISO = from.toISOString();
  const toISO = to.toISOString();
  const offset = (page - 1) * pageSize;
  const db = supabase();

  const { data, count } = await db
    .from("appointments")
    .select("id, lead_id, start_time, end_time, timezone, status, created_at, updated_at", { count: "exact" })
    .gte("created_at", fromISO)
    .lte("created_at", toISO)
    .order("created_at", { ascending: false })
    .range(offset, offset + pageSize - 1) as { data: AnyRow[] | null; count: number | null };

  const apptIds = ((data ?? []) as AnyRow[]).map((a: AnyRow) => a.id as string);
  const leadIds = ((data ?? []) as AnyRow[]).map((a: AnyRow) => a.lead_id as string);

  const leadNames: Record<string, { name: string; email: string }> = {};
  const deliveryMap: Record<string, AnyRow[]> = {};

  if (apptIds.length > 0) {
    const [leadsResult, deliveriesResult] = await Promise.all([
      db.from("leads").select("id, first_name, last_name, email").in("id", leadIds),
      db.from("integration_deliveries").select("appointment_id, destination, status, error_message").in("appointment_id", apptIds),
    ]);

    for (const l of (leadsResult.data ?? []) as AnyRow[]) {
      leadNames[l.id as string] = {
        name: `${l.first_name as string} ${l.last_name as string}`,
        email: l.email as string,
      };
    }

    for (const d of (deliveriesResult.data ?? []) as AnyRow[]) {
      const apptId = d.appointment_id as string;
      if (!deliveryMap[apptId]) deliveryMap[apptId] = [];
      deliveryMap[apptId].push(d);
    }
  }

  const appointments: AppointmentRow[] = ((data ?? []) as AnyRow[]).map((a: AnyRow) => {
    const apptId = a.id as string;
    const deliveries = deliveryMap[apptId] ?? [];
    const gcDelivery = deliveries.find((d) => d.destination === "google_calendar");
    const custEmail = deliveries.find((d) => d.destination === "email" && d.status === "delivered" && d.error_message === null);
    const intEmail = deliveries.find((d) => d.destination === "email" && d.event_type === "internal_booking_notification");
    const failedDelivery = deliveries.find((d) => d.status === "failed" || d.status === "dead_letter");
    const leadInfo = leadNames[a.lead_id as string];

    return {
      id: apptId,
      lead_id: a.lead_id as string,
      lead_name: leadInfo?.name ?? "Unknown",
      lead_email: leadInfo?.email ?? "",
      start_time: a.start_time as string,
      end_time: a.end_time as string,
      timezone: a.timezone as string,
      status: a.status as string,
      google_calendar_status: gcDelivery?.status as string ?? null,
      customer_email_status: custEmail?.status as string ?? null,
      internal_email_status: intEmail?.status as string ?? null,
      safe_error_code: failedDelivery?.error_message as string ?? null,
      created_at: a.created_at as string,
      updated_at: a.updated_at as string,
    };
  });

  return { appointments, total: count ?? 0, page, pageSize };
}

// =============================================================================
// Appointment Stage Update
// =============================================================================

export async function updateAppointmentStatus(
  appointmentId: string,
  status: AppointmentStage,
): Promise<boolean> {
  const { error } = await supabase()
    .from("appointments")
    .update({ status } as never)
    .eq("id", appointmentId);
  return !error;
}

// =============================================================================
// Integration Health
// =============================================================================

export interface IntegrationHealthMetrics {
  googleCalendarDelivered: number;
  googleCalendarFailed: number;
  customerEmailDelivered: number;
  customerEmailFailed: number;
  internalEmailDelivered: number;
  internalEmailFailed: number;
  pendingDeliveries: number;
  deadLetterDeliveries: number;
  recentFailures: Array<{
    id: string;
    destination: string;
    event_type: string;
    status: string;
    error_message: string | null;
    created_at: string;
    appointment_id: string | null;
  }>;
}

export async function getIntegrationHealth(
  filter: DateFilter,
): Promise<IntegrationHealthMetrics> {
  const { from, to } = resolveDateRange(filter);
  const fromISO = from.toISOString();
  const toISO = to.toISOString();
  const db = supabase();

  const [
    { count: gcDelivered },
    { count: gcFailed },
    { count: custDelivered },
    { count: custFailed },
    { count: intDelivered },
    { count: intFailed },
    { count: pending },
    { count: deadLetter },
  ] = await Promise.all([
    db.from("integration_deliveries").select("id", { count: "exact", head: true }).eq("destination", "google_calendar").eq("status", "delivered").gte("created_at", fromISO).lte("created_at", toISO),
    db.from("integration_deliveries").select("id", { count: "exact", head: true }).eq("destination", "google_calendar").in("status", ["failed", "dead_letter"]).gte("created_at", fromISO).lte("created_at", toISO),
    db.from("integration_deliveries").select("id", { count: "exact", head: true }).eq("destination", "email").eq("event_type", "booking_confirmation").eq("status", "delivered").gte("created_at", fromISO).lte("created_at", toISO),
    db.from("integration_deliveries").select("id", { count: "exact", head: true }).eq("destination", "email").eq("event_type", "booking_confirmation").in("status", ["failed", "dead_letter"]).gte("created_at", fromISO).lte("created_at", toISO),
    db.from("integration_deliveries").select("id", { count: "exact", head: true }).eq("destination", "email").eq("event_type", "internal_booking_notification").eq("status", "delivered").gte("created_at", fromISO).lte("created_at", toISO),
    db.from("integration_deliveries").select("id", { count: "exact", head: true }).eq("destination", "email").eq("event_type", "internal_booking_notification").in("status", ["failed", "dead_letter"]).gte("created_at", fromISO).lte("created_at", toISO),
    db.from("integration_deliveries").select("id", { count: "exact", head: true }).in("status", ["pending", "processing", "retrying"]).gte("created_at", fromISO).lte("created_at", toISO),
    db.from("integration_deliveries").select("id", { count: "exact", head: true }).eq("status", "dead_letter").gte("created_at", fromISO).lte("created_at", toISO),
  ]);

  const { data: recentFailures } = await db
    .from("integration_deliveries")
    .select("id, destination, event_type, status, error_message, created_at, appointment_id")
    .in("status", ["failed", "dead_letter"])
    .gte("created_at", fromISO)
    .lte("created_at", toISO)
    .order("created_at", { ascending: false })
    .limit(20);

  return {
    googleCalendarDelivered: gcDelivered ?? 0,
    googleCalendarFailed: gcFailed ?? 0,
    customerEmailDelivered: custDelivered ?? 0,
    customerEmailFailed: custFailed ?? 0,
    internalEmailDelivered: intDelivered ?? 0,
    internalEmailFailed: intFailed ?? 0,
    pendingDeliveries: pending ?? 0,
    deadLetterDeliveries: deadLetter ?? 0,
    recentFailures: ((recentFailures ?? []) as AnyRow[]).map((f) => ({
      id: f.id as string,
      destination: f.destination as string,
      event_type: f.event_type as string,
      status: f.status as string,
      error_message: f.error_message as string | null,
      created_at: f.created_at as string,
      appointment_id: f.appointment_id as string | null,
    })),
  };
}

// =============================================================================
// CSV Export Helpers
// =============================================================================

function escapeCsvValue(value: unknown): string {
  const str = value == null ? "" : String(value);
  // Prevent formula injection
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function toCsv(rows: Record<string, unknown>[], columns: string[]): string {
  const header = columns.map(escapeCsvValue).join(",");
  const body = rows
    .map((row) =>
      columns.map((col) => escapeCsvValue(row[col])).join(","),
    )
    .join("\n");
  return `${header}\n${body}\n`;
}

export async function exportSessionsCsv(
  filter: DateFilter,
): Promise<string> {
  const result = await getSessionList({ dateFilter: filter }, "newest", 1, 10000);
  const columns = [
    "id",
    "anonymous_id",
    "started_at",
    "last_seen_at",
    "status",
    "page_view_count",
    "furthest_step",
    "diagnostic_completed",
    "contact_submitted",
    "has_booking",
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "device_category",
    "referrer",
  ];
  return toCsv(
    result.sessions.map((s) => ({
      ...s,
      diagnostic_completed: s.diagnostic_completed ? "Yes" : "No",
      contact_submitted: s.contact_submitted ? "Yes" : "No",
      has_booking: s.has_booking ? "Yes" : "No",
    })),
    columns,
  );
}

export async function exportLeadsCsv(filter: DateFilter): Promise<string> {
  const result = await getLeadsList(filter, 1, 10000);
  const columns = [
    "id",
    "first_name",
    "last_name",
    "email",
    "phone",
    "status",
    "source",
    "stage",
    "lead_origin",
    "water_feature",
    "installation_type",
    "pool_size",
    "current_treatment",
    "primary_goal",
    "current_issues",
    "view_count",
    "appointment_status",
    "created_at",
  ];
  return toCsv(
    result.leads.map((l) => ({
      ...l,
      current_issues: l.current_issues.join("; "),
    })),
    columns,
  );
}

export async function exportAppointmentsCsv(
  filter: DateFilter,
): Promise<string> {
  const result = await getAppointmentsList(filter, 1, 10000);
  const columns = [
    "id",
    "lead_name",
    "lead_email",
    "start_time",
    "end_time",
    "timezone",
    "status",
    "google_calendar_status",
    "customer_email_status",
    "internal_email_status",
    "safe_error_code",
    "created_at",
  ];
  return toCsv(
    result.appointments.map((a) => ({
      ...a,
      lead_email: a.lead_email
        ? `${a.lead_email.substring(0, 3)}***@***`
        : "",
    })),
    columns,
  );
}
