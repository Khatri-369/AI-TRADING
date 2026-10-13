import { NewsPushService } from './service';

const defaultPublicKey = 'BH97uGTekzclQRajEtI0gD2epjYczSxiHIDIYgckXgDDbVDM4FVcH4HVIGnhqIAblRj-fE_EAK4s-SiI8ccwpgA';
const defaultPrivateKey = 'ZLVT9krrmlv-JSYOEiY-fohbWvRkMJXn4G6_HDOomc0';
const defaultSubject = 'mailto:alerts@markets.local';
const defaultStorePath = process.env.PUSH_STORE_PATH || (process.env.VERCEL ? '/tmp/news-subscriptions.json' : './data/news-subscriptions.json');

export const newsPush = new NewsPushService({
  path: defaultStorePath,
  publicKey: process.env.VAPID_PUBLIC_KEY || defaultPublicKey,
  privateKey: process.env.VAPID_PRIVATE_KEY || defaultPrivateKey,
  subject: process.env.VAPID_SUBJECT || defaultSubject,
});
