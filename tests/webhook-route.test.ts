import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { GET, POST } from "@/app/api/webhooks/instagram/route";
import { GET as GET_HEALTH } from "@/app/api/health/route";

const controlledVariables = [
  "META_APP_SECRET",
  "META_WEBHOOK_VERIFY_TOKEN",
  "META_INSTAGRAM_ACCESS_TOKEN",
  "META_INSTAGRAM_ACCOUNT_ID",
  "META_GRAPH_API_VERSION",
  "INSTAGRAM_KEYWORDS",
  "INSTAGRAM_PRIVATE_REPLY_TEXT",
  "DASHBOARD_USERNAME",
  "DASHBOARD_PASSWORD",
] as const;

const originalEnvironment = Object.fromEntries(
  controlledVariables.map((name) => [name, process.env[name]]),
);

const verificationRequest = (verifyToken = "verification-only-token") =>
  new Request(
    `https://example.test/api/webhooks/instagram?hub.mode=subscribe&hub.challenge=challenge-123&hub.verify_token=${encodeURIComponent(verifyToken)}`,
  );

describe("Instagram webhook GET verification", () => {
  beforeEach(() => {
    for (const name of controlledVariables) delete process.env[name];
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(() => {
    for (const name of controlledVariables) {
      const originalValue = originalEnvironment[name];
      if (originalValue === undefined) delete process.env[name];
      else process.env[name] = originalValue;
    }
  });

  it("returns the challenge when only the verify token is configured", async () => {
    process.env.META_WEBHOOK_VERIFY_TOKEN = "verification-only-token";

    const response = await GET(verificationRequest());

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/plain");
    expect(await response.text()).toBe("challenge-123");
    expect(process.env.META_APP_SECRET).toBeUndefined();
    expect(process.env.META_INSTAGRAM_ACCESS_TOKEN).toBeUndefined();
    expect(JSON.stringify(vi.mocked(console.info).mock.calls)).not.toContain(
      "verification-only-token",
    );
  });

  it("returns 403 when the configured token does not match", async () => {
    process.env.META_WEBHOOK_VERIFY_TOKEN = "verification-only-token";

    const response = await GET(verificationRequest("wrong-token"));

    expect(response.status).toBe(403);
    expect(await response.text()).toBe("Forbidden");
  });

  it.each([
    "https://example.test/api/webhooks/instagram",
    "https://example.test/api/webhooks/instagram?hub.mode=subscribe&hub.verify_token=verification-only-token",
    "https://example.test/api/webhooks/instagram?hub.mode=invalid&hub.challenge=challenge-123&hub.verify_token=verification-only-token",
  ])("returns 400 for malformed verification parameters", async (url) => {
    process.env.META_WEBHOOK_VERIFY_TOKEN = "verification-only-token";

    const response = await GET(new Request(url));

    expect(response.status).toBe(400);
  });

  it("keeps POST processing behind the full processing configuration", async () => {
    process.env.META_WEBHOOK_VERIFY_TOKEN = "verification-only-token";

    const response = await POST(
      new Request("https://example.test/api/webhooks/instagram", {
        method: "POST",
        body: "{}",
      }),
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ accepted: false });
  });

  it("reports verification and processing readiness separately", async () => {
    process.env.META_WEBHOOK_VERIFY_TOKEN = "verification-only-token";

    const response = await GET_HEALTH();

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      status: "not_ready",
      checks: {
        webhookVerification: true,
        automationProcessing: false,
      },
    });
  });
});
