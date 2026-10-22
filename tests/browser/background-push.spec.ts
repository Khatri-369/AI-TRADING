import { test, expect } from '@playwright/test';

for (const slowInit of [false, true]) test(`OneSignal shared worker registers and recovers from slow initialization (${slowInit})`, async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('markets.alerts.settings.v1', JSON.stringify({ enabled: true, device: true, scope: 'all', quiet: false }));
    Object.defineProperty(window, 'Notification', { value: class { static permission = 'granted'; static requestPermission = async () => 'granted'; } });
  });
  await page.route('**/api/notifications/config', route => route.fulfill({ json: { provider: 'onesignal', configured: true, appId: 'c93d06ef-e58a-43a0-8f00-87a7b632f11a', publicKey: null, intervalMinutes: 5 } }));
  await page.route('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js', route => route.fulfill({ contentType: 'application/javascript', body: `
    window.sdkLoads = (window.sdkLoads || 0) + 1;
    window.pushCalls = [];
    const tags = {};
    const sdk = { Notifications: { isPushSupported: () => true, requestPermission: () => new Promise(() => {}), addEventListener: () => {} }, init: async options => { window.initCount = (window.initCount || 0) + 1; window.workerOptions = options; await new Promise(resolve => setTimeout(resolve, ${slowInit ? 17000 : 0})); if (options.autoResubscribe) await new Promise(() => {}); }, User: {
      onesignalId: 'c93d06ef-e58a-43a0-8f00-87a7b632f11a', getTags: () => tags, addEventListener: () => {},
      addTag: (key, value) => { tags[key] = value; window.pushCalls.push(key + '=' + value); },
      PushSubscription: { addEventListener: () => {}, id: 'c93d06ef-e58a-43a0-8f00-87a7b632f11ab', optedIn: false,
        optIn: async function() { this.optedIn = true; window.pushCalls.push('opt-in'); },
        optOut: async function() { this.optedIn = false; window.pushCalls.push('opt-out'); }
      }
    }};
    window.OneSignalDeferred.forEach(callback => callback(sdk));
  ` }));
  await page.route('**/api/notifications/verify', route => route.fulfill({ json: { registered: true, subscribed: true, tagged: true, ready: true } }));
  await page.route('**/api/workspace/session', route => route.fulfill({ json: { user: null } }));
  await page.route('**/api/markets/overview', route => route.fulfill({ json: { quotes: [], generatedAt: new Date().toISOString() } }));
  await page.route('**/api/news', route => route.fulfill({ json: { articles: [], provider: 'Fixture', status: 'unavailable', cached: false, fetchedAt: null } }));
  await page.route('**/api/stream/live-ticks', route => route.abort());
  await page.goto('/');
  if (slowInit) {
    await page.getByRole('button', { name: 'Desktop app and news alerts' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Push setup delayed while initializing OneSignal configuration' })).toBeVisible({ timeout: 20000 });
    await page.getByRole('button', { name: 'Close desktop settings' }).click();
  }
  const calls = () => page.evaluate(() => (window as unknown as { pushCalls: string[] }).pushCalls);
  await expect.poll(calls).toContain('market_news=on');
  expect(await page.evaluate(() => (window as unknown as { workerOptions: { serviceWorkerParam: { scope: string } } }).workerOptions.serviceWorkerParam.scope)).toBe('/');
  expect(await page.evaluate(() => (window as unknown as { workerOptions: { autoResubscribe: boolean } }).workerOptions.autoResubscribe)).toBe(false);
  await page.getByRole('button', { name: 'Desktop app and news alerts' }).click();
  await page.getByRole('button', { name: 'Disable background alerts' }).click();
  await expect.poll(async () => (await calls()).at(-1)).toBe('opt-out');
  await expect(page.getByRole('status').filter({ hasText: 'Background news notifications are off.' })).toBeVisible();
  await page.getByRole('button', { name: 'Enable news alerts', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Device registered with OneSignal' })).toBeVisible();
  await page.evaluate(() => {
    const settings = { enabled: true, device: true, scope: 'watchlist', quiet: false };
    localStorage.setItem('markets.alerts.settings.v1', JSON.stringify(settings));
    window.dispatchEvent(new CustomEvent('market-alert-settings-changed', { detail: settings }));
  });
  await expect.poll(async () => (await calls()).at(-1)).toBe('opt-out');
  expect(await page.evaluate(() => ({ loads: (window as unknown as { sdkLoads: number }).sdkLoads, inits: (window as unknown as { initCount: number }).initCount, appId: (window as unknown as { workerOptions: { appId: string } }).workerOptions.appId }))).toEqual({ loads: 1, inits: 1, appId: 'c93d06ef-e58a-43a0-8f00-87a7b632f11a' });
  expect(errors).toEqual([]);
  expect((await page.request.get('/api/cron/news')).status()).toBe(401);
});

for (const remoteTagged of [true, false]) test(`late OneSignal subscription is verified and missing audience tags are reported (${remoteTagged})`, async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('markets.alerts.settings.v1', JSON.stringify({enabled:true,device:true,scope:'all',quiet:false}));
    Object.defineProperty(window,'Notification',{value:class {static permission='granted';static requestPermission=async()=> 'granted';}});
  });
  await page.route('**/api/notifications/config', route=>route.fulfill({json:{provider:'onesignal',configured:true,appId:'c93d06ef-e58a-43a0-8f00-87a7b632f11a',publicKey:null,intervalMinutes:5}}));
  let checks = 0;
  await page.route('**/api/notifications/verify',route=>{checks++;return route.fulfill({json:{registered:true,subscribed:true,tagged:remoteTagged,ready:remoteTagged}});});
  await page.route('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js',route=>route.fulfill({contentType:'application/javascript',body:`
    let listener; const tags={};
    window.sdkLoads=(window.sdkLoads||0)+1;
    const sdk={init:async()=>{}, Notifications:{isPushSupported:()=>true,addEventListener:()=>{}},User:{
      onesignalId:undefined,addEventListener:()=>{},getTags:()=>tags,addTag:(k,v)=>{tags[k]=v;},
      PushSubscription:{id:undefined,optedIn:false,optIn:async()=>{},optOut:async()=>{},addEventListener:(event,cb)=>{listener=cb;}}
    }};
    window.completeRegistration=()=>{sdk.User.onesignalId='c93d06ef-e58a-43a0-8f00-87a7b632f11a';sdk.User.PushSubscription.id='c93d06ef-e58a-43a0-8f00-87a7b632f11b';sdk.User.PushSubscription.optedIn=true;listener();};
    window.OneSignalDeferred.forEach(cb=>cb(sdk));
  `}));
  await page.route('**/api/workspace/session',route=>route.fulfill({json:{user:null}}));
  await page.route('**/api/markets/overview',route=>route.fulfill({json:{quotes:[],generatedAt:new Date().toISOString()}}));
  await page.route('**/api/news',route=>route.fulfill({json:{articles:[],provider:'Fixture',status:'unavailable',cached:false,fetchedAt:null}}));
  await page.route('**/api/stream/live-ticks',route=>route.abort());
  await page.goto('/');
  await page.getByRole('button',{name:'Desktop app and news alerts'}).click();
  await page.getByRole('button',{name:'Enable news alerts',exact:true}).click();
  await expect(page.getByRole('status').filter({hasText:'Device registration is pending'})).toBeVisible();
  expect(checks).toBe(0);
  await page.evaluate(()=> (window as unknown as {completeRegistration:()=>void}).completeRegistration());
  await expect(page.getByRole('status').filter({hasText:remoteTagged?'All market news confirmed':'market_news tag is not confirmed'})).toBeVisible();
  expect(await page.evaluate(()=>(window as unknown as {sdkLoads:number}).sdkLoads)).toBe(1);
});
