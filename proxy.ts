import { timingSafeEqual } from "node:crypto";

import { type NextRequest, NextResponse } from "next/server";

const equal = (left: string, right: string) => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
};

const unauthorized = () =>
  new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Signal Desk", charset="UTF-8"',
      "Cache-Control": "no-store",
    },
  });

export function proxy(request: NextRequest) {
  const expectedUsername = process.env.DASHBOARD_USERNAME;
  const expectedPassword = process.env.DASHBOARD_PASSWORD;

  if (!expectedUsername || !expectedPassword) {
    if (process.env.NODE_ENV === "production") {
      return new NextResponse("Dashboard authentication is not configured", {
        status: 503,
      });
    }
    return NextResponse.next();
  }

  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Basic ")) return unauthorized();

  try {
    const credentials = Buffer.from(authorization.slice(6), "base64").toString(
      "utf8",
    );
    const separator = credentials.indexOf(":");
    if (separator === -1) return unauthorized();

    const username = credentials.slice(0, separator);
    const password = credentials.slice(separator + 1);
    if (!equal(username, expectedUsername) || !equal(password, expectedPassword)) {
      return unauthorized();
    }

    return NextResponse.next();
  } catch {
    return unauthorized();
  }
}

export const config = {
  matcher: ["/((?!api/webhooks/instagram|api/health|_next|favicon.ico).*)"],
};
