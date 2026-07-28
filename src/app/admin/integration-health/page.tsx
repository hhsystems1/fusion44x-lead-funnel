import { Suspense } from "react";
import { DateFilter } from "../date-filter";
import { MetricCard, StatusBadge } from "../metric-card";
import {
  getIntegrationHealth,
  type DateFilter as DF,
} from "@/lib/admin/queries";
import { parseFilterParams, formatDateTime } from "../utils";

async function IntegrationContent({ filter }: { filter: DF }) {
  const health = await getIntegrationHealth(filter);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label="Google Calendar Delivered"
          value={health.googleCalendarDelivered}
        />
        <MetricCard
          label="Google Calendar Failed"
          value={health.googleCalendarFailed}
          accent={health.googleCalendarFailed > 0}
        />
        <MetricCard
          label="Customer Email Delivered"
          value={health.customerEmailDelivered}
        />
        <MetricCard
          label="Customer Email Failed"
          value={health.customerEmailFailed}
          accent={health.customerEmailFailed > 0}
        />
        <MetricCard
          label="Internal Email Delivered"
          value={health.internalEmailDelivered}
        />
        <MetricCard
          label="Internal Email Failed"
          value={health.internalEmailFailed}
          accent={health.internalEmailFailed > 0}
        />
        <MetricCard
          label="Pending Deliveries"
          value={health.pendingDeliveries}
          accent={health.pendingDeliveries > 0}
        />
        <MetricCard
          label="Dead Letter"
          value={health.deadLetterDeliveries}
          accent={health.deadLetterDeliveries > 0}
        />
      </div>

      {health.recentFailures.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
            <h2 className="text-sm font-semibold text-gray-900">
              Recent Failures
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left px-4 py-2 font-medium text-gray-600">
                    Destination
                  </th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">
                    Event Type
                  </th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">
                    Status
                  </th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">
                    Error
                  </th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody>
                {health.recentFailures.map((f) => (
                  <tr
                    key={f.id}
                    className="border-b border-gray-100 last:border-0"
                  >
                    <td className="px-4 py-2">{f.destination}</td>
                    <td className="px-4 py-2 text-gray-600">{f.event_type}</td>
                    <td className="px-4 py-2">
                      <StatusBadge status={f.status} variant="error" />
                    </td>
                    <td className="px-4 py-2 text-gray-600 font-mono text-xs">
                      {f.error_message ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-gray-600 whitespace-nowrap">
                      {formatDateTime(f.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {health.recentFailures.length === 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
          No recent failures. All integrations operating normally.
        </div>
      )}
    </div>
  );
}

export default async function IntegrationHealthPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const filter = parseFilterParams(params);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">
          Integration Health
        </h1>
        <Suspense>
          <DateFilter />
        </Suspense>
      </div>
      <Suspense
        fallback={
          <div className="text-center py-12 text-gray-500">
            Loading integration data...
          </div>
        }
      >
        <IntegrationContent filter={filter} />
      </Suspense>
    </div>
  );
}
