import { Suspense } from "react";
import { DateFilter } from "../date-filter";
import { getFunnelReport, type DateFilter as DF } from "@/lib/admin/queries";
import { parseFilterParams } from "../utils";

async function FunnelTable({ filter }: { filter: DF }) {
  const stages = await getFunnelReport(filter);

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left px-4 py-3 font-medium text-gray-600">
                Stage
              </th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">
                Sessions Entering
              </th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">
                Completing
              </th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">
                Conversion %
              </th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">
                Drop-off
              </th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">
                Drop-off %
              </th>
            </tr>
          </thead>
          <tbody>
            {stages.map((stage, i) => (
              <tr
                key={stage.eventName}
                className="border-b border-gray-100 last:border-0"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-1 h-6 rounded-full"
                      style={{
                        backgroundColor: `hsl(${180 + i * 20}, 60%, 40%)`,
                      }}
                    />
                    <span className="font-medium text-gray-900">
                      {stage.name}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-right text-gray-600">
                  {stage.sessionsEntering}
                </td>
                <td className="px-4 py-3 text-right text-gray-600">
                  {stage.sessionsCompleting}
                </td>
                <td className="px-4 py-3 text-right">
                  <span
                    className={`font-medium ${
                      stage.conversionPct >= 80
                        ? "text-green-600"
                        : stage.conversionPct >= 50
                          ? "text-yellow-600"
                          : "text-red-600"
                    }`}
                  >
                    {stage.conversionPct}%
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-gray-600">
                  {stage.dropoff}
                </td>
                <td className="px-4 py-3 text-right text-gray-600">
                  {stage.dropoffPct}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default async function FunnelPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const filter = parseFilterParams(params);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Funnel Report</h1>
        <Suspense>
          <DateFilter />
        </Suspense>
      </div>
      <Suspense
        fallback={
          <div className="text-center py-12 text-gray-500">
            Loading funnel data...
          </div>
        }
      >
        <FunnelTable filter={filter} />
      </Suspense>
    </div>
  );
}
