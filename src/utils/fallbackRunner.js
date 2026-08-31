
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
