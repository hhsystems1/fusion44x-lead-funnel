import "server-only";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return false;
  }
  const supplied = request.headers.get("authorization");
  if (!supplied || !supplied.startsWith("Bearer ")) {
    return false;
  }
  return supplied.slice("Bearer ".length) === secret;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { getEmailProvider } = await import("@/lib/email/provider");
    const { sendDueBookingFollowUps } = await import("@/lib/email/follow-up");

    const providerResult = getEmailProvider();
    if (!providerResult.provider) {
      return NextResponse.json({
        processed: 0,
        sent: 0,
        skipped: 0,
        failed: 0,
        error: "no email provider configured",
      });
    }

    const result = await sendDueBookingFollowUps({
      provider: providerResult.provider,
    });

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
