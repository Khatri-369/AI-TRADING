import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomBytes, createHash, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { recordSchemas, type RecordKind, type ResearchRecord, type PriceAlert } from '../../shared/research';
import { ASSET_BY_SYMBOL } from '../../shared/assets';
import type { Quote } from '../../shared/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let DatabaseSyncConstructor: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const nodeSqlite = typeof require !== 'undefined' ? require('node:sqlite') : null;
  DatabaseSyncConstructor = nodeSqlite?.DatabaseSync ?? null;
} catch {
  // node:sqlite is an experimental feature not enabled in all runtime environments (e.g. serverless)
}

const scrypt = promisify(scryptCallback);
export const digest = (value: string) => createHash('sha256').update(value).digest('hex');
export class WorkspaceError extends Error { constructor(public status: number, message: string) { super(message); } }
type User = { id: number; username: string };
type Paper = { id: string; symbol: string; currency: string; quantity: number; entry: number; exit: number | null; fees: number; feeBps: number; slippageBps: number; openedAt: string; closedAt: string | null; version: number };
export function usableQuote(quote: Quote, now = Date.now()) {
  const age = now - Date.parse(quote.asOf ?? '');
  return quote.price !== null && quote.price > 0 && quote.status === 'live' && quote.session.state === 'OPEN' && age >= -5000 && age <= 120000;
}
export function inQuietHours(alert: PriceAlert, time: number) {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: alert.timezone, hour: '2-digit', hourCycle: 'h23' }).format(new Date(time)));
  return alert.quietStart !== alert.quietEnd && (alert.quietStart < alert.quietEnd ? hour >= alert.quietStart && hour < alert.quietEnd : hour >= alert.quietStart || hour < alert.quietEnd);
}
export class WorkspaceStore {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly db: any;
  constructor(path: string) {
    if (!DatabaseSyncConstructor) {
      throw new WorkspaceError(503, 'SQLite database is not supported in this runtime environment.');
    }
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSyncConstructor(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS migrations(version INTEGER PRIMARY KEY);
      CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, user INTEGER REFERENCES users(id) ON DELETE CASCADE, expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS records(id TEXT NOT NULL, user INTEGER REFERENCES users(id) ON DELETE CASCADE, kind TEXT NOT NULL, version INTEGER NOT NULL, data TEXT NOT NULL, updated TEXT NOT NULL, PRIMARY KEY(user,id));
      CREATE TABLE IF NOT EXISTS paper(id TEXT NOT NULL, user INTEGER REFERENCES users(id) ON DELETE CASCADE, data TEXT NOT NULL, PRIMARY KEY(user,id));
      CREATE TABLE IF NOT EXISTS alert_state(user INTEGER, id TEXT, price REAL, time TEXT, PRIMARY KEY(user,id), FOREIGN KEY(user,id) REFERENCES records(user,id) ON DELETE CASCADE);
      CREATE TABLE IF NOT EXISTS alert_events(id INTEGER PRIMARY KEY, user INTEGER REFERENCES users(id) ON DELETE CASCADE, rule TEXT, data TEXT, created TEXT);
      INSERT OR IGNORE INTO migrations VALUES(1);`);
  }
  async password(value: string, salt = randomBytes(16).toString('hex')) { const key = await scrypt(value, salt, 64) as Buffer; return `${salt}:${key.toString('hex')}`; }
  async register(username: string, password: string): Promise<User> {
    const encoded = await this.password(password);
    try { const result = this.db.prepare('INSERT INTO users(username,password) VALUES(?,?)').run(username, encoded); return { id: Number(result.lastInsertRowid), username }; }
    catch { throw new WorkspaceError(409, 'Username is unavailable.'); }
  }
  async login(username: string, password: string): Promise<User> {
    const user = this.db.prepare('SELECT * FROM users WHERE username=?').get(username) as { id: number; username: string; password: string } | undefined;
    const expected = user?.password ?? `${'0'.repeat(32)}:${'0'.repeat(128)}`;
    const supplied = await this.password(password, expected.split(':')[0]);
    if (!user || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) throw new WorkspaceError(401, 'Incorrect username or password.');
    return { id: user.id, username: user.username };
  }
  session(user: number) {
    const token = randomBytes(32).toString('hex');
    this.db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now());
    this.db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(digest(token), user, Date.now() + 7 * 86400000);
    return token;
  }
  user(token: string): User | undefined { return this.db.prepare('SELECT users.id,users.username FROM sessions JOIN users ON users.id=sessions.user WHERE token=? AND expires>?').get(digest(token), Date.now()) as User | undefined; }
  logout(token: string) { this.db.prepare('DELETE FROM sessions WHERE token=?').run(digest(token)); }
  records(user: number): ResearchRecord[] { return (this.db.prepare('SELECT id,kind,version,data,updated AS updatedAt FROM records WHERE user=? ORDER BY updated DESC').all(user) as unknown as (Omit<ResearchRecord, 'data'> & { data: string })[]).map(r => ({ ...r, data: JSON.parse(r.data) })); }
  save(user: number, id: string, kind: RecordKind, version: number, data: unknown) {
    const parsed = recordSchemas[kind].safeParse(data);
    if (!parsed.success) throw new WorkspaceError(400, parsed.error.issues[0].message);
    const value = parsed.data;
    const symbols = 'symbol' in value ? [value.symbol] : 'symbols' in value ? value.symbols : [];
    if (symbols.some(s => !ASSET_BY_SYMBOL.has(s))) throw new WorkspaceError(400, 'Unknown instrument.');
    const existing = this.db.prepare('SELECT version,kind FROM records WHERE user=? AND id=?').get(user, id);
    if (existing && (existing.version !== version || existing.kind !== kind) || !existing && version !== 0) throw new WorkspaceError(409, 'A newer version exists. Reload before saving; your edits have not overwritten it.');
    if (!existing && Number(this.db.prepare('SELECT count(*) AS n FROM records WHERE user=?').get(user)?.n) >= 1000) throw new WorkspaceError(409, 'Workspace record limit reached.');
    const updated = new Date().toISOString();
    this.db.prepare('INSERT INTO records VALUES(?,?,?,?,?,?) ON CONFLICT(user,id) DO UPDATE SET version=excluded.version,data=excluded.data,updated=excluded.updated').run(id, user, kind, version + 1, JSON.stringify(value), updated);
    if (kind === 'alert') this.db.prepare('DELETE FROM alert_state WHERE user=? AND id=?').run(user, id);
    return { id, kind, version: version + 1, data: value, updatedAt: updated };
  }
  remove(user: number, id: string, version: number) { const result = this.db.prepare('DELETE FROM records WHERE user=? AND id=? AND version=?').run(user, id, version); if (!result.changes) throw new WorkspaceError(409, 'Record changed or no longer exists. Reload before deleting.'); }
  paper(user: number): Paper[] { return this.db.prepare('SELECT data FROM paper WHERE user=?').all(user).map(row => JSON.parse(String(row.data))); }
  openPaper(user: number, id: string, quote: Quote, quantity: number, feeBps: number, slippageBps: number) {
    const prior = this.paper(user).find(p => p.id === id); if (prior) return prior;
    if (!usableQuote(quote) || !['india', 'us'].includes(quote.category) || ['NIFTY50', 'BANKNIFTY', 'SENSEX'].includes(quote.symbol)) throw new WorkspaceError(409, 'Practice fills need a fresh, open-session equity/ETF quote. No fill was created.');
    const positions = this.paper(user).filter(p => p.currency === quote.currency);
    const balance = 100000 + positions.filter(p => p.exit !== null).reduce((sum, p) => sum + (p.exit! - p.entry) * p.quantity - p.fees, 0) - positions.filter(p => p.exit === null).reduce((sum, p) => sum + p.entry * p.quantity + p.fees, 0);
    const entry = quote.price! * (1 + slippageBps / 10000); const fees = entry * quantity * feeBps / 10000;
    if (entry * quantity + fees > balance) throw new WorkspaceError(409, 'Insufficient simulated cash in this currency account.');
    if (this.paper(user).length >= 1000) throw new WorkspaceError(409, 'Practice ledger limit reached.');
    const value: Paper = { id, symbol: quote.symbol, currency: quote.currency, quantity, entry, exit: null, fees, feeBps, slippageBps, openedAt: quote.asOf!, closedAt: null, version: 1 };
    this.db.prepare('INSERT INTO paper VALUES(?,?,?)').run(id, user, JSON.stringify(value)); return value;
  }
  closePaper(user: number, id: string, quote: Quote) {
    const p = this.paper(user).find(p => p.id === id); if (!p) throw new WorkspaceError(404, 'Practice position not found.');
    if (p.exit !== null) return p;
    if (quote.symbol !== p.symbol || !usableQuote(quote) || Date.parse(quote.asOf!) < Date.parse(p.openedAt)) throw new WorkspaceError(409, 'A fresh, open-session quote is required to close this simulated position.');
    p.exit = quote.price! * (1 - p.slippageBps / 10000); p.closedAt = quote.asOf; p.fees += p.exit * p.quantity * p.feeBps / 10000; p.version++;
    this.db.prepare('UPDATE paper SET data=? WHERE user=? AND id=?').run(JSON.stringify(p), user, id); return p;
  }
  evaluate(quotes: Quote[], now = Date.now()) {
    const events: { user: number; title: string; body: string; id: number }[] = [];
    const rules = this.db.prepare("SELECT * FROM records WHERE kind='alert'").all();
    for (const row of rules) {
      const alert = recordSchemas.alert.parse(JSON.parse(String(row.data)));
      if (alert.paused || Date.parse(alert.expiresAt) <= now) continue;
      const quote = quotes.find(q => q.symbol === alert.symbol); if (!quote || !usableQuote(quote, now)) continue;
      const old = this.db.prepare('SELECT price,time FROM alert_state WHERE user=? AND id=?').get(row.user, row.id);
      if (old && String(old.time) >= quote.asOf!) continue;
      this.db.prepare('INSERT INTO alert_state VALUES(?,?,?,?) ON CONFLICT(user,id) DO UPDATE SET price=excluded.price,time=excluded.time').run(row.user, row.id, quote.price, quote.asOf);
      if (!old) continue;
      const crossed = alert.direction === 'above' ? Number(old.price) <= alert.level && quote.price! > alert.level : Number(old.price) >= alert.level && quote.price! < alert.level;
      if (!crossed) continue;
      const quiet = inQuietHours(alert, now);
      const event = { symbol: quote.symbol, price: quote.price, level: alert.level, provider: quote.provider, asOf: quote.asOf, status: quiet ? 'quiet-hours' : 'detected', delivery: 'not-attempted' };
      const inserted = this.db.prepare('INSERT INTO alert_events(user,rule,data,created) VALUES(?,?,?,?)').run(row.user, row.id, JSON.stringify(event), new Date(now).toISOString());
      if (!quiet) events.push({ user: Number(row.user), id: Number(inserted.lastInsertRowid), title: 'Price alert', body: `${quote.symbol} crossed ${alert.direction} ${alert.level} ${quote.currency}. Observed ${quote.asOf}.` });
    }
    this.db.exec('DELETE FROM alert_events WHERE id NOT IN (SELECT id FROM alert_events ORDER BY id DESC LIMIT 10000)');
    return events;
  }
  events(user: number) { return this.db.prepare('SELECT id,data,created FROM alert_events WHERE user=? ORDER BY id DESC LIMIT 100').all(user).map(row => ({ id: row.id, ...JSON.parse(String(row.data)), created: row.created })); }
  deleteUser(user: number) { this.db.prepare('DELETE FROM users WHERE id=?').run(user); }
  close() { this.db.close(); }
}

let singleton: WorkspaceStore | undefined;
export function workspaceStore() {
  const path = process.env.WORKSPACE_DB_PATH || (!process.env.VERCEL && process.env.NODE_ENV !== 'production' ? '.workspace-data/research.sqlite' : '');
  if (!path || process.env.VERCEL) throw new WorkspaceError(503, 'Account sync requires WORKSPACE_DB_PATH on the persistent backend. Guest research remains available.');
  return singleton ??= new WorkspaceStore(path);
}
