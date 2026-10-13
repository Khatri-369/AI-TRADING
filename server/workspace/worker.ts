import { workspaceStore } from './store';
import { marketService } from '../market';
import { newsPush } from '../push';
export function startWorkspaceAlerts() {
  if (process.env.VERCEL) return () => {};
  let busy = false;
  const timer = setInterval(() => {
    if (busy) return;
    busy = true;
    void (async () => {
      const store = workspaceStore();
      if (!store.db.prepare("SELECT 1 FROM records WHERE kind='alert' LIMIT 1").get()) return;
      const events = store.evaluate((await marketService.overview()).quotes);
      for (const event of events) {
        const delivery = await newsPush.notifyOwner(String(event.user), event.body).catch(() => 'push-failed');
        const row = store.db.prepare('SELECT data FROM alert_events WHERE id=?').get(event.id);
        if (row) store.db.prepare('UPDATE alert_events SET data=? WHERE id=?').run(JSON.stringify({ ...JSON.parse(String(row.data)), delivery }), event.id);
      }
    })().catch(() => { /* No private storage or provider errors in logs. */ }).finally(() => { busy = false; });
  }, 60000);
  timer.unref();
  return () => clearInterval(timer);
}
