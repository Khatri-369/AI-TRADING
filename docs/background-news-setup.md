# Persistent market news notifications on Vercel

The existing `GET /api/cron/news` accepts only `Authorization: Bearer <CRON_SECRET>` (minimum 32 characters, exact constant-time comparison). It polls the configured Finnhub global news API and Business Standard Indian markets RSS. No Gemini calls, sentiment filters, importance filters, fifteen-minute cutoff, or three-story cap apply to OneSignal delivery.

## Required setup

Create a persistent Upstash Redis database (Vercel Marketplace or Upstash console). Enable durable storage, keep eviction disabled, and monitor storage/command quotas. Do not use an expiring development database. Use its read/write REST token, not the read-only token.

Set these **backend-only** environment variables in Vercel Production, then deploy:

- `UPSTASH_REDIS_REST_URL`: database HTTPS REST URL.
- `UPSTASH_REDIS_REST_TOKEN`: private read/write REST token.
- `ONESIGNAL_APP_ID`: the public app UUID from your own OneSignal dashboard.
- `ONESIGNAL_REST_API_KEY`: private App API key for that same app.
- `CRON_SECRET`: at least 32 random characters, identical to the scheduler header.
- `FINNHUB_API_KEY`: existing global news credential. Indian RSS requires no key.
- Keep existing `SESSION_SECRET` and other application settings. `PUBLIC_SITE_URL` may remain but is no longer used for headline notification links: they open the publisher's article directly.

Never prefix private keys with `VITE_`, commit `.env`, or put a secret in a URL. `/api/notifications/config` reports configured only when OneSignal and Redis settings are present; this is not a live credential check.

## Scheduler

In cron-job.org create a GET job for `https://YOUR-DOMAIN/api/cron/news`, every five minutes. Add custom header `Authorization: Bearer YOUR_CRON_SECRET`. Enable response history and failure alerts. Deploy and configure the database before enabling the job. No browser tab needs to stay open. Vercel function maximum duration is set to 60 seconds; the worker starts no new sends after its 20-second work budget and uses bounded request timeouts. If the scheduler times out, do not assume failure or clear records: the next invocation resumes safely.

## Database migration and first run

No SQL migration or new npm runtime package is needed. Redis keys are created lazily by atomic Lua scripts in `server/push/newsQueue.ts`. All keys use `tradexa:news:v1:{ONESIGNAL_APP_ID}:`:

- `records`: hash of canonical URL digest -> immutable first-observed article, attempts, first attempt timestamp, state, error and accepted message ID. The article field is a JSON string to preserve arrays through Lua.
- `pending`: sorted set ordered by next attempt time.
- `review`: set of records needing operator reconciliation.
- `lock`: short-lived owner lease, only its owner can mutate delivery state.
- `poll`: persistent last feed check timestamp; redundant cron retries do not repoll providers within four minutes.
- `cooldown`: shared provider retry time, respected across cold starts.

Records and deduplication markers have **no TTL**. Never clear/evict them or change the namespace to fix a notification problem. Use the same database and App ID for every production instance; keep previews on a separate OneSignal app/database and do not schedule them against production.

This is a new durable delivery ledger. It cannot infer which articles an older nonpersistent sender already sent. On first run, every article currently returned by the feeds is newly detected and queued, including older articles. Expect an initial backlog. If you must avoid overlap with an existing sender, stop that sender and reconcile its accepted message history into this ledger before enabling the new job. There is no silent baseline or age-based discard.

## Delivery and failure behavior

Each notification includes the full headline, publisher, and direct article URL, targeting only `market_news=on` subscriptions. Phones may visually truncate long notification text. Source links are canonicalized by removing fragments and known tracking parameters while retaining meaningful query parameters. Syndicated stories at distinct publisher URLs remain distinct articles.

Every valid observed article is persisted before any sends. The job attempts up to 40 items, at most two requests per second, within the work budget. Excess items remain pending. At a five-minute schedule the theoretical ceiling is 480 requests/hour, and network latency reduces it; monitor growing backlogs. This implementation does not promise immediate delivery during a burst.

Only a successful OneSignal response with a nonempty message ID marks an item accepted. Acceptance is not proof of handset receipt. A database failure after provider acceptance, a timeout, process termination or cold start retries the **same deterministic OneSignal idempotency key and stored payload**. A two-minute lease/visibility delay recovers crashed jobs. Overlapping invocations cannot drain the queue simultaneously.

429 responses persist a global cooldown honoring numeric or HTTP-date Retry-After. 401/403, 5xx, network failures and empty IDs also pause requests and retain the backlog. Other per-article failures are retained with exponential backoff (five minutes up to one day), while remaining articles proceed. No failed item is permanently marked delivered. Feed outages still allow queued articles to drain; partial coverage is logged and returned as degraded. Feeds are checked once per scheduled interval; no Gemini analysis runs. Provider feeds expose finite windows, so articles never returned between polls cannot be recovered by this system.

OneSignal retains idempotency keys for 30 days. Requests unresolved for 28 days move to `review` and generate an error rather than risk an automatic duplicate outside that window. Operators must reconcile against OneSignal message history: mark accepted if confirmed, or deliberately requeue only after confirming no delivery. The application retains these records indefinitely. Exactly-once handset delivery cannot be guaranteed by a third-party push service or an indefinitely ambiguous network result.

Cron responses include `detected`, `accepted`, `failed`, `pending`, `review`, and `feedUnavailable`. Concurrent jobs return `skipped: job-already-running`. Failure/review/provider degradation returns HTTP 503; missing auth 401; missing configuration 503. Stored retries survive these responses. Structured logs include article digest, attempt, sanitized reason and next retry time, never API keys or raw provider response bodies. Review failed scheduler runs, pending growth, Redis quotas and OneSignal delivery reports.

## Phone registration

Use OneSignal Web Push Custom Code with the exact production HTTPS origin. Configure worker `/onesignal/OneSignalSDKWorker.js`, scope `/onesignal/`; keep `/sw.js` for offline caching. Do not add another SDK initialization to `index.html`.

Open the deployed app and enable background alerts, select **All market news**, and leave **Quiet hours off**. Confirm a subscribed device with `market_news=on` in OneSignal. Watchlist/quiet settings pause background sends. On iOS 16.4+, install through Safari Add to Home Screen and grant notifications from that installed app. Test only your own subscription from OneSignal, then lock the phone. Browser/OS restrictions, Focus, battery saving, offline devices, and force-stopped browsers can delay or prevent delivery; notification TTL is 24 hours.

## Verification

`npm run lint`, `npm test`, `npm run build`, and `npm run build:vercel`. Unit tests cover tracking URL deduplication, cross-instance retries, long-lived accepted markers, all headlines without age/sentiment filters, backlog draining, partial failures, provider cooldown, acceptance followed by failed storage, lease contention, feed failures and manual-review retention. Browser regression: `npx playwright test tests/browser/background-push.spec.ts tests/browser/news-notifications.spec.ts` after building.

Live Redis credentials, scheduled execution, and locked-phone receipt must be verified after deployment. Automated provider tests do not send real notifications.

Official references:
- https://upstash.com/docs/redis/features/restapi
- https://documentation.onesignal.com/reference/idempotent-notification-requests
- https://documentation.onesignal.com/reference/rate-limits
- https://documentation.onesignal.com/docs/en/web-sdk-setup


## Registration recovery and safe diagnostics

Browser permission alone is not a push subscription. The application now waits for OneSignal user/subscription change events and verifies the SDK's real user and subscription IDs against OneSignal from the backend. `market_news` is a **user tag**, not a property on the subscription object. `addTag()` updates local state synchronously; its return is not confirmation that OneSignal has saved the tag. The backend returns only registration/subscription/tag readiness booleans, never tokens or other user details. Verification is CSRF-protected, input-validated and rate-limited. It does not create users or subscriptions.

Run `npm run verify:push` locally for read-only app-origin, subscriber-count, production-App-ID and queue checks. It prints no secret values and sends no push. After deployment, `GET /api/notifications/diagnostics` with the same private Bearer cron credential provides read-only aggregate OneSignal diagnostics. Do not use `/api/cron/news` as a connection test: that endpoint processes the real queue.

If diagnostics show zero messageable subscriptions, there is no eligible device to send to. If they show messageable subscriptions but a create request reports no matching recipients, inspect each user's `market_news=on` tag and push status. This distinction is diagnostic, not a reason to broadcast to all users or invent subscriptions. Provider auth, invalid-filter, quota, missing-ID and partial-recipient errors have distinct sanitized codes. A successful message ID with recipient warnings is retained as accepted to avoid resending to users already targeted.

OneSignal dashboard checklist (same existing app; do not change App ID or queue namespace):
1. Settings → Push & In-App → Web: use Custom Code integration and the exact stable production HTTPS origin, `https://ai-trading-ochre.vercel.app` for this deployment. Both Chrome/Web and Safari site origins must match the site being used; preview deployment URLs are different origins.
2. Worker path `/onesignal/OneSignalSDKWorker.js`, scope `/onesignal/`. The root `/sw.js` remains the offline application worker. Do not add another inline SDK initializer or unregister all workers as a workaround.
3. Reload the production app after saving dashboard settings. On Android use a normal supported browser tab (not private mode). On iPhone/iPad use iOS 16.4+ and Safari → Add to Home Screen, then open the installed app.
4. In TRADEXA choose All market news, Quiet hours off, and Enable news alerts. Wait for **All market news confirmed**. In OneSignal Audience → Subscriptions confirm a real Subscribed device and the user's `market_news=on` tag. If a plan tag limit blocks saving the tag, free capacity or adjust the plan; do not remove the filter from the sender.
5. Mark your own subscription as a test subscription in OneSignal and use Send test to that subscription only. Lock the phone and verify receipt. The local app demo only proves browser notification permission.

If the wrong origin cannot be edited in your existing OneSignal app, contact OneSignal support before creating another app: changing App ID would select another Redis namespace and requires a planned migration of pending records.

The deployed checks during the registration investigation found 135 pending records and no subscribers. These records were inspected read-only, not reset or marked accepted. The new optional `deliveryGeneration` field defaults to zero for existing records, preserving their previous idempotency keys. Only an explicit HTTP 200 no-subscribed-recipients rejection proves no notification was created; this persists a new retry generation so a previously rejected request can be retried after audience repair without replaying the cached rejection. Unknown outcomes, empty IDs without an explicit rejection, timeouts and storage failures retain the original key. No queue migration, deletion or re-enqueue operation is required.

A cron HTTP 401 is independent of subscriber state. New logs distinguish missing authorization, invalid Bearer scheme, secret mismatch and unconfigured server secret without recording the header. Copy the same private secret into Vercel and the scheduler's Authorization header; preserve the `Bearer ` prefix. An unauthenticated verification request correctly gets 401. Old logs without these reason codes cannot establish which authentication mistake occurred.

The Vercel handler now trusts exactly one platform edge hop, validates the platform IP header, and removes the unsupported/conflicting RFC Forwarded chain before Express rate limiting. This follows Vercel's overwrite guarantees; arbitrary Forwarded input is never used as an identity. Authentication and rate limiting remain enabled. Other hosting paths keep their configured trust policy.

References:
- https://documentation.onesignal.com/docs/en/web-sdk-reference
- https://documentation.onesignal.com/reference/view-user
- https://documentation.onesignal.com/reference/push-notification
- https://vercel.com/docs/headers/request-headers
- https://express-rate-limit.mintlify.app/reference/error-codes
# Article-specific notification labels

New notifications show the publisher, headline and article-linked stock symbols. Missing quotes do not substitute unrelated market leaders. If the feed provides no supported company link, the notification says “No specific stock identified”; these labels indicate relevance, not a prediction or proof of price impact. Test notifications are explicitly labeled as tests.

New Redis queue records persist `notificationBody` so retries use an identical payload. Existing records without that optional field retain their original headline payload. No migration or queue reset is needed. Browser subscription recovery is enabled only for users whose saved preferences enable device alerts for all news with quiet mode off; browser permission remains required.

