import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken } from "@/lib/admin/auth";
import { leadStageSchema, leadStageLabel } from "@/lib/admin/stages";
import { updateLeadStage } from "@/lib/admin/queries";

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

  let body: { stage?: unknown } | null;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const parsed = leadStageSchema.safeParse(body?.stage);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid stage. Use: contacted, no_show, follow_up, won, lost, or null" },
      { status: 422 },
    );
  }

  const ok = await updateLeadStage(id, parsed.data);
  if (!ok) {
    return NextResponse.json(
      { error: "Could not update lead stage" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    lead_id: id,
    stage: parsed.data,
    label: leadStageLabel(parsed.data),
  });
}
