# Instagram comment-to-DM tutorial plan

## Goal and scope

Build a beginner-friendly Next.js and TypeScript application for one Instagram
professional account. It receives signed Instagram comment webhooks, matches
server-configured keywords, and sends the commenter one private reply through
Meta's supported Private Replies flow.

This tutorial is intentionally **stateless and database-free**. It does not use
PostgreSQL, SQL migrations, an ORM, SQLite, Redis, KV, Supabase, or any other
persistent storage. It also does not implement multi-tenant onboarding, OAuth,
a rule editor, activity history, or follow-up conversations. The Instagram
account ID, access token, keywords, and reply text are deployment configuration
and stay on the server.

## Verified Meta API contract

The implementation targets **Instagram API with Instagram Login**, not the
Facebook Login variant. The following details were checked against Meta's live
official documentation on 2026-10-15:

- Host: `graph.instagram.com`.
- Graph API version: supplied explicitly by `META_GRAPH_API_VERSION`; the
  initial example value is `v26.0`, which Meta's current setup guide identifies
  as the latest version.
- Webhook field: `comments`.
- Required permissions for comment webhooks and private replies:
  `instagram_business_basic` and `instagram_business_manage_comments`.
- Account type: Instagram professional account (business or creator).
- Private reply request:
  `POST https://graph.instagram.com/<VERSION>/<IG_USER_ID>/messages` with a
  bearer token and JSON body containing
  `recipient: { comment_id: <COMMENT_ID> }` and
  `message: { text: <REPLY_TEXT> }`.
- Private reply limits: one message per commenter/comment, within seven days of
  a post or reel comment. A Live reply must be sent while the broadcast is live.
  Follow-up messages require a recipient response and are outside this app's
  scope.
- Webhook verification is a `GET` challenge using `hub.mode`, `hub.challenge`,
  and `hub.verify_token`.
- Webhook notifications are signed in `X-Hub-Signature-256` using SHA-256 and
  the Meta App Secret. Signature verification must use the raw request body.
- Meta can retry webhook deliveries, so duplicate deliveries are possible.
- For Instagram Login, the professional account is enabled for notifications
  through `POST /<INSTAGRAM_ACCOUNT_ID>/subscribed_apps` with
  `subscribed_fields=comments` and an Instagram user access token. This is a
  one-time Meta setup action documented in the README, not performed by the app.

Official sources:

- [Private Replies](https://developers.facebook.com/documentation/instagram-platform/private-replies)
- [Instagram Webhooks](https://developers.facebook.com/documentation/instagram-platform/webhooks)
- [Set up Instagram Webhooks](https://developers.facebook.com/documentation/instagram-platform/webhooks/setup)
- [Webhook fields and permissions](https://developers.facebook.com/documentation/instagram-platform/webhooks/fields)

## Stateless architecture

```text
Instagram comment
       |
       v
Meta comments webhook
       |
       v
GET/POST /api/webhooks/instagram
  1. verify the GET challenge or raw-body HMAC
  2. validate and flatten comment changes
  3. ignore unrelated accounts, fields, and self-comments
  4. normalize text and match configured keywords
  5. send a private reply through graph.instagram.com
  6. emit a safe structured log and return a summary

Dashboard (server rendered)
  -> reads configuration presence only
  -> displays safe setup state and configured keywords
  -> never receives credentials or private reply text
```

### App boundary

- Next.js App Router handles the dashboard and route handlers.
- Server-only modules own environment validation, HMAC verification, webhook
  parsing, keyword matching, Meta HTTP calls, and structured logging.
- The webhook handler operates entirely within the incoming request. It does not
  write the comment, user, result, or message ID anywhere.
- The browser receives only booleans, the explicitly safe keyword list, and the
  configured Graph API version. Access tokens, app secrets, account IDs, verify
  tokens, dashboard credentials, raw payloads, and private reply text never
  enter props, client bundles, API responses, or logs.
- HTTP Basic Auth protects the dashboard in production while leaving the Meta
  webhook and health endpoints public. This is suitable for the tutorial's
  single-owner scope; multi-user authentication remains outside scope.

### Intentional stateless tradeoff

Durable idempotency and persistent activity history are intentionally outside
this tutorial's scope. The handler removes duplicate comment IDs only within a
single webhook request. It cannot remember a comment across separate Meta retry
requests or application restarts.

Because Meta allows one private reply per comment, a later duplicate attempt is
normally rejected by Meta, but the tutorial does not promise exactly-once
delivery. Likewise, the dashboard cannot show historical counts or failures.
Those capabilities can be added later with a database and a unique comment-ID
constraint when moving beyond the tutorial.

### Matching

- Keywords come from comma-separated `INSTAGRAM_KEYWORDS`.
- Matching is case-insensitive and Unicode-aware after `NFKC` normalization.
- A keyword matches as a complete token or phrase boundary, so `guide` does not
  match `guideline`; punctuation around the keyword is allowed.
- The first configured match wins. Empty keywords and duplicates are discarded.
- Comments authored by the connected Instagram account are ignored.

### Request handling and errors

- Reject oversized payloads before processing.
- Reject missing or invalid webhook signatures with `401` before JSON parsing.
- Return `400` for malformed JSON or an unsupported payload shape.
- Process valid comment changes independently within a webhook batch.
- Use a bounded timeout for Meta API calls and parse Meta's structured error
  response without exposing the bearer token.
- Log per-comment outcomes and return `200` after a valid delivery is processed,
  including an aggregate sent/ignored/failed summary in the response for local
  debugging. Meta failures are not persisted or automatically retried by the
  application.
- Emit one-line structured JSON logs with request/event IDs and status. Never
  log secrets, signatures, full request bodies, access tokens, comment text,
  usernames, account IDs, or private reply text.
- The health endpoint reports configuration readiness only and never echoes a
  secret value.

## Dashboard design direction

The existing operations-console identity remains intact. Its memorable element
is the left-to-right `comment -> keyword -> private reply` signal rail, which
explains the automation without implying stored analytics.

### Visual tokens

- Ink: `#17211B` for primary text.
- Paper: `#F4F7F2` for the page background.
- Surface: `#FFFFFF` for working panels.
- Moss: `#2E6B4F` for active/success states.
- Citrus: `#D7F56B` for the single high-attention signal accent.
- Fault: `#B9473D` for failed setup states.
- Typography: `Manrope` for interface and display text, with a system fallback.

### Layout

Desktop:

```text
+----------------------+-----------------------------------------------+
| Brand + status       | Heading + automation status                   |
|                      +-----------------------------------------------+
| Overview             | comment ---- keyword ---- private reply       |
| Setup                +--------------------------+--------------------+
|                      | Configured keywords      | Setup checks       |
| webhook status       +--------------------------+--------------------+
|                      | Stateless tutorial scope note                 |
+----------------------+-----------------------------------------------+
```

Mobile keeps the top identity/status row, compact navigation, vertical signal
rail, keyword rule, setup checks, and scope note. Content remains left-aligned.
The current palette, typography, borders, status chips, responsive behavior,
focus treatment, and reduced-motion support are preserved.

### Design self-review

Removing counters and the activity table could leave an empty generic settings
page. The revised layout keeps the subject-specific signal rail as the focal
point and replaces the data regions with two useful concepts only: what is
configured and what the stateless tutorial deliberately does not retain. No
mock statistics or fake activity are introduced.

## Planned files

```text
app/
  api/health/route.ts
  api/webhooks/instagram/route.ts
  globals.css
  layout.tsx
  page.tsx
components/
  dashboard.tsx
lib/
  server/config.ts
  server/logger.ts
  instagram/client.ts
  instagram/signature.ts
  instagram/webhook.ts
  matching.ts
tests/
  matching.test.ts
  signature.test.ts
  webhook.test.ts
.env.example
README.md
```

There is no `db/`, migration script, database module, or persistence dependency.

## Environment variables

- `META_APP_SECRET`
- `META_WEBHOOK_VERIFY_TOKEN`
- `META_INSTAGRAM_ACCESS_TOKEN`
- `META_INSTAGRAM_ACCOUNT_ID`
- `META_GRAPH_API_VERSION` (example: `v26.0`; intentionally explicit)
- `INSTAGRAM_KEYWORDS`
- `INSTAGRAM_PRIVATE_REPLY_TEXT`
- `DASHBOARD_USERNAME`
- `DASHBOARD_PASSWORD`

## Verification plan

- Unit-test Unicode/case-insensitive keyword boundaries and first-match order.
- Unit-test valid, invalid, malformed, and missing webhook signatures.
- Unit-test comment payload extraction, batching, unrelated fields, and missing
  optional webhook properties.
- Unit-test stateless event decisions, per-request duplicate filtering, and
  response summaries without calling Meta.
- Type-check, lint, run tests, and create an optimized production build.
- Exercise webhook verification and signed POST requests locally with fixtures.
- Review the simplified dashboard at desktop and mobile widths, including focus,
  contrast, setup states, and reduced-motion behavior.

## Deployment checklist

- Configure all environment variables in the deployment platform.
- Deploy behind HTTPS with no response-body caching on webhook/health routes.
- Configure the Meta callback URL and verify token.
- Subscribe the Meta app to the `comments` webhook field.
- Enable `comments` notifications for the professional account through
  `/<INSTAGRAM_ACCOUNT_ID>/subscribed_apps`.
- Confirm the access token contains `instagram_business_basic` and
  `instagram_business_manage_comments`; complete App Review/Advanced Access and
  Business Verification before serving accounts without an app role.
- Send a real test comment and confirm the private reply.
- Before extending this tutorial into a production service that needs
  exactly-once behavior or history, add durable storage and idempotency as a
  separate architectural step.
