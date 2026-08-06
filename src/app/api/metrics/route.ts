import { NextRequest, NextResponse } from "next/server";
import metrics from "@/lib/metrics";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, labels, value } = body as { name: string; labels?: Record<string, any>; value?: number };
    if (!name) {
      return NextResponse.json({ error: "name required" }, { status: 400 });
    }
    metrics.incrementCounter(name, labels, typeof value === "number" ? value : 1);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
}

export async function GET() {
  const text = metrics.getPrometheusText();
  return new NextResponse(text, { status: 200, headers: { "Content-Type": "text/plain; version=0.0.4" } });
}
