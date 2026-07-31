import { Suspense } from "react";
import Link from "next/link";
import { DateFilter } from "../date-filter";
import { StatusBadge } from "../metric-card";
import { TagPill } from "@/components/admin/tag-pill";
import { LeadStageSelect } from "@/components/admin/lead-stage-select";
import {
  getLeadsList,
  type DateFilter as DF,
} from "@/lib/admin/queries";
import { parseFilterParams, formatDateTime, maskEmail, maskPhone } from "../utils";
import { answerLabel } from "@/lib/funnel/answer-labels";

async function LeadsTable({
  filter,
  page,
}: {
  filter: DF;
  page: number;
}) {
  const result = await getLeadsList(filter, page, 25);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>{result.total} leads found</span>
        <span>
          Page {result.page} of {Math.max(1, Math.ceil(result.total / 25))}
        </span>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Lead ID
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Name
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Email
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Phone
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Diagnostic
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Tags
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Stage
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Appointment
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Created
                </th>
              </tr>
            </thead>
            <tbody>
              {result.leads.map((l) => (
                <tr
                  key={l.id}
                  className="border-b border-gray-100 last:border-0 hover:bg-gray-50"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/leads/${l.id}`}
                      className="font-mono text-xs text-brand-aqua hover:underline"
                    >
                      {l.id.substring(0, 8)}...
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-900">{l.first_name}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {maskEmail(l.email)}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {maskPhone(l.phone)}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {answerLabel("current-treatment", l.current_treatment)}
                    {l.primary_goal
                      ? ` · ${answerLabel("primary-goal", l.primary_goal)}`
                      : ""}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      <TagPill label={l.status} />
                      <TagPill label={l.source ?? "direct"} tone="aqua" />
                      <TagPill
                        label={`${l.view_count} view${l.view_count === 1 ? "" : "s"}`}
                        tone="muted"
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <LeadStageSelect leadId={l.id} value={l.stage} />
                  </td>
                  <td className="px-4 py-3">
                    {l.appointment_status ? (
                      <StatusBadge status={l.appointment_status} />
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                    {formatDateTime(l.created_at)}
                  </td>
                </tr>
              ))}
              {result.leads.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-8 text-center text-gray-500"
                  >
                    No leads found for this date range.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const filter = parseFilterParams(params);
  const page = Math.max(1, Number(params.page) || 1);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Leads</h1>
        <Suspense>
          <DateFilter />
        </Suspense>
      </div>
      <Suspense
        fallback={
          <div className="text-center py-12 text-gray-500">Loading leads...</div>
        }
      >
        <LeadsTable filter={filter} page={page} />
      </Suspense>
    </div>
  );
}
