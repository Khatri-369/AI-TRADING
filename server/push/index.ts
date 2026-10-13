import { NewsPushService } from './service';
import { workspaceStore, inQuietHours } from '../workspace/store';

export const newsPush = new NewsPushService({
  path: process.env.VERCEL ? undefined : process.env.PUSH_STORE_PATH,
  publicKey: process.env.VAPID_PUBLIC_KEY,
  privateKey: process.env.VAPID_PRIVATE_KEY,
  subject: process.env.VAPID_SUBJECT,
  preferences: owner => {
    const preferences = workspaceStore().newsPreferences(Number(owner));
    return { ...preferences, muted: preferences.paused || inQuietHours(preferences, Date.now()) };
  },
});
