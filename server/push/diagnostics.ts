import { z } from 'zod';

export const deviceCheckSchema = z.object({
  userId: z.string().uuid(),
  subscriptionId: z.string().uuid(),
});

const userSchema = z.object({
  properties: z.object({
    tags: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
  }).passthrough().optional(),
  subscriptions: z.array(z.object({
    id: z.string().optional(),
    app_id: z.string().optional(),
    type: z.string().optional(),
    enabled: z.boolean().optional(),
    token: z.string().optional(),
    notification_types: z.number().optional(),
  }).passthrough()).default([]),
}).passthrough();

export function summarizeDevice(raw: unknown, appId: string, subscriptionId: string) {
  const parsed = userSchema.safeParse(raw);
  if (!parsed.success) {
    return { registered: false, subscribed: false, tagged: false, ready: false };
  }
  const data = parsed.data;
  const subLower = subscriptionId.toLowerCase();
  const subscription =
    data.subscriptions.find(item => item.id?.toLowerCase() === subLower && (!item.app_id || item.app_id === appId)) ??
    (subscriptionId !== 'unknown'
      ? data.subscriptions.find(
          item =>
            (!item.app_id || item.app_id === appId) &&
            Boolean(item.type?.toLowerCase().endsWith('push')) &&
            item.enabled !== false &&
            (item.notification_types === undefined || item.notification_types > 0)
        )
      : undefined);
  const isPush = Boolean(subscription?.type && subscription.type.toLowerCase().endsWith('push'));
  const registered = Boolean(subscription && isPush);
  const subscribed = Boolean(
    subscription &&
      subscription.enabled !== false &&
      isPush &&
      (subscription.token === undefined || Boolean(subscription.token)) &&
      (subscription.notification_types === undefined || subscription.notification_types > 0)
  );
  const tagVal = data.properties?.tags?.market_news;
  const tagged = tagVal === 'on' || tagVal === '1' || tagVal === true || tagVal === 'true';
  return { registered, subscribed, tagged, ready: registered && subscribed && tagged };
}

export async function verifyDevice(appId: string, key: string, userId: string, subscriptionId: string, fetcher = fetch) {
  const cleanKey = key.trim();
  const response = await fetcher(`https://api.onesignal.com/apps/${appId}/users/by/onesignal_id/${userId}`, {
    headers: { Authorization: `Key ${cleanKey}` }, redirect: 'error', signal: AbortSignal.timeout(6000),
  });
  if (response.status === 404) return { registered: false, subscribed: false, tagged: false, ready: false };
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      const basicResponse = await fetcher(`https://api.onesignal.com/apps/${appId}/users/by/onesignal_id/${userId}`, {
        headers: { Authorization: `Basic ${cleanKey}` }, redirect: 'error', signal: AbortSignal.timeout(6000),
      }).catch(() => null);
      if (basicResponse?.ok) {
        return summarizeDevice(await basicResponse.json(), appId, subscriptionId);
      }
    }
    throw new Error(`Push verification provider HTTP ${response.status}`);
  }
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
