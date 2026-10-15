import { describe, expect, it } from "vitest";

import {
  createMetaSignature,
  secureStringEqual,
  verifyMetaSignature,
} from "@/lib/instagram/signature";

describe("Meta webhook signatures", () => {
  const body = new TextEncoder().encode('{"object":"instagram"}');
  const secret = "test-app-secret";

  it("accepts the exact SHA-256 signature", () => {
    const signature = createMetaSignature(body, secret);
    expect(verifyMetaSignature(body, signature, secret)).toBe(true);
  });

  it("rejects missing, malformed, or invalid signatures", () => {
    expect(verifyMetaSignature(body, null, secret)).toBe(false);
    expect(verifyMetaSignature(body, "sha1=abc", secret)).toBe(false);
    expect(
      verifyMetaSignature(body, `sha256=${"0".repeat(64)}`, secret),
    ).toBe(false);
  });

  it("rejects a signature when the raw body changes", () => {
    const signature = createMetaSignature(body, secret);
    const changed = new TextEncoder().encode('{"object": "instagram"}');
    expect(verifyMetaSignature(changed, signature, secret)).toBe(false);
  });

  it("compares verification tokens without early string comparison", () => {
    expect(secureStringEqual("verification-token", "verification-token")).toBe(true);
    expect(secureStringEqual("verification-token", "different-token")).toBe(false);
  });
});
