import { notFound } from "next/navigation";
import Link from "next/link";
import { getSessionDetail } from "@/lib/admin/queries";
import { Suspense } from "react";
import { StatusBadge } from "../../metric-card";
import {
  formatDateTime,
  formatTimezoneLabel,
  stepLabel,
} from "../../utils";

async function SessionDetailContent({ sessionId }: { sessionId: string }) {
  const detail = await getSessionDetail(sessionId);
  if (!detail) notFound();

  const { session, events, funnelPath } = detail;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/admin/sessions"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← Back to sessions
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold text-gray-900">
          Session {session.id.substring(0, 8)}...
        </h1>
        <StatusBadge status={session.status} />
      </div>

      {/* Session Info */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <p className="text-xs text-gray-500">Anonymous ID</p>
          <p className="font-mono text-xs mt-0.5">
            {session.anonymous_id ?? "—"}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500">First Seen</p>
          <p>{formatDateTime(session.started_at)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Last Seen</p>
          <p>{formatDateTime(session.last_seen_at)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Page Views</p>
          <p>{session.page_view_count}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Device</p>
          <p>{session.device_category ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">UTM Source</p>
          <p>{session.utm_source ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Campaign</p>
          <p>{session.utm_campaign ?? "—"}</p>
        </div>
      </div>

      {/* Funnel Path */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">
          Funnel Path
        </h2>
        <div className="space-y-2">
          {funnelPath.map((step, i) => (
            <div key={step.step} className="flex items-center gap-3">
              <div
                className={`w-3 h-3 rounded-full shrink-0 ${
                  step.reached ? "bg-green-500" : "bg-gray-200"
                }`}
              />
              <span
                className={`text-sm ${
                  step.reached ? "text-gray-900" : "text-gray-400"
                }`}
              >
                {stepLabel(step.step)}
              </span>
              {step.timestamp && (
                <span className="text-xs text-gray-400 ml-auto">
                  {formatDateTime(step.timestamp)}
                </span>
              )}
              {i < funnelPath.length - 1 && (
                <span className="text-gray-300 ml-1">→</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Lead Info (if exists) */}
      {session.lead && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">
            Lead Information
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs text-gray-500">Name</p>
              <p>
                {session.lead.first_name}{" "}
                {session.lead.last_name}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Email</p>
              <p>{session.lead.email}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Phone</p>
              <p>{session.lead.phone}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Status</p>
              <StatusBadge status={session.lead.status} />
            </div>
            <div>
              <p className="text-xs text-gray-500">Created</p>
              <p>{formatDateTime(session.lead.created_at)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Appointment Info (if exists) */}
      {session.appointment && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">
            Appointment
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs text-gray-500">Status</p>
              <StatusBadge status={session.appointment.status} />
            </div>
            <div>
              <p className="text-xs text-gray-500">Start Time</p>
              <p>{formatDateTime(session.appointment.start_time)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">End Time</p>
              <p>{formatDateTime(session.appointment.end_time)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Timezone</p>
              <p>{formatTimezoneLabel(session.appointment.timezone)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Event Timeline */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">
          Event Timeline ({events.length} events)
        </h2>
        <div className="space-y-1">
          {events.map((ev) => (
            <div
              key={ev.id}
              className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0"
            >
              <div className="w-2 h-2 rounded-full bg-brand-aqua mt-1.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">
                    {ev.event_name}
                  </span>
                  {ev.question_id && (
                    <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                      {ev.question_id}
                    </span>
                  )}
                  {ev.answer_code && (
                    <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                      → {ev.answer_code}
                    </span>
                  )}
                </div>
                {Object.keys(ev.metadata).length > 0 && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    {JSON.stringify(ev.metadata)}
                  </p>
                )}
              </div>
              <span className="text-xs text-gray-400 whitespace-nowrap">
                {formatDateTime(ev.occurred_at)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <Suspense
      fallback={
        <div className="text-center py-12 text-gray-500">Loading session...</div>
      }
    >
      <SessionDetailContent sessionId={id} />
    </Suspense>
  );
}
