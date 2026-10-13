import { NewsPushService } from './service';
export const newsPush = new NewsPushService({
  path: process.env.PUSH_STORE_PATH,
  publicKey: process.env.VAPID_PUBLIC_KEY,
  privateKey: process.env.VAPID_PRIVATE_KEY,
  subject: process.env.VAPID_SUBJECT,
});
