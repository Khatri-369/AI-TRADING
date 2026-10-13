# Vercel website + persistent market backend

This deployment keeps the website on Vercel and runs the existing Express server on an always-on Node/Docker host. The browser uses the Vercel origin for `/api/*`; Vercel forwards those requests to the backend. API keys never enter the browser bundle. The backend maintains the Upstox connection and checks for new headlines every five minutes.

## Current status

Code, build output and local tests are prepared. No new Vercel project has been created: the local CLI is logged out and no public backend origin has been supplied. Web Push delivery to a real device has not been verified. Do not use a laptop/localhost URL as the production backend.

## 1. Run the backend

Use one always-on Node instance with a private persistent disk and HTTPS. A sleeping/free service cannot reliably check news while nobody visits. Do not run this worker on a serverless or ephemeral filesystem. Do not scale to multiple instances until the subscription store, quotas and upstream connection ownership are shared.

- Build: `npm ci && npm run build`
- Start: `npm start`
- Health check: `/api/health`
- Set `NODE_ENV=production`, `HOST=0.0.0.0`, the host's `PORT`, and a random `SESSION_SECRET` of at least 32 characters.
- Add the provider keys from local `.env` to the host's secret settings, including `UPSTOX_ANALYTICS_TOKEN`. Never use `PUBLIC_` or `VITE_` prefixes for private credentials.
- Set `ADMIN_DIAGNOSTICS_TOKEN` for protected diagnostics. Set `ANONYMOUS_AI_QUOTA_ENABLED=false` if public AI should stay disabled until access/budget policy is reviewed. The existing AI counters are process-local and reset on restart.
- Configure `TRUST_PROXY_HOPS` for the actual trusted proxy chain, checking client-IP rate limits behind Vercel before opening public AI access. Do not blindly trust arbitrary forwarded headers.
- For Docker, mount a persistent disk and make it writable by the non-root `node` user. Do not put the data under `dist/client` or `public`.
- Check that your data-provider agreements permit the intended public display and notification usage.

## 2. Configure optional background news alerts

Generate one VAPID key pair using `npx web-push generate-vapid-keys` in your private terminal. Save it in the backend's secret settings and retain it across deploys; key rotation requires browsers to re-subscribe.

Backend variables:

```text
VAPID_PUBLIC_KEY=<generated public key>
VAPID_PRIVATE_KEY=<generated private key>
VAPID_SUBJECT=https://your-public-website.example
PUSH_STORE_PATH=/data/news-subscriptions.json
```

`VAPID_SUBJECT` can also be a monitored `mailto:` contact. The public key is deliberately returned to browsers; the private key never is. Without a valid setup the UI shows alerts as unconfigured and does not request notification permission.

Subscription storage contains sensitive push endpoints and encryption material. Restrict access and backups to operators. Unsubscribing removes the matching record; expired/revoked endpoints are pruned. Renew the browser subscription within 90 days. The current store is bounded to 1,000 browser subscriptions.

The worker sends at most one newest headline per subscriber per check, only for headlines published after opt-in and within the last six hours. Duplicate IDs are reserved on disk before delivery, favoring suppression of duplicate alerts over guaranteed delivery after a crash or transient failure. This is a latest-news notification feed, not a guarantee to deliver every article or an instant trading signal. Only supported push-service hosts are accepted to avoid arbitrary outbound requests.

## 3. Create a NEW Vercel project

1. Sign in to Vercel and choose **Add New → Project → Import Git Repository**.
2. Select `Khatri-369/AI-TRADING`. Use the branch containing these changes. Choose a new project name such as `global-markets-research`; do not select or overwrite an existing unrelated project.
3. Use **Other** as the framework preset. The checked-in `vercel.json` selects `npm run build:vercel`. Leave Output Directory unset: the script produces Vercel Build Output API files under `.vercel/output`.
4. Add `BACKEND_ORIGIN` containing the backend HTTPS origin, for example `https://your-backend.example` (no `/api` suffix, credentials, query, or path). Do not add provider keys to the frontend project.
5. Deploy. Without a backend origin, the build intentionally fails instead of publishing a website with broken APIs.

CLI alternative, after signing in with `npx vercel login`: link a new project with `npx vercel link`, set `BACKEND_ORIGIN` using Vercel environment settings, then create a preview deployment with `npx vercel`. Verify the preview before promoting production. Never deploy prebuilt artifacts containing a test/example backend origin.

The same-origin API proxy preserves frontend API paths. SSE may disconnect at proxy/platform limits; EventSource reconnects and the app falls back to its quote polling. Verify the real deployment's streaming behavior before describing it as uninterrupted streaming.

## 4. Verify, install and enable notifications

- Visit `/api/health` and `/api/notifications/config` on the Vercel URL. Confirm neither leaks secrets.
- Verify actual quotes, history, chatbot access, source timestamps and stream reconnection.
- Open **Desktop app and news alerts** (download icon in the header). Install using the button when supported, or Chrome/Edge's install-app menu. A shortcut by itself does not grant notification permission.
- Click **Enable news alerts** and approve the browser permission. Close the app window and confirm delivery of a genuinely new provider headline after a server check; click the notification and verify it opens `/news`.
- Disable alerts and confirm the backend record disappears and no further notifications arrive.
- Check browser/OS notification settings and Do Not Disturb if messages are not displayed. A powered-off/offline device or fully disabled browser background services cannot guarantee immediate delivery.
- On supported iPhone/iPad versions, install through Safari's Add to Home Screen first. Browser support varies.
- Test offline launch: the app shows an explicit offline page; it does not present stored market prices as current.

## Rollback

Keep the backend and VAPID keys stable across frontend releases. Revert/promote a known-good frontend deployment using Vercel. Back up the private subscription file before backend upgrades; do not restore an old file containing subscriptions that users have since revoked. Disable the worker by removing its push configuration and restarting if delivery must be suspended.

References: [Vercel function duration limits](https://vercel.com/docs/functions/limitations), [Build Output API](https://vercel.com/docs/build-output-api), [Web app service workers and push](https://web.dev/learn/pwa/service-workers).
