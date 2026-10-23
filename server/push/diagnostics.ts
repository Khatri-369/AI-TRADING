import { z } from 'zod';

export const deviceCheckSchema = z.object({ userId: z.string().uuid(), subscriptionId: z.string().uuid() }).strict();
const userSchema = z.object({
  properties: z.object({ tags: z.record(z.string(), z.string()).optional() }).optional(),
  subscriptions: z.array(z.object({ id: z.string(), app_id: z.string().optional(), type: z.string(), enabled: z.boolean(), token: z.string().optional(), notification_types: z.number().optional() })).default([]),
});
export function summarizeDevice(raw: unknown, appId: string, subscriptionId: string) {
  const data = userSchema.parse(raw);
  const subscription =
    data.subscriptions.find(item => item.id === subscriptionId && (!item.app_id || item.app_id === appId)) ??
    (subscriptionId !== 'unknown'
      ? data.subscriptions.find(
          item =>
            (!item.app_id || item.app_id === appId) &&
            item.type.endsWith('Push') &&
            item.enabled &&
            (item.notification_types === undefined || item.notification_types > 0)
        )
      : undefined);
  const registered = Boolean(subscription);
  const subscribed = Boolean(
    subscription?.enabled &&
      subscription.type.endsWith('Push') &&
      (subscription.token === undefined || Boolean(subscription.token)) &&
      (subscription.notification_types === undefined || subscription.notification_types > 0)
  );
  const tagged = data.properties?.tags?.market_news === 'on';
  return { registered, subscribed, tagged, ready: registered && subscribed && tagged };
}
export async function verifyDevice(appId: string, key: string, userId: string, subscriptionId: string, fetcher = fetch) {
  const response = await fetcher(`https://api.onesignal.com/apps/${appId}/users/by/onesignal_id/${userId}`, {
    headers: { Authorization: `Key ${key}` }, redirect: 'error', signal: AbortSignal.timeout(6000),
  });
  if (response.status === 404) return { registered: false, subscribed: false, tagged: false, ready: false };
  if (!response.ok) throw new Error(`Push verification provider HTTP ${response.status}`);
  return summarizeDevice(await response.json(), appId, subscriptionId);
}
export async function appDiagnostics(appId: string, key: string, expectedOrigin?: string, fetcher = fetch) {
  const response = await fetcher(`https://api.onesignal.com/apps/${appId}`, { headers: { Authorization: `Key ${key}` }, redirect: 'error', signal: AbortSignal.timeout(6000) });
  if (!response.ok) return { status: `provider-http-${response.status}` };
  const data = z.object({ id: z.string(), players: z.number().optional(), messageable_players: z.number().optional(), chrome_web_origin: z.string().nullish() }).parse(await response.json());
  let originMatches: boolean | null = null;
  if (expectedOrigin) {
    try { originMatches = new URL(data.chrome_web_origin ?? '').origin === new URL(expectedOrigin).origin; }
    catch { originMatches = false; }
  }
  return { status: 'ok', appMatches: data.id === appId, totalSubscriptions: data.players, messageableSubscriptions: data.messageable_players, originMatches };
}

/** Never log provider text: it can contain credentials, recipient IDs or user details. */
export function classifyPushResponse(status: number, body: unknown) {
  const data = body && typeof body === 'object' ? body as { id?: unknown; errors?: unknown } : {};
  if (status >= 200 && status < 300 && typeof data.id === 'string' && data.id) {
    return { id: data.id, warning: data.errors ? 'provider-partial-recipient-warning' : undefined };
  }
  if (status === 401 || status === 403) return { error: 'provider-auth-rejected' };
  if (status === 429) return { error: 'provider-rate-limited' };
  const errors = JSON.stringify(data.errors ?? '').toLowerCase();
  if (/not subscribed|no subscribed|no subscribers|no users|no recipients/.test(errors)) return { error: 'audience-no-subscribed-recipients', definitelyNotCreated: status === 200 }; 
  if (/filter|tag/.test(errors)) return { error: 'provider-audience-filter-rejected' };
  if (status < 200 || status >= 300) return { error: `provider-http-${status}` };
  return { error: data.errors ? 'provider-errors-without-message-id' : 'provider-missing-message-id' };
}
