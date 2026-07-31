import { Suspense } from "react";
import { DateFilter } from "../date-filter";
import { MetricCard } from "../metric-card";
import { getOverviewMetrics, type DateFilter as DF } from "@/lib/admin/queries";
import { parseFilterParams } from "../utils";

async function OverviewContent({ filter }: { filter: DF }) {
  const metrics = await getOverviewMetrics(filter);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <MetricCard label="Unique Visitors" value={metrics.uniqueVisitors} />
        <MetricCard label="Page Views" value={metrics.totalPageViews} />
        <MetricCard
          label="Funnel Sessions"
          value={metrics.uniqueFunnelSessions}
          subtitle={`${metrics.returningSessions} returning`}
        />
        <MetricCard
          label="Diagnostic Starts"
          value={metrics.diagnosticStarts}
        />
        <MetricCard
          label="Diagnostic Completions"
          value={metrics.diagnosticCompletions}
        />
        <MetricCard
          label="Contact Submissions"
          value={metrics.contactSubmissions}
        />
        <MetricCard
          label="Successful Leads"
          value={metrics.successfulLeads}
          accent
        />
        <MetricCard
          label="Abandoned Sessions"
          value={metrics.abandonedSessions}
        />
        <MetricCard
          label="Booking Stage Visitors"
          value={metrics.bookingStageVisitors}
        />
        <MetricCard
          label="Confirmed Appointments"
          value={metrics.confirmedAppointments}
          accent
        />
        <MetricCard
          label="Booking Conversion"
          value={`${metrics.bookingConversionRate}%`}
          subtitle="booking stage → confirmed"
        />
        <MetricCard
          label="Visitor → Lead"
          value={`${metrics.visitorToLeadRate}%`}
          subtitle="unique visitors → leads"
        />
        <MetricCard
          label="Lead → Booking"
          value={`${metrics.leadToBookingRate}%`}
          subtitle="leads → confirmed"
        />
      </div>
    </div>
  );
}

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const filter = parseFilterParams(params);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Overview</h1>
        <Suspense>
          <DateFilter />
        </Suspense>
      </div>
      <Suspense
        fallback={
          <div className="text-center py-12 text-gray-500">Loading metrics...</div>
        }
      >
        <OverviewContent filter={filter} />
      </Suspense>
    </div>
  );
}
