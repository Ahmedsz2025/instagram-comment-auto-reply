import "server-only";

import { z } from "zod";

import { parseKeywords } from "@/lib/matching";

const webhookVerificationConfigSchema = z.object({
  META_WEBHOOK_VERIFY_TOKEN: z.string().min(1),
});

const webhookProcessingConfigSchema = z.object({
  META_APP_SECRET: z.string().min(1),
  META_INSTAGRAM_ACCESS_TOKEN: z.string().min(1),
  META_INSTAGRAM_ACCOUNT_ID: z.string().min(1),
  META_GRAPH_API_VERSION: z.string().regex(/^v\d+\.\d+$/),
  INSTAGRAM_KEYWORDS: z.string().min(1),
  INSTAGRAM_PRIVATE_REPLY_TEXT: z.string().min(1).max(1000),
});

export type WebhookVerificationConfig = {
  verifyToken: string;
};

export type WebhookProcessingConfig = {
  appSecret: string;
  accessToken: string;
  accountId: string;
  apiVersion: string;
  keywords: string[];
  privateReplyText: string;
};

export class ConfigurationError extends Error {
  readonly missingOrInvalid: string[];

  constructor(missingOrInvalid: string[]) {
    super(`Invalid server configuration: ${missingOrInvalid.join(", ")}`);
    this.name = "ConfigurationError";
    this.missingOrInvalid = missingOrInvalid;
  }
}

const invalidVariableNames = (error: z.ZodError) =>
  Array.from(new Set(error.issues.map((issue) => issue.path.join("."))));

export const getWebhookVerificationConfig = (): WebhookVerificationConfig => {
  const parsed = webhookVerificationConfigSchema.safeParse(process.env);

  if (!parsed.success) {
    throw new ConfigurationError(invalidVariableNames(parsed.error));
  }

  return { verifyToken: parsed.data.META_WEBHOOK_VERIFY_TOKEN };
};

export const getWebhookProcessingConfig = (): WebhookProcessingConfig => {
  const parsed = webhookProcessingConfigSchema.safeParse(process.env);

  if (!parsed.success) {
    throw new ConfigurationError(invalidVariableNames(parsed.error));
  }

  const keywords = parseKeywords(parsed.data.INSTAGRAM_KEYWORDS);
  if (keywords.length === 0) {
    throw new ConfigurationError(["INSTAGRAM_KEYWORDS"]);
  }

  return {
    appSecret: parsed.data.META_APP_SECRET,
    accessToken: parsed.data.META_INSTAGRAM_ACCESS_TOKEN,
    accountId: parsed.data.META_INSTAGRAM_ACCOUNT_ID,
    apiVersion: parsed.data.META_GRAPH_API_VERSION,
    keywords,
    privateReplyText: parsed.data.INSTAGRAM_PRIVATE_REPLY_TEXT,
  };
};

export const getSafeConfiguration = () => {
  const keywords = parseKeywords(process.env.INSTAGRAM_KEYWORDS ?? "");
  const verification = webhookVerificationConfigSchema.safeParse(process.env);
  const processing = webhookProcessingConfigSchema.safeParse(process.env);
  const invalid = new Set<string>([
    ...(verification.success ? [] : invalidVariableNames(verification.error)),
    ...(processing.success ? [] : invalidVariableNames(processing.error)),
  ]);

  if (keywords.length === 0) invalid.add("INSTAGRAM_KEYWORDS");

  const has = (name: string) => Boolean(process.env[name]?.trim());
  const webhookReady = verification.success;
  const automationProcessingReady = processing.success && keywords.length > 0;
  const credentialsConfigured =
    has("META_APP_SECRET") &&
    has("META_INSTAGRAM_ACCESS_TOKEN") &&
    has("META_INSTAGRAM_ACCOUNT_ID") &&
    has("META_GRAPH_API_VERSION");
  const replyConfigured =
    keywords.length > 0 && has("INSTAGRAM_PRIVATE_REPLY_TEXT");

  return {
    configured: webhookReady && automationProcessingReady,
    missingCount: invalid.size,
    keywords,
    apiVersion: process.env.META_GRAPH_API_VERSION ?? null,
    webhookReady,
    automationProcessingReady,
    credentialsConfigured,
    replyConfigured,
    dashboardProtected: Boolean(
      process.env.DASHBOARD_USERNAME?.trim() &&
        process.env.DASHBOARD_PASSWORD?.trim(),
    ),
  };
};
