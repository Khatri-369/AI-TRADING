import test from 'node:test';
import assert from 'node:assert/strict';
import { appDiagnostics, classifyPushResponse, summarizeDevice, verifyDevice } from './diagnostics';
const appId = 'c93d06ef-e58a-43a0-8f00-87a7b632f11a';
const subId = 'c93d06ef-e58a-43a0-8f00-87a7b632f11b';
test('provider response classification separates recipient, targeting, auth, quota and malformed responses without leaking errors', () => {
  assert.equal(classifyPushResponse(200, {id:'', errors:['All included players are not subscribed']}).error, 'audience-no-subscribed-recipients');
  assert.equal(classifyPushResponse(200, {id:'', errors:['All included players are not subscribed']}).definitelyNotCreated, true);
  assert.equal(classifyPushResponse(400, {errors:['Invalid filters: secret']}).error, 'provider-audience-filter-rejected');
  assert.equal(classifyPushResponse(401, {errors:['private-token']}).error, 'provider-auth-rejected');
  assert.equal(classifyPushResponse(429, {}).error, 'provider-rate-limited');
  assert.equal(classifyPushResponse(200, {}).error, 'provider-missing-message-id');
  assert.equal(classifyPushResponse(200, {errors:{internal:'secret'}}).error, 'provider-errors-without-message-id');
  assert.deepEqual(classifyPushResponse(200, {id:'ok', errors:{invalid_player_ids:['private']}}), {id:'ok',warning:'provider-partial-recipient-warning'});
  assert.doesNotMatch(JSON.stringify(classifyPushResponse(400,{errors:['private-secret']})),/private-secret/);
});
test('remote device verification requires exact subscription, enabled push token and persisted tag', () => {
  const raw = {properties:{tags:{market_news:'on'}},subscriptions:[{id:subId,app_id:appId,type:'ChromePush',enabled:true,notification_types:1,token:'private-push-token'}]};
  assert.deepEqual(summarizeDevice(raw,appId,subId),{registered:true,subscribed:true,tagged:true,ready:true});
  assert.equal(summarizeDevice(raw,appId,'unknown').ready,false);
  raw.properties.tags.market_news='off';assert.equal(summarizeDevice(raw,appId,subId).ready,false);
  raw.properties.tags.market_news='on';raw.subscriptions[0].enabled=false;assert.equal(summarizeDevice(raw,appId,subId).ready,false);
  raw.subscriptions[0].enabled=true;raw.subscriptions[0].type='Email';assert.equal(summarizeDevice(raw,appId,subId).ready,false);
  assert.doesNotMatch(JSON.stringify(summarizeDevice(raw,appId,subId)),/private-push-token/);
});
test('read-only app diagnostics identify wrong origin and zero subscribers without returning raw app settings', async () => {
  const result=await appDiagnostics(appId,'test-key','https://example.com',async()=>new Response(JSON.stringify({id:appId,players:0,messageable_players:0,chrome_web_origin:'https://wrong.example',chrome_web_key:'secret'})));
  assert.deepEqual(result,{status:'ok',appMatches:true,totalSubscriptions:0,messageableSubscriptions:0,originMatches:false});
  assert.doesNotMatch(JSON.stringify(result),/secret|wrong.example/);
  const missing=await verifyDevice(appId,'test-key',appId,subId,async()=>new Response('{}',{status:404}));
  assert.equal(missing.ready,false);
  await assert.rejects(verifyDevice(appId,'test-key',appId,subId,async()=>new Response('{"error":"private"}',{status:403})),/HTTP 403/);
});
