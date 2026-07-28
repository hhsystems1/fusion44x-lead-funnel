import { Suspense } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getLeadDetail } from "@/lib/admin/queries";
import { StatusBadge } from "../../metric-card";
import { formatDateTime } from "../../utils";

async function LeadDetailContent({ leadId }: { leadId: string }) {
  const lead = await getLeadDetail(leadId);
  if (!lead) notFound();

  return (
    <div className="space-y-6">
      <Link
        href="/admin/leads"
        className="text-sm text-gray-500 hover:text-gray-700"
      >
        ← Back to leads
      </Link>

      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold text-gray-900">
          {lead.first_name} {lead.last_name}
        </h1>
        <StatusBadge status={lead.status} />
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4 grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
        <div>
          <p className="text-xs text-gray-500">Email</p>
          <p>{lead.email}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Phone</p>
          <p>{lead.phone}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Zip Code</p>
          <p>{lead.zip_code}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Created</p>
          <p>{formatDateTime(lead.created_at)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Appointment</p>
          {lead.appointment_status ? (
            <StatusBadge status={lead.appointment_status} />
          ) : (
            <span className="text-gray-400">None</span>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">
          Diagnostic Answers
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-xs text-gray-500">Water Feature</p>
            <p>{lead.water_feature}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Installation Type</p>
            <p>{lead.installation_type}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Pool Size</p>
            <p>{lead.pool_size}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Current Treatment</p>
            <p>{lead.current_treatment}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Primary Goal</p>
            <p>{lead.primary_goal}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Consent</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-xs text-gray-500">Consent to Contact</p>
            <p>{lead.consent_to_contact ? "Yes" : "No"}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Marketing Consent</p>
            <p>{lead.marketing_consent ? "Yes" : "No"}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Source</p>
            <p>{lead.source ?? "—"}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <Suspense
      fallback={
        <div className="text-center py-12 text-gray-500">Loading lead...</div>
      }
    >
      <LeadDetailContent leadId={id} />
    </Suspense>
  );
}
