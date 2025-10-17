/**
 * Caching Layer
 * In-memory cache with TTL for Home Assistant entities and services
 */

import { EventEmitter } from 'events';
import { getLogger } from './utils/logger';

const logger = getLogger('Cache');

/**
 * Cache entry with TTL
 */
interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  key: string;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  evictions: number;
}

/**
 * Cache configuration
 */
export interface CacheOptions {
  defaultTTL?: number; // in seconds
  maxSize?: number;
  checkPeriod?: number; // cleanup interval in ms
}

/**
 * In-memory cache with TTL
 */
export class Cache extends EventEmitter {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private defaultTTL: number;
  private maxSize: number;
  private checkPeriod: number;
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    size: 0,
    evictions: 0,
  };
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(options: CacheOptions = {}) {
    super();
    this.defaultTTL = options.defaultTTL || 300; // 5 minutes
    this.maxSize = options.maxSize || 1000;
    this.checkPeriod = options.checkPeriod || 60000; // 1 minute

    // Start cleanup timer
    this.startCleanup();

    logger.debug('Cache initialized', {
      defaultTTL: this.defaultTTL,
      maxSize: this.maxSize,
    });
  }

  /**
   * Get a value from cache
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      this.emit('cache:miss', key);
      logger.debug(`Cache miss: ${key}`);
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      this.stats.size = this.cache.size;
      this.emit('cache:expired', key);
      logger.debug(`Cache expired: ${key}`);
      return null;
    }

    this.stats.hits++;
    this.emit('cache:hit', key);
    logger.debug(`Cache hit: ${key}`);
    return entry.value as T;
  }

  /**
   * Set a value in cache
   */
  set<T>(key: string, value: T, ttl?: number): void {
    // Enforce max size
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictOldest();
    }

    const ttlSeconds = ttl !== undefined ? ttl : this.defaultTTL;
    const expiresAt = Date.now() + ttlSeconds * 1000;

    this.cache.set(key, {
      value,
      expiresAt,
      key,
    });

    this.stats.size = this.cache.size;
    this.emit('cache:set', key);
    logger.debug(`Cache set: ${key} (TTL: ${ttlSeconds}s)`);
  }

  /**
   * Check if a key exists and is valid
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.size = this.cache.size;
      return false;
    }

    return true;
  }

  /**
   * Invalidate a specific cache entry
   */
  invalidate(key: string): void {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.stats.size = this.cache.size;
      this.emit('cache:invalidate', key);
      logger.debug(`Cache invalidated: ${key}`);
    }
  }

  /**
   * Invalidate all cache entries
   */
  invalidateAll(): void {
    const size = this.cache.size;
    this.cache.clear();
    this.stats.size = 0;
    this.emit('cache:clear');
    logger.info(`Cache cleared: ${size} entries removed`);
  }

  /**
   * Invalidate entries matching a pattern
   */
  invalidatePattern(pattern: RegExp): void {
    let count = 0;
    for (const key of this.cache.keys()) {
      if (pattern.test(key)) {
        this.cache.delete(key);
        count++;
      }
    }
    this.stats.size = this.cache.size;
    this.emit('cache:pattern-invalidate', pattern, count);
    logger.debug(`Cache pattern invalidated: ${pattern} (${count} entries)`);
  }

  /**
   * Get or fetch pattern - get from cache or fetch and cache
   */
  async getOrFetch<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    // Try to get from cache
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Fetch and cache
    try {
      const value = await fetchFn();
      this.set(key, value, ttl);
      return value;
    } catch (error) {
      logger.error(`Failed to fetch for cache key: ${key}`, error);
      throw error;
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Get all cache keys
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Check if cache is valid (not expired)
   */
  isValid(key: string): boolean {
    return this.has(key);
  }

  /**
   * Get time until expiration (in seconds)
   */
  getTTL(key: string): number | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const ttl = Math.floor((entry.expiresAt - Date.now()) / 1000);
    return ttl > 0 ? ttl : null;
  }

  /**
   * Extend TTL for a key
   */
  touch(key: string, ttl?: number): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    const ttlSeconds = ttl !== undefined ? ttl : this.defaultTTL;
    entry.expiresAt = Date.now() + ttlSeconds * 1000;
    this.emit('cache:touch', key);
    logger.debug(`Cache touched: ${key} (TTL: ${ttlSeconds}s)`);
    return true;
  }

  /**
   * Evict oldest entry
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt < oldestTime) {
        oldestTime = entry.expiresAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.stats.evictions++;
      this.stats.size = this.cache.size;
      this.emit('cache:evict', oldestKey);
      logger.debug(`Cache evicted: ${oldestKey}`);
    }
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let expiredCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        expiredCount++;
      }
    }

    if (expiredCount > 0) {
      this.stats.size = this.cache.size;
      this.emit('cache:cleanup', expiredCount);
      logger.debug(`Cache cleanup: ${expiredCount} expired entries removed`);
    }
  }

  /**
   * Start periodic cleanup
   */
  private startCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.checkPeriod);

    // Don't prevent process from exiting
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  /**
   * Stop periodic cleanup
   */
  stopCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Destroy cache and cleanup
   */
  destroy(): void {
    this.stopCleanup();
    this.cache.clear();
    this.removeAllListeners();
    logger.info('Cache destroyed');
  }
}

// Global cache instance
let globalCache: Cache | null = null;

/**
 * Get or create the global cache instance
 */
export function getCache(options?: CacheOptions): Cache {
  if (!globalCache) {
    globalCache = new Cache(options);
  }
  return globalCache;
}

/**
 * Predefined cache keys for different data types
 */
export const CacheKeys = {
  ENTITIES: 'ha:entities',
  SERVICES: 'ha:services',
  CONFIG: 'ha:config',
  DASHBOARDS: 'ha:dashboards',
  DASHBOARD_CONFIG: (urlPath: string) => `ha:dashboard:${urlPath}`,
  ENTITY_REGISTRY: 'ha:entity_registry',
  AREAS: 'ha:areas',
  DEVICES: 'ha:devices',
};
