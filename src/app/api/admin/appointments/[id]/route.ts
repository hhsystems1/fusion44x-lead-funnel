import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken } from "@/lib/admin/auth";
import { appointmentStageSchema, appointmentStageLabel } from "@/lib/admin/stages";
import { updateAppointmentStatus } from "@/lib/admin/queries";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const cookieStore = await cookies();
  const session = cookieStore.get("admin_session");

  if (!session?.value || !process.env.ADMIN_DASHBOARD_SESSION_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!verifySessionToken(session.value)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let body: { status?: unknown } | null;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const parsed = appointmentStageSchema.safeParse(body?.status);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid status. Use: no_show or completed" },
      { status: 422 },
    );
  }

  const ok = await updateAppointmentStatus(id, parsed.data);
  if (!ok) {
    return NextResponse.json(
      { error: "Could not update appointment status" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    appointment_id: id,
    status: parsed.data,
    label: appointmentStageLabel(parsed.data),
  });
}
