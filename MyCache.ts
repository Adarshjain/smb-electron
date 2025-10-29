const internalCache: Record<string, Record<string, any>> = {};

class MyCache<T = any> {
  private readonly cacheKey: string;

  constructor(cacheName: string) {
    this.cacheKey = `__cache__${cacheName}__`;
    this.initCache();
  }

  /**
   * Initialize the cache in the window object if it doesn't exist
   */
  private initCache(): void {
    internalCache[this.cacheKey] ??= {};
  }

  /**
   * Get the cache object from internalCache
   */
  private getCacheObject(): Record<string, T> {
    if (typeof internalCache === 'undefined') {
      return {};
    }
    return internalCache[this.cacheKey] ?? {};
  }

  /**
   * Set a value in the cache
   */
  set(key: string, value: T): void {
    if (typeof internalCache !== 'undefined') {
      const cache = this.getCacheObject();
      cache[key] = value;
      internalCache[this.cacheKey] = cache;
    }
  }

  /**
   * Get a value from the cache
   */
  get(key: string): T | undefined {
    const cache = this.getCacheObject();
    return cache[key];
  }

  /**
   * Get a value with a default fallback
   */
  getOrDefault(key: string, defaultValue: T): T {
    return this.get(key) ?? defaultValue;
  }

  /**
   * Check if a key exists in the cache
   */
  has(key: string): boolean {
    return key in this.getCacheObject();
  }

  /**
   * Delete a specific key from the cache
   */
  delete(key: string): boolean {
    if (typeof internalCache === 'undefined') {
      return false;
    }
    const cache = this.getCacheObject();
    const existed = key in cache;
    delete cache[key];
    internalCache[this.cacheKey] = cache;
    return existed;
  }

  /**
   * Clear all values from the cache
   */
  clear(): void {
    if (typeof internalCache !== 'undefined') {
      internalCache[this.cacheKey] = {};
    }
  }

  /**
   * Get all keys in the cache
   */
  keys(): string[] {
    const cache = this.getCacheObject();
    return Object.keys(cache);
  }

  /**
   * Get all values in the cache
   */
  values(): T[] {
    const cache = this.getCacheObject();
    return Object.values(cache);
  }

  /**
   * Get all entries in the cache
   */
  entries(): [string, T][] {
    const cache = this.getCacheObject();
    return Object.entries(cache);
  }

  /**
   * Get the number of items in the cache
   */
  size(): number {
    return this.keys().length;
  }

  /**
   * Check if the cache is empty
   */
  isEmpty(): boolean {
    return this.size() === 0;
  }

  /**
   * Execute a callback for each entry in the cache
   */
  forEach(callback: (value: T, key: string) => void): void {
    const cache = this.getCacheObject();
    Object.entries(cache).forEach(([key, value]) => {
      callback(value, key);
    });
  }
}

export default MyCache;
