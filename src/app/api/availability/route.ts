import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    { message: "Availability endpoint — not yet implemented" },
    { status: 501 },
  );
}
