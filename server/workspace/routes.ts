import { Router, type Request, type Response, type NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { workspaceStore, WorkspaceError } from './store';
import { marketService } from '../market';
import { newsPush } from '../push';
const credentials = z.object({ username: z.string().trim().toLowerCase().regex(/^[a-z0-9_-]{3,40}$/), password: z.string().min(12).max(128) }).strict();
export const workspaceToken = (req: Request) => req.headers.cookie?.match(/(?:^|;\s*)research_session=([a-f0-9]{64})(?:;|$)/)?.[1] ?? '';
export const workspaceUser = (req: Request) => { try { return workspaceStore().user(workspaceToken(req)); } catch { return undefined; } };
const route = (fn: (req: Request, res: Response) => Promise<unknown> | unknown) => (req: Request, res: Response, next: NextFunction) => { Promise.resolve().then(() => fn(req, res)).catch(error => {
  if (error instanceof WorkspaceError) { res.status(error.status).json({ error: error.message }); return; }
  if (error instanceof z.ZodError) { res.status(400).json({ error: error.issues[0].message }); return; }
  next(error);
}); };
export function workspaceRouter(production: boolean) {
  const router = Router();
  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (req.method !== 'GET' && req.get('X-Requested-With') !== 'XMLHttpRequest') { res.status(403).json({ error: 'Security header required.' }); return; }
    next();
  });
  router.get('/session', route((req, res) => { const store = workspaceStore(); res.json({ user: store.user(workspaceToken(req)) ?? null }); }));
  const authLimit = rateLimit({ windowMs: 15 * 60000, limit: 15, message: { error: 'Too many sign-in attempts. Try later.' } });
  for (const action of ['register', 'login'] as const) router.post(`/${action}`, authLimit, route(async (req, res) => {
    const input = credentials.parse(req.body); const store = workspaceStore();
    const user = await store[action](input.username, input.password);
    const old = workspaceToken(req); if (old) store.logout(old);
    res.cookie('research_session', store.session(user.id), { httpOnly: true, secure: production, sameSite: 'lax', path: '/', maxAge: 7 * 86400000 }); res.json({ user });
  }));
  router.use((req, res, next) => { if (!workspaceUser(req)) { res.status(401).json({ error: 'Sign in to access your synced workspace.' }); return; } next(); });
  const userId = (req: Request) => workspaceUser(req)!.id;
  router.post('/change-password', authLimit, route(async (req, res) => {
    const input = z.object({ current: z.string().min(1).max(128), next: z.string().min(12).max(128) }).strict().parse(req.body);
    const user = workspaceUser(req)!;
    const store = workspaceStore();
    await store.changePassword(user, input.current, input.next);
    res.cookie('research_session', store.session(user.id), { httpOnly: true, secure: production, sameSite: 'lax', path: '/', maxAge: 7 * 86400000 });
    res.json({ ok: true });
  }));
  router.post('/logout', route(async (req, res) => { await newsPush.removeOwner(String(userId(req))).catch(() => undefined); workspaceStore().logout(workspaceToken(req)); res.clearCookie('research_session', { path: '/' }); res.json({ ok: true }); }));
  router.get('/records', route((req, res) => res.json({ records: workspaceStore().records(userId(req)), paper: workspaceStore().paper(userId(req)), events: workspaceStore().events(userId(req)) })));
  router.post('/records/:id', route((req, res) => {
    const id = z.string().regex(/^[\w.-]{1,100}$/).parse(req.params.id);
    const input = z.object({ kind: z.enum(['chart', 'plan', 'journal', 'alert', 'watchlist', 'preferences']), version: z.number().int().nonnegative(), data: z.unknown() }).strict().parse(req.body);
    res.json(workspaceStore().save(userId(req), id, input.kind, input.version, input.data));
  }));
  router.post('/records/:id/delete', route((req, res) => { workspaceStore().remove(userId(req), String(req.params.id), z.number().int().positive().parse(req.body.version)); res.json({ ok: true }); }));
  router.post('/paper', route(async (req, res) => {
    const input = z.object({ id: z.string().uuid(), symbol: z.string().max(30), quantity: z.number().int().positive().max(1000000), feeBps: z.number().min(0).max(100), slippageBps: z.number().min(0).max(100) }).strict().parse(req.body);
    const quote = (await marketService.overview()).quotes.find(q => q.symbol === input.symbol);
    if (!quote) throw new WorkspaceError(400, 'Unknown instrument.');
    res.json(workspaceStore().openPaper(userId(req), input.id, quote, input.quantity, input.feeBps, input.slippageBps));
  }));
  router.post('/paper/:id/close', route(async (req, res) => {
    const position = workspaceStore().paper(userId(req)).find(p => p.id === req.params.id); if (!position) throw new WorkspaceError(404, 'Practice position not found.');
    const quote = (await marketService.overview()).quotes.find(q => q.symbol === position.symbol); if (!quote) throw new WorkspaceError(409, 'Quote unavailable.');
    res.json(workspaceStore().closePaper(userId(req), position.id, quote));
  }));
  router.get('/export', route((req, res) => res.json({ records: workspaceStore().records(userId(req)), paper: workspaceStore().paper(userId(req)), events: workspaceStore().events(userId(req)) })));
  router.post('/delete-account', authLimit, route(async (req, res) => { const user = workspaceUser(req)!; await workspaceStore().login(user.username, z.string().max(128).parse(req.body.password)); await newsPush.removeOwner(String(user.id)).catch(() => undefined); workspaceStore().deleteUser(user.id); res.clearCookie('research_session', { path: '/' }); res.json({ ok: true }); }));
  return router;
}
