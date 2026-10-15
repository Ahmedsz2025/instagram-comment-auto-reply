import { NextResponse } from "next/server";

import { getSafeConfiguration } from "@/lib/server/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = async () => {
  const configuration = getSafeConfiguration();
  const ready = configuration.configured;
  return NextResponse.json(
    {
      status: ready ? "ready" : "not_ready",
      checks: {
        webhook: configuration.webhookReady,
        automation: configuration.configured,
      },
      timestamp: new Date().toISOString(),
    },
    {
      status: ready ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
};
