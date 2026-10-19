# Closed-app news notifications on Vercel Hobby

This integration uses OneSignal Web Push for subscription storage and delivery, and an external scheduler to check news. No always-on Express host or Redis is required. The browser's local test alert does **not** test this delivery path.

## 1. Create the OneSignal app

Create a Web Push app in OneSignal. Choose **Custom Code** and set the exact HTTPS production domain (one origin per app). Copy its App ID and **App API key** from Settings → Keys & IDs. Do not use an organization API key.

The project provides `/onesignal/OneSignalSDKWorker.js` and uses `/onesignal/` as its scope. Match these in any custom service-worker dashboard settings. Keep the existing `/sw.js` registration: it handles offline caching and has a different scope. Disable OneSignal automatic prompts/welcome messages; the app owns permission controls.

## 2. Set server environment variables and deploy

- `ONESIGNAL_APP_ID`: public App ID.
- `ONESIGNAL_REST_API_KEY`: private App API key, backend only.
- `PUBLIC_SITE_URL`: exact production origin, such as `https://your-project.vercel.app`.
- `CRON_SECRET`: at least 32 random characters. Generate locally with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` and store securely.
- Keep existing news-provider credentials and `SESSION_SECRET` configured.

Never prefix these secrets with `VITE_`. Never commit `.env`. Deployment is a separate action; local edits do not update the public website.

`GET /api/notifications/config` should report `provider: "onesignal"` and `configured: true`. This confirms required settings exist, **not** that the credentials, schedule, or phone delivery have been verified.

## 3. Schedule the news check

For example, create a cron-job.org job (free tier) with:

- URL: `https://YOUR-DOMAIN/api/cron/news`
- Method: GET
- Frequency: every five minutes
- Custom header: `Authorization: Bearer YOUR_CRON_SECRET`
- Failure notifications: enabled

Enter the secret in the scheduler's private header field, never in the URL. Vercel Hobby's built-in cron runs only daily, so no frequent Vercel cron is added to this project. The endpoint returns 401 for an invalid secret, 503 for unavailable configuration/news, and a non-2xx response for provider rejection. Check job history for errors.

The job sends at most three newest articles published in the previous 15 minutes. Repeated jobs use the same OneSignal idempotency keys, including across cold starts; retries do not intentionally re-send the same article. An outage longer than the freshness window can miss news. `accepted` counts successful OneSignal responses, not handset delivery or uniquely new sends; an idempotent retry can return the original message ID.

News combines Finnhub's general global feed with Business Standard's published Indian markets RSS. Sources are cached independently and partial failures are disclosed. The job prioritizes one fresh story from each region when both are present, within the three-story cap. Push bodies include up to four related instrument symbols. These links are provider metadata or explicit company/ticker mentions, not claims of positive/negative impact or trading recommendations. RSS entries retain attribution and link to the original publisher; full article bodies are not copied.

## 4. Register and verify a phone

Open the deployed app. On iPhone/iPad (iOS 16.4+), add it to the Home Screen through Safari and open the installed app. Enable notifications, use **All market news**, and leave **Quiet hours off**. Open **Desktop app & news alerts → Enable news alerts** to register or retry. The existing settings sync the OneSignal `market_news` tag and subscription.

This initial free integration delivers all-market news only. Watchlist scope or quiet hours pauses OneSignal delivery rather than silently ignoring that preference; those filters still work for in-app alerts. Changes must successfully sync online before closing the app. Browser/OS notification controls can immediately block all delivery if connectivity prevents syncing an opt-out.

Confirm the device appears as subscribed in OneSignal and has tag `market_news=on`. Send a **test to that subscription only** from OneSignal's dashboard, lock the screen, and verify receipt. Then check a scheduled job and OneSignal message report for a real fresh headline. No frontend tab should be needed. The app's original test notification only verifies local notification permission.

Android battery restrictions, iOS Focus modes, denied permission, connectivity and force-stopped browsers can delay or prevent delivery. No implementation can guarantee immediate delivery on every locked phone.

## Official references

- https://documentation.onesignal.com/docs/en/web-sdk-setup
- https://documentation.onesignal.com/docs/en/web-sdk-reference
- https://documentation.onesignal.com/reference/push-notification
- https://vercel.com/docs/cron-jobs/usage-and-pricing
- https://cron-job.org/en/

## Troubleshooting a working test but missing news

A dashboard test confirms the device subscription, not the scheduled news sender. Check that the deployed `/api/notifications/config` reports OneSignal, the external job actually runs every five minutes, and its authenticated response includes `checked` and `accepted`. `skipped: "no-recent-news"` means no article was published in the last 15 minutes; `noRecipients` means OneSignal returned no message ID, so inspect active subscriptions and the `market_news=on` tag. A response containing only `count` comes from the older native push implementation: deploy this integration first.

Do not paste an additional OneSignal initialization into `index.html`: the application initializes it once using the backend App ID. Inline initialization is blocked by the production CSP and a root-scoped OneSignal worker competes with the offline worker. Existing users should reopen the updated app and enable background alerts to register the separate worker and news tag.
