import { NextRequest, NextResponse } from "next/server";

export const config = {
  matcher: ["/admin/:path*"],
};

async function verifySessionToken(
  token: string,
  secret: string,
): Promise<boolean> {
  try {
    const [data, signature] = token.split(".");
    if (!data || !signature) return false;

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );

    const dataBytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
    const sigBytes = Uint8Array.from(
      signature.replace(/-/g, "+").replace(/_/g, "/"),
      (c) => c.charCodeAt(0),
    );

    const valid = await crypto.subtle.verify("HMAC", key, sigBytes, dataBytes);
    if (!valid) return false;

    const payload = JSON.parse(
      new TextDecoder().decode(
        Uint8Array.from(atob(data), (c) => c.charCodeAt(0)),
      ),
    );
    if (typeof payload.exp !== "number" || Date.now() > payload.exp) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/admin/login") {
    return NextResponse.next();
  }

  const sessionSecret = process.env.ADMIN_DASHBOARD_SESSION_SECRET;
  if (!sessionSecret) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  const sessionCookie = request.cookies.get("admin_session");

  if (!sessionCookie?.value) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  const isValid = await verifySessionToken(
    sessionCookie.value,
    sessionSecret,
  );
  if (!isValid) {
    const response = NextResponse.redirect(
      new URL("/admin/login", request.url),
    );
    response.cookies.delete("admin_session");
    return response;
  }

  return NextResponse.next();
}
