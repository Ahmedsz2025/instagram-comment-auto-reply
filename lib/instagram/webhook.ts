import { z } from "zod";

const webhookChangeSchema = z.object({
  field: z.string(),
  value: z.unknown(),
});

const webhookPayloadSchema = z.object({
  object: z.string(),
  entry: z.array(
    z.object({
      id: z.string(),
      time: z.number().optional(),
      changes: z.array(webhookChangeSchema),
    }),
  ),
});

const commentValueSchema = z.object({
  id: z.string().min(1),
  text: z.string(),
  from: z
    .object({
      id: z.string().optional(),
      username: z.string().optional(),
    })
    .optional(),
  media: z
    .object({
      id: z.string().optional(),
    })
    .optional(),
});

export type InstagramCommentEvent = {
  commentId: string;
  accountId: string;
  mediaId: string | null;
  authorId: string | null;
  authorUsername: string | null;
  text: string;
};

export class WebhookPayloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebhookPayloadError";
  }
}

export const deduplicateCommentEvents = (
  events: InstagramCommentEvent[],
): InstagramCommentEvent[] => {
  const seen = new Set<string>();

  return events.filter((event) => {
    if (seen.has(event.commentId)) return false;
    seen.add(event.commentId);
    return true;
  });
};

export const extractCommentEvents = (
  payload: unknown,
  expectedAccountId: string,
): InstagramCommentEvent[] => {
  const parsed = webhookPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    throw new WebhookPayloadError("Webhook payload has an unsupported shape.");
  }

  if (parsed.data.object !== "instagram") return [];

  const events: InstagramCommentEvent[] = [];

  for (const entry of parsed.data.entry) {
    if (entry.id !== expectedAccountId) continue;

    for (const change of entry.changes) {
      if (change.field !== "comments") continue;
      const comment = commentValueSchema.safeParse(change.value);
      if (!comment.success) continue;

      events.push({
        commentId: comment.data.id,
        accountId: entry.id,
        mediaId: comment.data.media?.id ?? null,
        authorId: comment.data.from?.id ?? null,
        authorUsername: comment.data.from?.username ?? null,
        text: comment.data.text,
      });
    }
  }

  return events;
};
