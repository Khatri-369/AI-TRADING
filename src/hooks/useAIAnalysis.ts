import { useCallback, useEffect, useRef, useState } from 'react';
import { analyze, errorMessage } from '../services/api';
import type { AnalysisEntry, Engine } from '../types/market';

export const analysisKey = (id: string, engine: Engine) => `${engine}:${id}`;
export function useAIAnalysis() {
  const [entries, setEntries] = useState<Record<string, AnalysisEntry>>({});
  const requests = useRef(new Map<string, AbortController>());
  useEffect(() => () => { for (const controller of requests.current.values()) controller.abort(); requests.current.clear(); }, []);
  const run = useCallback(async (id: string, headline: string, engine: Engine, symbol?: string) => {
    const key = analysisKey(id, engine);
    if (requests.current.has(key)) return;
    const controller = new AbortController();
    requests.current.set(key, controller);
    setEntries(previous => ({ ...previous, [key]: { title: headline, loading: true } }));
    try {
      const result = await analyze({ headline, engine, ...(symbol ? { symbol } : {}) }, controller.signal);
      if (!controller.signal.aborted) setEntries(previous => ({ ...previous, [key]: { title: headline, loading: false, result } }));
    } catch (cause) {
      if (!controller.signal.aborted) setEntries(previous => ({ ...previous, [key]: { title: headline, loading: false, error: errorMessage(cause) } }));
    } finally { if (requests.current.get(key) === controller) requests.current.delete(key); }
  }, []);
  return { entries, run };
}
