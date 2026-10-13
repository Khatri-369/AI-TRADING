import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { z } from 'zod';
import { recordSchemas, type RecordKind, type ResearchRecord } from '../../shared/research';

export async function workspaceRequest<T = unknown>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/workspace${path}`, { credentials: 'same-origin', signal: AbortSignal.timeout(30000), ...(body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' }, body: JSON.stringify(body) }) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? 'Workspace request failed.');
  return result;
}
const localKey = 'markets.research.v1';
function loadLocal(): ResearchRecord[] {
  try {
    const values = z.array(z.object({ id: z.string(), kind: z.enum(['chart', 'plan', 'journal', 'alert', 'watchlist']), version: z.number().int(), data: z.unknown(), updatedAt: z.string() })).max(1000).parse(JSON.parse(localStorage.getItem(localKey) ?? '[]'));
    return values.filter(record => recordSchemas[record.kind].safeParse(record.data).success);
  } catch { return []; }
}
type User = { id: number; username: string };
interface Store { records: ResearchRecord[]; user: User | null; status: string; save: (id: string, kind: RecordKind, data: unknown, version: number) => Promise<void>; remove: (record: ResearchRecord) => Promise<void>; refresh: () => Promise<void>; auth: (action: 'login' | 'register', username: string, password: string) => Promise<void>; logout: () => Promise<void>; importLocal: () => Promise<void> }
const Context = createContext<Store | null>(null);
export function ResearchProvider({ children }: { children: ReactNode }) {
  const [records, setRecords] = useState<ResearchRecord[]>(loadLocal);
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState('Guest · saved on this browser');
  async function refresh() {
    try {
      const session = await workspaceRequest<{ user: User | null }>('/session');
      if (!session.user) { setUser(null); setRecords(loadLocal()); setStatus('Guest · saved on this browser'); return; }
      const value = await workspaceRequest<{ records: ResearchRecord[] }>('/records');
      setUser(session.user); setRecords(value.records); setStatus('Account workspace synced');
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Sync unavailable'); }
  }
  useEffect(() => { void refresh(); const onFocus = () => { void refresh(); }; window.addEventListener('focus', onFocus); return () => window.removeEventListener('focus', onFocus); }, []);
  async function save(id: string, kind: RecordKind, data: unknown, version: number) {
    const parsed = recordSchemas[kind].safeParse(data); if (!parsed.success) throw new Error(parsed.error.issues[0].message);
    setStatus('Saving…');
    try {
      if (user) {
        const record = await workspaceRequest<ResearchRecord>(`/records/${encodeURIComponent(id)}`, { kind, version, data: parsed.data });
        setRecords(previous => [...previous.filter(r => r.id !== id), record]); setStatus('Saved to account');
      } else {
        const current = loadLocal(); const old = current.find(r => r.id === id);
        if ((old?.version ?? 0) !== version) throw new Error('This record changed in another tab. Reload before saving.');
        const next = [...current.filter(r => r.id !== id), { id, kind, data: parsed.data, version: version + 1, updatedAt: new Date().toISOString() }];
        localStorage.setItem(localKey, JSON.stringify(next)); setRecords(next); setStatus('Saved on this browser');
      }
    } catch (error) { setStatus('Not saved · your edits remain on screen'); throw error; }
  }
  async function remove(record: ResearchRecord) {
    if (user) await workspaceRequest(`/records/${record.id}/delete`, { version: record.version });
    else { const current = loadLocal(); if (current.find(r => r.id === record.id)?.version !== record.version) throw new Error('Record changed. Reload first.'); localStorage.setItem(localKey, JSON.stringify(current.filter(r => r.id !== record.id))); }
    setRecords(previous => previous.filter(r => r.id !== record.id));
  }
  async function auth(action: 'login' | 'register', username: string, password: string) { await workspaceRequest(`/${action}`, { username, password }); await refresh(); }
  async function logout() { await workspaceRequest('/logout', {}); setUser(null); setRecords(loadLocal()); setStatus('Guest · saved on this browser'); }
  async function importLocal() {
    if (!user) throw new Error('Sign in first.');
    const remote = (await workspaceRequest<{ records: ResearchRecord[] }>('/records')).records;
    for (const record of loadLocal()) {
      if (remote.some(r => r.id === record.id)) continue;
      await workspaceRequest(`/records/${record.id}`, { kind: record.kind, version: 0, data: record.data });
    }
    await refresh(); // Originals stay on the browser as a recovery copy.
  }
  return <Context.Provider value={{ records, user, status, save, remove, refresh, auth, logout, importLocal }}>{children}</Context.Provider>;
}
export function useResearchStore() { const value = useContext(Context); if (!value) throw new Error('ResearchProvider is required.'); return value; }
