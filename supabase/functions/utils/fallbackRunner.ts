export interface Provider<T> {
  name: string;
  fetcher: () => Promise<T | null>;
}

// Chain of Responsibility runner for keyless metadata APIs. Providers run in
// array order; the first non-null result wins. A provider throwing (network
// error, bad JSON, abort) is logged and skipped — never fatal — so callers
// get one code path instead of nested try/catch ladders.
export async function runFallbackChain<T>(
  targetName: string,
  providers: Array<Provider<T>>,
): Promise<{ data: T; source: string } | null> {
  for (const provider of providers) {
    try {
      const result = await provider.fetcher();
      if (result) {
        return { data: result, source: provider.name };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[${targetName}] ${provider.name} failed:`, message);
    }
  }
  return null;
}

// Hard ceiling per provider so a hanging public API can't pin the edge
// function until its own wall-clock limit. The abort error surfaces through
// runFallbackChain's catch and the chain moves on.
export function withTimeout<T>(
  task: (signal: AbortSignal) => Promise<T>,
  ms: number,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return task(controller.signal).finally(() => clearTimeout(timer));
}
