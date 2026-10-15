import { createHmac, timingSafeEqual } from "node:crypto";

const signaturePattern = /^sha256=([a-f0-9]{64})$/i;

export const secureStringEqual = (left: string, right: string): boolean => {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
};

export const createMetaSignature = (
  rawBody: Uint8Array,
  appSecret: string,
): string =>
  `sha256=${createHmac("sha256", appSecret).update(rawBody).digest("hex")}`;

export const verifyMetaSignature = (
  rawBody: Uint8Array,
  signatureHeader: string | null,
  appSecret: string,
): boolean => {
  if (!signatureHeader || !signaturePattern.test(signatureHeader)) return false;

  const expected = Buffer.from(createMetaSignature(rawBody, appSecret), "utf8");
  const received = Buffer.from(signatureHeader.toLowerCase(), "utf8");

  return expected.length === received.length && timingSafeEqual(expected, received);
};
