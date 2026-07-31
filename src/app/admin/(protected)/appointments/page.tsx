import { Suspense } from "react";
import { DateFilter } from "../date-filter";
import { StatusBadge } from "../metric-card";
import { AppointmentStageSelect } from "@/components/admin/appointment-stage-select";
import {
  getAppointmentsList,
  type DateFilter as DF,
} from "@/lib/admin/queries";
import { parseFilterParams, formatDateTime } from "../utils";

async function AppointmentsTable({
  filter,
  page,
}: {
  filter: DF;
  page: number;
}) {
  const result = await getAppointmentsList(filter, page, 25);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>{result.total} appointments found</span>
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
                  Appointment ID
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Lead
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Date/Time
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Status
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Stage
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Calendar
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Email
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Created
                </th>
              </tr>
            </thead>
            <tbody>
              {result.appointments.map((a) => (
                <tr
                  key={a.id}
                  className="border-b border-gray-100 last:border-0 hover:bg-gray-50"
                >
                  <td className="px-4 py-3 font-mono text-xs text-brand-aqua">
                    {a.id.substring(0, 8)}...
                  </td>
                  <td className="px-4 py-3 text-gray-900">{a.lead_name}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                    {formatDateTime(a.start_time)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={a.status} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <AppointmentStageSelect
                      appointmentId={a.id}
                      value={a.status}
                    />
                  </td>
                  <td className="px-4 py-3">
                    {a.google_calendar_status ? (
                      <StatusBadge status={a.google_calendar_status} />
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {a.customer_email_status ? (
                      <StatusBadge status={a.customer_email_status} />
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                    {formatDateTime(a.created_at)}
                  </td>
                </tr>
              ))}
              {result.appointments.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-8 text-center text-gray-500"
                  >
                    No appointments found for this date range.
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

export default async function AppointmentsPage({
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
        <h1 className="text-xl font-semibold text-gray-900">Appointments</h1>
        <Suspense>
          <DateFilter />
        </Suspense>
      </div>
      <Suspense
        fallback={
          <div className="text-center py-12 text-gray-500">
            Loading appointments...
          </div>
        }
      >
        <AppointmentsTable filter={filter} page={page} />
      </Suspense>
    </div>
  );
}
