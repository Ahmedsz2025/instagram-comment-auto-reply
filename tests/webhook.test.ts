import { describe, expect, it } from "vitest";

import {
  deduplicateCommentEvents,
  extractCommentEvents,
  WebhookPayloadError,
} from "@/lib/instagram/webhook";

const commentChange = {
  field: "comments",
  value: {
    id: "comment-1",
    text: "Please send the guide",
    from: { id: "person-1", username: "sample_user" },
    media: { id: "media-1", media_product_type: "REELS" },
  },
};

describe("Instagram webhook extraction", () => {
  it("extracts comments for the configured account", () => {
    const events = extractCommentEvents(
      {
        object: "instagram",
        entry: [
          {
            id: "account-1",
            time: 1_700_000_000,
            changes: [commentChange],
          },
        ],
      },
      "account-1",
    );

    expect(events).toEqual([
      {
        commentId: "comment-1",
        accountId: "account-1",
        mediaId: "media-1",
        authorId: "person-1",
        authorUsername: "sample_user",
        text: "Please send the guide",
      },
    ]);
  });

  it("ignores unrelated accounts, objects, fields, and malformed changes", () => {
    expect(
      extractCommentEvents(
        {
          object: "instagram",
          entry: [
            {
              id: "other-account",
              changes: [commentChange],
            },
            {
              id: "account-1",
              changes: [
                { field: "messages", value: {} },
                { field: "comments", value: { id: "missing-text" } },
              ],
            },
          ],
        },
        "account-1",
      ),
    ).toEqual([]);

    expect(
      extractCommentEvents({ object: "page", entry: [] }, "account-1"),
    ).toEqual([]);
  });

  it("supports batched comment changes", () => {
    const events = extractCommentEvents(
      {
        object: "instagram",
        entry: [
          {
            id: "account-1",
            changes: [
              commentChange,
              {
                field: "comments",
                value: { id: "comment-2", text: "pricing" },
              },
            ],
          },
        ],
      },
      "account-1",
    );

    expect(events).toHaveLength(2);
    expect(events[1]?.authorId).toBeNull();
  });

  it("filters duplicate comment IDs only within the current delivery", () => {
    const events = extractCommentEvents(
      {
        object: "instagram",
        entry: [
          {
            id: "account-1",
            changes: [commentChange, commentChange],
          },
        ],
      },
      "account-1",
    );

    expect(deduplicateCommentEvents(events)).toHaveLength(1);
    expect(deduplicateCommentEvents(events)[0]?.commentId).toBe("comment-1");
  });

  it("rejects unsupported top-level payloads", () => {
    expect(() => extractCommentEvents({ object: "instagram" }, "account-1")).toThrow(
      WebhookPayloadError,
    );
  });
});
