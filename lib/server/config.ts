import "server-only";

import { z } from "zod";

import { parseKeywords } from "@/lib/matching";

const webhookConfigSchema = z.object({
  META_APP_SECRET: z.string().min(1),
  META_WEBHOOK_VERIFY_TOKEN: z.string().min(16),
  META_INSTAGRAM_ACCESS_TOKEN: z.string().min(1),
  META_INSTAGRAM_ACCOUNT_ID: z.string().min(1),
  META_GRAPH_API_VERSION: z.string().regex(/^v\d+\.\d+$/),
  INSTAGRAM_KEYWORDS: z.string().min(1),
  INSTAGRAM_PRIVATE_REPLY_TEXT: z.string().min(1).max(1000),
});

export type WebhookConfig = {
  appSecret: string;
  verifyToken: string;
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

export const getWebhookConfig = (): WebhookConfig => {
  const parsed = webhookConfigSchema.safeParse(process.env);

  if (!parsed.success) {
    throw new ConfigurationError(
      parsed.error.issues.map((issue) => issue.path.join(".")),
    );
  }

  const keywords = parseKeywords(parsed.data.INSTAGRAM_KEYWORDS);
  if (keywords.length === 0) {
    throw new ConfigurationError(["INSTAGRAM_KEYWORDS"]);
  }

  return {
    appSecret: parsed.data.META_APP_SECRET,
    verifyToken: parsed.data.META_WEBHOOK_VERIFY_TOKEN,
    accessToken: parsed.data.META_INSTAGRAM_ACCESS_TOKEN,
    accountId: parsed.data.META_INSTAGRAM_ACCOUNT_ID,
    apiVersion: parsed.data.META_GRAPH_API_VERSION,
    keywords,
    privateReplyText: parsed.data.INSTAGRAM_PRIVATE_REPLY_TEXT,
  };
};

const requiredRuntimeVariables = [
  "META_APP_SECRET",
  "META_WEBHOOK_VERIFY_TOKEN",
  "META_INSTAGRAM_ACCESS_TOKEN",
  "META_INSTAGRAM_ACCOUNT_ID",
  "META_GRAPH_API_VERSION",
  "INSTAGRAM_KEYWORDS",
  "INSTAGRAM_PRIVATE_REPLY_TEXT",
] as const;

export const getSafeConfiguration = () => {
  const missing = requiredRuntimeVariables.filter(
    (name) => !process.env[name]?.trim(),
  );
  const keywords = parseKeywords(process.env.INSTAGRAM_KEYWORDS ?? "");
  const has = (name: (typeof requiredRuntimeVariables)[number]) =>
    Boolean(process.env[name]?.trim());
  const webhookReady =
    has("META_APP_SECRET") &&
    has("META_WEBHOOK_VERIFY_TOKEN") &&
    has("META_INSTAGRAM_ACCOUNT_ID");
  const credentialsConfigured =
    has("META_INSTAGRAM_ACCESS_TOKEN") &&
    has("META_INSTAGRAM_ACCOUNT_ID") &&
    has("META_GRAPH_API_VERSION");
  const replyConfigured =
    keywords.length > 0 && has("INSTAGRAM_PRIVATE_REPLY_TEXT");

  return {
    configured: missing.length === 0 && keywords.length > 0,
    missingCount: missing.length,
    keywords,
    apiVersion: process.env.META_GRAPH_API_VERSION ?? null,
    webhookReady,
    credentialsConfigured,
    replyConfigured,
    dashboardProtected: Boolean(
      process.env.DASHBOARD_USERNAME?.trim() &&
        process.env.DASHBOARD_PASSWORD?.trim(),
    ),
  };
};
