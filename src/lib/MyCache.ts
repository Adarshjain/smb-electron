declare global {
  type Window = Record<string, any>;
}

/**
 * A simple cache that stores values in the window object
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    if (typeof window !== 'undefined' && !window[this.cacheKey]) {
      window[this.cacheKey] = {};
    }
  }

  /**
   * Get the cache object from window
   */
  private getCacheObject(): Record<string, T> {
    if (typeof window === 'undefined') {
      return {};
    }
    return window[this.cacheKey] || {};
  }

  /**
   * Set a value in the cache
   */
  set(key: string, value: T): void {
    if (typeof window !== 'undefined') {
      const cache = this.getCacheObject();
      cache[key] = value;
      window[this.cacheKey] = cache;
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
    const value = this.get(key);
    return value !== undefined ? value : defaultValue;
  }

  /**
   * Check if a key exists in the cache
   */
  has(key: string): boolean {
    const cache = this.getCacheObject();
    return key in cache;
  }

  /**
   * Delete a specific key from the cache
   */
  delete(key: string): boolean {
    if (typeof window === 'undefined') {
      return false;
    }
    const cache = this.getCacheObject();
    const existed = key in cache;
    delete cache[key];
    window[this.cacheKey] = cache;
    return existed;
  }

  /**
   * Clear all values from the cache
   */
  clear(): void {
    if (typeof window !== 'undefined') {
      window[this.cacheKey] = {};
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
