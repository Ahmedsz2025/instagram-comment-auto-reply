import { z } from "zod";

const successSchema = z.object({
  recipient_id: z.string(),
  message_id: z.string(),
});

const errorSchema = z.object({
  error: z
    .object({
      message: z.string().optional(),
      type: z.string().optional(),
      code: z.number().optional(),
      error_subcode: z.number().optional(),
      fbtrace_id: z.string().optional(),
    })
    .optional(),
});

export type PrivateReplyResult = {
  recipientId: string;
  messageId: string;
};

export class MetaApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = "MetaApiError";
    this.code = code;
    this.status = status;
  }
}

type SendPrivateReplyInput = {
  accountId: string;
  accessToken: string;
  apiVersion: string;
  commentId: string;
  text: string;
};

export const sendPrivateReply = async ({
  accountId,
  accessToken,
  apiVersion,
  commentId,
  text,
}: SendPrivateReplyInput): Promise<PrivateReplyResult> => {
  const url = new URL(
    `/${apiVersion}/${encodeURIComponent(accountId)}/messages`,
    "https://graph.instagram.com",
  );

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recipient: { comment_id: commentId },
        message: { text },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Network request failed";
    throw new MetaApiError(message, "network_error", 0);
  }

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const parsedError = errorSchema.safeParse(body);
    const metaError = parsedError.success ? parsedError.data.error : undefined;
    const code = [metaError?.code, metaError?.error_subcode]
      .filter((value) => value !== undefined)
      .join(":");

    throw new MetaApiError(
      metaError?.message ?? `Meta API returned HTTP ${response.status}.`,
      code || `http_${response.status}`,
      response.status,
    );
  }

  const parsed = successSchema.safeParse(body);
  if (!parsed.success) {
    throw new MetaApiError(
      "Meta API returned an unexpected success payload.",
      "invalid_response",
      response.status,
    );
  }

  return {
    recipientId: parsed.data.recipient_id,
    messageId: parsed.data.message_id,
  };
};
