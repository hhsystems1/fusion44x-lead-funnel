import { NextRequest, NextResponse } from "next/server";
import {
  exportSessionsCsv,
  exportLeadsCsv,
  exportAppointmentsCsv,
  type DateFilter,
} from "@/lib/admin/queries";
import { cookies } from "next/headers";
import { verifySessionToken } from "@/lib/admin/auth";

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const session = cookieStore.get("admin_session");

  if (!session?.value) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sessionSecret = process.env.ADMIN_DASHBOARD_SESSION_SECRET;
  if (!sessionSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!verifySessionToken(session.value)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const filterType = searchParams.get("filter") ?? "last30";
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  let filter: DateFilter;
  if (filterType === "custom" && from && to) {
    filter = { type: "custom", from, to };
  } else if (filterType === "today") {
    filter = { type: "today" };
  } else if (filterType === "last7") {
    filter = { type: "last7" };
  } else {
    filter = { type: "last30" };
  }

  let csv: string;
  let filename: string;

  switch (type) {
    case "sessions":
      csv = await exportSessionsCsv(filter);
      filename = "funnel-sessions.csv";
      break;
    case "leads":
      csv = await exportLeadsCsv(filter);
      filename = "funnel-leads.csv";
      break;
    case "appointments":
      csv = await exportAppointmentsCsv(filter);
      filename = "funnel-appointments.csv";
      break;
    default:
      return NextResponse.json(
        { error: "Invalid export type. Use: sessions, leads, appointments" },
        { status: 400 },
      );
  }

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
