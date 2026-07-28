import { NextRequest, NextResponse } from "next/server";
import {
  verifyCredentials,
  createSessionToken,
  checkLoginRateLimit,
  resetLoginRateLimit,
  getAdminSessionConfig,
} from "@/lib/admin/auth";
import { extractClientIp } from "@/lib/server/request-protection";

export async function POST(request: NextRequest) {
  const clientIp = extractClientIp(request);
  const rateKey = clientIp ?? "unknown";

  const rateCheck = checkLoginRateLimit(rateKey);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: "Too many failed attempts. Try again later." },
      { status: 429 },
    );
  }

  let body: { username?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 },
    );
  }

  const { username, password } = body;
  if (!username || !password) {
    return NextResponse.json(
      { error: "Username and password are required" },
      { status: 400 },
    );
  }

  const valid = verifyCredentials(username, password);
  if (!valid) {
    return NextResponse.json(
      { error: "Invalid credentials" },
      { status: 401 },
    );
  }

  resetLoginRateLimit(rateKey);

  const token = createSessionToken(username);
  const config = getAdminSessionConfig();

  const response = NextResponse.json({ success: true });
  response.cookies.set(config.cookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: Math.floor(config.maxAgeMs / 1000),
    path: "/",
  });

  return response;
}
