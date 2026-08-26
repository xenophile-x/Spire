// Chain of Responsibility runner for keyless metadata APIs.
// Providers run in array order; the first non-null result wins. A provider
// throwing (network error, bad JSON, abort) is logged and skipped — never
// fatal — so callers get one code path instead of nested try/catch ladders.
export async function runFallbackChain(
  targetName,
  providers
) {
  for (const provider of providers) {
    try {
      const result = await provider.fetcher();
      if (result) {
        return { data: result, source: provider.name };
      }
    } catch (error) {
      console.warn(`[${targetName}] ${provider.name} failed:`, error?.message || error);
    }
  }
  return null;
}
