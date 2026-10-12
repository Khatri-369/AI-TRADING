import { z } from 'zod';

export type Fetcher = typeof fetch;

/** Provider response bodies and request URLs must never appear in errors (may contain credentials). */
export async function fetchBytes(
  fetcher: Fetcher, url: string, headers: Record<string, string> = {}, maxBytes = 2_000_000,
): Promise<Uint8Array> {
  try {
    const response = await fetcher(url, {
      headers: { Accept: 'application/json', ...headers }, signal: AbortSignal.timeout(8_000), redirect: 'error',
    });
    if (!response.ok) {
      await response.body?.cancel();
      if (response.status === 429) throw new Error('Provider rate limit reached; retry after the cache cooldown');
      if (response.status === 401 || response.status === 403) throw new Error('Provider rejected access; check the server credential and plan entitlement');
      throw new Error(`Provider returned HTTP ${response.status}`);
    }
    const reader = response.body?.getReader();
    if (!reader) throw new Error('Provider returned an empty response');
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new Error('Provider response exceeded the size limit');
      }
      chunks.push(next.value);
    }
    const output = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.length; }
    return output;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Provider ')) throw error;
    if (error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name)) throw new Error('Provider request timed out', { cause: error });
    throw new Error('Provider network request failed', { cause: error });
  }
}

export async function fetchJson<S extends z.ZodType>(
  fetcher: Fetcher, url: string, schema: S, headers: Record<string, string> = {},
): Promise<z.output<S>> {
  const bytes = await fetchBytes(fetcher, url, headers);
  let raw: unknown;
  try { raw = JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw new Error('Provider returned invalid JSON'); }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new Error('Provider returned an invalid data shape');
  return parsed.data;
}

export const finite = z.number().finite();
export const positive = finite.positive();
export const optionalNumber = finite.nullish();
export const dateString = z.string().refine((value) => Number.isFinite(Date.parse(value)), 'Invalid date');

export function validTime(value: string | number, milliseconds = false): string {
  const time = typeof value === 'number' ? value * (milliseconds ? 1 : 1_000) : Date.parse(value);
  if (!Number.isFinite(time) || time < Date.UTC(2000, 0, 1) || time > Date.now() + 5 * 60_000) {
    throw new Error('Provider returned an invalid quote timestamp');
  }
  return new Date(time).toISOString();
}
