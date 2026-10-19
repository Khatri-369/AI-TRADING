import 'dotenv/config';
import { appDiagnostics } from '../server/push/diagnostics';
import { RedisNewsQueue } from '../server/push/newsQueue';

// Read-only: never creates a subscription, acquires a lease, enqueues, or sends a push.
async function main() {
  const required = ['ONESIGNAL_APP_ID', 'ONESIGNAL_REST_API_KEY', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'PUBLIC_SITE_URL'];
  const missing = required.filter(key => !process.env[key]);
  if (missing.length) { console.log(JSON.stringify({ missing })); process.exitCode = 1; return; }
  const app = await appDiagnostics(process.env.ONESIGNAL_APP_ID!, process.env.ONESIGNAL_REST_API_KEY!, process.env.PUBLIC_SITE_URL);
  const queue = new RedisNewsQueue(process.env.UPSTASH_REDIS_REST_URL, process.env.UPSTASH_REDIS_REST_TOKEN, process.env.ONESIGNAL_APP_ID);
  const counts = await queue.counts();
  const origin = new URL(process.env.PUBLIC_SITE_URL!);
  if (origin.protocol !== 'https:' || origin.username || origin.password) throw new Error();
  const response = await fetch(new URL('/api/notifications/config', origin), {redirect:'error',signal:AbortSignal.timeout(8000)});
  const config = await response.json();
  console.log(JSON.stringify({ app, queue: counts, production: { httpStatus: response.status, configured: config.configured === true, appMatchesLocal: config.appId === process.env.ONESIGNAL_APP_ID } }));
  if (app.status !== 'ok' || app.originMatches === false || app.messageableSubscriptions === 0 || !config.configured || !response.ok || config.appId !== process.env.ONESIGNAL_APP_ID) process.exitCode = 1;
}
main().catch(() => { console.error('Read-only push diagnostics failed. Check configuration, connectivity and provider access; no secrets displayed.'); process.exitCode = 1; });
