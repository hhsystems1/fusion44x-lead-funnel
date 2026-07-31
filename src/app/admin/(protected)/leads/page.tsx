import { Suspense } from "react";
import Link from "next/link";
import { DateFilter } from "../date-filter";
import { StatusBadge } from "../metric-card";
import { TagPill } from "@/components/admin/tag-pill";
import { LeadStageSelect } from "@/components/admin/lead-stage-select";
import {
  getLeadsList,
  type DateFilter as DF,
  type LeadRow,
} from "@/lib/admin/queries";
import { parseFilterParams, formatDateTime } from "../utils";
import { answerLabel, answerLabels } from "@/lib/funnel/answer-labels";

function DiagnosticSummary({ lead }: { lead: LeadRow }) {
  const hasDiagnostic =
    lead.water_feature ||
    lead.installation_type ||
    lead.pool_size ||
    lead.current_treatment ||
    lead.primary_goal ||
    lead.current_issues.length > 0;

  if (!hasDiagnostic) {
    return <span className="text-gray-400">No diagnostic yet</span>;
  }

  const setup = [
    answerLabel("water-feature", lead.water_feature),
    answerLabel("installation-type", lead.installation_type),
    answerLabel("pool-size", lead.pool_size),
  ].filter((value) => value !== "—");

  const treatment = answerLabel("current-treatment", lead.current_treatment);
  const goal = answerLabel("primary-goal", lead.primary_goal);
  const issues = answerLabels("current-issues", lead.current_issues);

  return (
    <div className="text-xs text-gray-600 space-y-0.5">
      {setup.length > 0 && <div>{setup.join(" · ")}</div>}
      {treatment !== "—" && <div>{treatment}</div>}
      {goal !== "—" && <div>{goal}</div>}
      {issues.length > 0 && <div>{issues.join(", ")}</div>}
    </div>
  );
}

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
                  Lead
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Diagnostic
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Source
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
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/admin/leads/${l.id}`}
                        className="font-medium text-brand-aqua hover:underline"
                      >
                        {l.first_name} {l.last_name}
                      </Link>
                      <StatusBadge status={l.status} />
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">{l.email}</div>
                    <div className="text-xs text-gray-500">
                      {l.phone || "No phone"}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <DiagnosticSummary lead={l} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col items-start gap-1">
                      <TagPill label={l.source ?? "direct"} tone="aqua" />
                      <span className="text-xs text-gray-500">
                        {l.view_count} view{l.view_count === 1 ? "" : "s"}
                      </span>
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
                    colSpan={6}
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
