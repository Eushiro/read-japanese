/**
 * A wrapper around Convex useQuery that caches the last successful result per cache key.
 * Shows cached data immediately while new data loads, preventing loading spinners on remount.
 *
 * This solves the issue where Convex `useQuery` returns `undefined` when a component remounts
 * while the subscription reconnects, triggering loading states even though data was just loaded.
 */

// Module-level cache persists across component lifecycles
const queryCache = new Map<string, unknown>();

export function useCachedQuery<T>(
  query: T | undefined,
  cacheKey: string
): { data: T | undefined; isLoading: boolean; isStale: boolean } {
  // Update cache when we get fresh data
  if (query !== undefined) {
    queryCache.set(cacheKey, query);
  }

  const cachedData = queryCache.get(cacheKey) as T | undefined;

  return {
    data: query ?? cachedData,
    isLoading: query === undefined && cachedData === undefined,
    isStale: query === undefined && cachedData !== undefined,
  };
}

/**
 * Clear a specific cache entry (useful for invalidation)
 */
export function clearCachedQuery(cacheKey: string): void {
  queryCache.delete(cacheKey);
}

/**
 * Clear all cached queries
 */
export function clearAllCachedQueries(): void {
  queryCache.clear();
}
