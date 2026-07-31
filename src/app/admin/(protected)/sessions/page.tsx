import { Suspense } from "react";
import Link from "next/link";
import { DateFilter } from "../date-filter";
import { StatusBadge } from "../metric-card";
import {
  getSessionList,
  type DateFilter as DF,
  type SessionSortBy,
} from "@/lib/admin/queries";
import { parseFilterParams, formatDateTime, stepLabel } from "../utils";

async function SessionTable({
  filter,
  sort,
  page,
}: {
  filter: DF;
  sort: SessionSortBy;
  page: number;
}) {
  const result = await getSessionList({ dateFilter: filter }, sort, page, 25);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>{result.total} sessions found</span>
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
                  Session
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Status
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Started
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Views
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Furthest Step
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Source
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Device
                </th>
              </tr>
            </thead>
            <tbody>
              {result.sessions.map((s) => (
                <tr
                  key={s.id}
                  className="border-b border-gray-100 last:border-0 hover:bg-gray-50"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/sessions/${s.id}`}
                      className="font-mono text-xs text-brand-aqua hover:underline"
                    >
                      {s.id.substring(0, 8)}...
                    </Link>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {s.anonymous_id
                        ? s.anonymous_id.substring(0, 16) + "..."
                        : "—"}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={s.status} />
                  </td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                    {formatDateTime(s.started_at)}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{s.page_view_count}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {stepLabel(s.furthest_step)}
                  </td>
                  <td className="px-4 py-3 text-gray-600 max-w-[120px] truncate">
                    {s.utm_source ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {s.device_category ?? "—"}
                  </td>
                </tr>
              ))}
              {result.sessions.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-gray-500"
                  >
                    No sessions found for this date range.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {result.total > 25 && (
        <div className="flex items-center justify-center gap-2">
          {page > 1 && (
            <Link
              href={`?filter=${filter.type === "custom" ? "custom" : filter.type}${filter.type === "custom" ? `&from=${filter.from}&to=${filter.to}` : ""}&sort=${sort}&page=${page - 1}`}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-md hover:bg-gray-50"
            >
              Previous
            </Link>
          )}
          {page < Math.ceil(result.total / 25) && (
            <Link
              href={`?filter=${filter.type === "custom" ? "custom" : filter.type}${filter.type === "custom" ? `&from=${filter.from}&to=${filter.to}` : ""}&sort=${sort}&page=${page + 1}`}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-md hover:bg-gray-50"
            >
              Next
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

export default async function SessionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const filter = parseFilterParams(params);
  const sort = (params.sort as SessionSortBy) ?? "newest";
  const page = Math.max(1, Number(params.page) || 1);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Sessions</h1>
        <Suspense>
          <DateFilter />
        </Suspense>
      </div>
      <Suspense
        fallback={
          <div className="text-center py-12 text-gray-500">Loading sessions...</div>
        }
      >
        <SessionTable filter={filter} sort={sort} page={page} />
      </Suspense>
    </div>
  );
}
