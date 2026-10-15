# Signal Desk

A small, single-account Instagram comment-to-DM automation built with Next.js
and TypeScript. It validates Meta webhooks, matches server-configured keywords,
sends Meta's supported private reply, and presents a safe readiness dashboard.

This tutorial is deliberately **database-free and stateless**. Read
[PLAN.md](./PLAN.md) first for the architecture, request flow, security model,
and reliability tradeoffs.

## Architecture at a glance

```text
Instagram comment
       |
       v
Meta webhook --> raw-body HMAC check --> event filtering --> keyword match
                                                           |
                                                           v
                                             Meta Private Replies API
```

- `GET /api/webhooks/instagram` handles Meta's verification challenge.
- `POST /api/webhooks/instagram` reads the raw body, validates
  `X-Hub-Signature-256`, parses supported comment events, and handles each
  event in the same request.
- Keywords and the private reply are loaded from server-side environment
  variables. Secrets and the reply text are never passed to browser code.
- The dashboard derives readiness from safe configuration presence only. It
  does not display fake metrics or stored activity.
- Structured logs describe request IDs, event IDs, and outcomes without
  logging signatures, tokens, secrets, comment text, or reply text.

There is no database, ORM, cache, queue, or replacement persistence layer.
Duplicate comment IDs are filtered only within one webhook request. Durable
idempotency across Meta retries and persistent activity history are
intentionally outside this beginner tutorial's scope; add a database later if
your production requirements need either capability.

## Requirements

- Node.js 20.9 or newer
- A Meta app configured for **Instagram API with Instagram Login**
- An Instagram professional account (business or creator)
- `instagram_business_basic` and `instagram_business_manage_comments`

The app does not use deprecated Instagram Basic Display scopes or invent a
custom DM endpoint. It uses Meta's documented `/<IG_USER_ID>/messages`
endpoint and supplies the Instagram comment ID as `recipient.comment_id`.

## Run locally

```bash
npm install
Copy-Item .env.example .env.local
npm run dev
```

On macOS or Linux, replace the copy command with:

```bash
cp .env.example .env.local
```

Replace every placeholder in `.env.local`, then open
`http://localhost:3000`. In development, dashboard Basic Auth is bypassed only
when both dashboard credential variables are absent. In production, missing
dashboard credentials produce a safe `503` response.

## Environment variables

| Name | Purpose |
| --- | --- |
| `META_APP_SECRET` | Verifies `X-Hub-Signature-256` |
| `META_WEBHOOK_VERIFY_TOKEN` | Verifies Meta's GET challenge |
| `META_INSTAGRAM_ACCESS_TOKEN` | Server-only Instagram user access token |
| `META_INSTAGRAM_ACCOUNT_ID` | Professional account that owns the media |
| `META_GRAPH_API_VERSION` | Explicit Graph version, currently `v26.0` |
| `INSTAGRAM_KEYWORDS` | Comma-separated words or phrases |
| `INSTAGRAM_PRIVATE_REPLY_TEXT` | One private reply message, maximum 1,000 characters |
| `DASHBOARD_USERNAME` | HTTP Basic Auth username |
| `DASHBOARD_PASSWORD` | HTTP Basic Auth password |

Never prefix these variables with `NEXT_PUBLIC_`. Access tokens, app secrets,
account IDs, verify tokens, and private reply text stay on the server and are
not included in dashboard props or API responses.

## Meta configuration

Deploy the app behind HTTPS and use this callback URL:

```text
https://your-domain.example/api/webhooks/instagram
```

In the Meta App Dashboard:

1. Add the callback URL and use the same value as
   `META_WEBHOOK_VERIFY_TOKEN` for the verify token.
2. Subscribe the Instagram webhook product to the `comments` field.
3. Ensure the Instagram user access token grants
   `instagram_business_basic` and `instagram_business_manage_comments`.
4. Enable comment notifications for the professional account with Meta's
   documented request (run this outside the application):

   ```bash
   curl -i -X POST \
     "https://graph.instagram.com/v26.0/<INSTAGRAM_ACCOUNT_ID>/subscribed_apps?subscribed_fields=comments&access_token=<INSTAGRAM_USER_ACCESS_TOKEN>"
   ```

5. Put the app in Live mode and complete the access and business-review steps
   required for accounts whose owners do not have a role on the app.

Meta's Private Replies documentation currently allows one private reply to a
comment within seven days of the comment. Live-comment replies must be sent
during the live broadcast. This tutorial does not send automated follow-ups.

## Matching behavior

Matching is case-insensitive and uses Unicode NFKC normalization. Keywords are
matched at token boundaries, so `guide` matches `guide!` but not `guideline`.
The first configured match wins. Empty and duplicate keyword entries are
discarded.

## Operational behavior

- `GET /api/health` reports configuration-based webhook and automation
  readiness. It performs no database or external API check and returns no
  secret values.
- Valid webhook deliveries receive a quick aggregate result. Individual event
  failures are logged safely and do not make Meta retry every event in the
  batch.
- A malformed payload, invalid signature, or oversized body is rejected with a
  safe error response.
- Because the app is stateless, a later Meta retry can repeat a private-reply
  attempt. Meta may reject that repeat because only one private reply is
  allowed. For exactly-once behavior, add durable idempotency storage as a
  separate production enhancement.
- No activity history, counters, event records, or comment previews are stored.

## Verification

Run all local code checks:

```bash
npm run check
```

Or run them individually:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Official Meta references

- [Private Replies](https://developers.facebook.com/documentation/instagram-platform/private-replies)
- [Instagram Webhooks](https://developers.facebook.com/documentation/instagram-platform/webhooks)
- [Set up Instagram Webhooks](https://developers.facebook.com/documentation/instagram-platform/webhooks/setup)
- [Instagram webhook fields and permissions](https://developers.facebook.com/documentation/instagram-platform/webhooks/fields)
