const internalCache: Record<string, Map<string, unknown>> = {};

class MyCache<T = unknown> {
  private readonly cache: Map<string, T>;

  constructor(cacheName: string) {
    const cacheKey = `__cache__${cacheName}__`;
    if (!internalCache[cacheKey]) {
      internalCache[cacheKey] = new Map();
    }
    this.cache = internalCache[cacheKey] as Map<string, T>;
  }

  /** Set a value in the cache */
  set(key: string, value: T): void {
    this.cache.set(key, value);
  }

  /** Get a value from the cache */
  get(key: string): T | undefined {
    return this.cache.get(key);
  }

  /** Check if a key exists in the cache */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  entries(): [string, T][] {
    return Array.from(this.cache.entries());
  }
}

export default MyCache;
