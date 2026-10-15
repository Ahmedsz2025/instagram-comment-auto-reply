import { NextResponse } from "next/server";

import { MetaApiError, sendPrivateReply } from "@/lib/instagram/client";
import {
  secureStringEqual,
  verifyMetaSignature,
} from "@/lib/instagram/signature";
import {
  deduplicateCommentEvents,
  extractCommentEvents,
  type InstagramCommentEvent,
  WebhookPayloadError,
} from "@/lib/instagram/webhook";
import { createKeywordMatcher } from "@/lib/matching";
import {
  ConfigurationError,
  getWebhookProcessingConfig,
  getWebhookVerificationConfig,
  type WebhookProcessingConfig,
} from "@/lib/server/config";
import { log } from "@/lib/server/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const maximumWebhookBytes = 1_000_000;

type EventOutcome = "ignored" | "sent" | "failed";

const json = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });

export const GET = async (request: Request) => {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const challenge = url.searchParams.get("hub.challenge");
  const verifyToken = url.searchParams.get("hub.verify_token");

  if (mode !== "subscribe" || !challenge || !verifyToken) {
    log("warn", "webhook.verification.invalid_request");
    return new NextResponse("Invalid verification request", {
      status: 400,
      headers: { "Cache-Control": "no-store" },
    });
  }

  let config;
  try {
    config = getWebhookVerificationConfig();
  } catch (error) {
    log("error", "webhook.verification.configuration_error", {
      missing:
        error instanceof ConfigurationError ? error.missingOrInvalid : ["unknown"],
    });
    return new NextResponse("Server configuration error", {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }

  if (secureStringEqual(verifyToken, config.verifyToken)) {
    log("info", "webhook.verification.accepted");
    return new NextResponse(challenge, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }

  log("warn", "webhook.verification.rejected");
  return new NextResponse("Forbidden", {
    status: 403,
    headers: { "Cache-Control": "no-store" },
  });
};

const processEvent = async (
  event: InstagramCommentEvent,
  config: WebhookProcessingConfig,
  requestId: string,
): Promise<EventOutcome> => {
  if (event.authorId === config.accountId) {
    log("info", "webhook.comment.ignored_self", {
      requestId,
      commentId: event.commentId,
    });
    return "ignored";
  }

  const keyword = createKeywordMatcher(config.keywords).match(event.text);
  if (!keyword) {
    log("info", "webhook.comment.no_match", {
      requestId,
      commentId: event.commentId,
    });
    return "ignored";
  }

  try {
    const result = await sendPrivateReply({
      accountId: config.accountId,
      accessToken: config.accessToken,
      apiVersion: config.apiVersion,
      commentId: event.commentId,
      text: config.privateReplyText,
    });
    log("info", "webhook.comment.reply_sent", {
      requestId,
      commentId: event.commentId,
      keyword,
      messageId: result.messageId,
    });
    return "sent";
  } catch (error) {
    log("error", "webhook.comment.reply_failed", {
      requestId,
      commentId: event.commentId,
      code: error instanceof MetaApiError ? error.code : "unexpected_error",
      status: error instanceof MetaApiError ? error.status : 0,
      errorType: error instanceof Error ? error.name : "UnknownError",
    });
    return "failed";
  }
};

export const POST = async (request: Request) => {
  const requestId = crypto.randomUUID();
  let config: WebhookProcessingConfig;

  try {
    config = getWebhookProcessingConfig();
  } catch (error) {
    log("error", "webhook.configuration_error", {
      requestId,
      missing:
        error instanceof ConfigurationError ? error.missingOrInvalid : ["unknown"],
    });
    return json({ accepted: false, requestId }, 503);
  }

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > maximumWebhookBytes) {
    log("warn", "webhook.payload_too_large", { requestId, declaredLength });
    return json({ accepted: false, requestId }, 413);
  }

  const rawBody = new Uint8Array(await request.arrayBuffer());
  if (rawBody.byteLength > maximumWebhookBytes) {
    log("warn", "webhook.payload_too_large", {
      requestId,
      actualLength: rawBody.byteLength,
    });
    return json({ accepted: false, requestId }, 413);
  }

  const signature = request.headers.get("x-hub-signature-256");
  if (!verifyMetaSignature(rawBody, signature, config.appSecret)) {
    log("warn", "webhook.signature_rejected", { requestId });
    return json({ accepted: false, requestId }, 401);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(new TextDecoder().decode(rawBody));
  } catch {
    log("warn", "webhook.invalid_json", { requestId });
    return json({ accepted: false, requestId }, 400);
  }

  let events: InstagramCommentEvent[];
  try {
    events = extractCommentEvents(payload, config.accountId);
  } catch (error) {
    if (error instanceof WebhookPayloadError) {
      log("warn", "webhook.invalid_payload", { requestId });
      return json({ accepted: false, requestId }, 400);
    }
    throw error;
  }

  const uniqueEvents = deduplicateCommentEvents(events);
  const duplicates = events.length - uniqueEvents.length;

  if (duplicates > 0) {
    log("info", "webhook.request_duplicates_ignored", {
      requestId,
      duplicates,
    });
  }

  if (uniqueEvents.length === 0) {
    log("info", "webhook.no_relevant_events", { requestId });
    return json({
      accepted: true,
      processed: 0,
      duplicates,
      outcomes: { sent: 0, ignored: 0, failed: 0 },
      requestId,
    });
  }

  try {
    const results = await Promise.all(
      uniqueEvents.map((event) => processEvent(event, config, requestId)),
    );
    const outcomes = {
      sent: results.filter((result) => result === "sent").length,
      ignored: results.filter((result) => result === "ignored").length,
      failed: results.filter((result) => result === "failed").length,
    };

    log("info", "webhook.processed", {
      requestId,
      eventCount: uniqueEvents.length,
      duplicates,
      outcomes,
    });
    return json({
      accepted: true,
      processed: uniqueEvents.length,
      duplicates,
      outcomes,
      requestId,
    });
  } catch (error) {
    log("error", "webhook.processing_error", {
      requestId,
      errorType: error instanceof Error ? error.name : "UnknownError",
    });
    return json({ accepted: false, requestId }, 500);
  }
};
