/**
 * Cache Unit Tests
 */

import { Cache } from '../../src/cache';

describe('Cache', () => {
  let cache: Cache;

  beforeEach(() => {
    cache = new Cache({ defaultTTL: 1, checkPeriod: 100 });
  });

  afterEach(() => {
    cache.destroy();
  });

  describe('get and set', () => {
    it('should store and retrieve values', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    it('should return null for non-existent keys', () => {
      expect(cache.get('nonexistent')).toBeNull();
    });

    it('should handle different data types', () => {
      cache.set('string', 'hello');
      cache.set('number', 42);
      cache.set('object', { foo: 'bar' });
      cache.set('array', [1, 2, 3]);

      expect(cache.get('string')).toBe('hello');
      expect(cache.get('number')).toBe(42);
      expect(cache.get('object')).toEqual({ foo: 'bar' });
      expect(cache.get('array')).toEqual([1, 2, 3]);
    });
  });

  describe('TTL expiration', () => {
    it('should expire entries after TTL', async () => {
      cache.set('temp', 'value', 1); // 1 second TTL
      expect(cache.get('temp')).toBe('value');

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 1100));
      expect(cache.get('temp')).toBeNull();
    });

    it('should use default TTL when not specified', async () => {
      cache.set('key', 'value'); // Uses default TTL of 1 second
      expect(cache.get('key')).toBe('value');

      await new Promise((resolve) => setTimeout(resolve, 1100));
      expect(cache.get('key')).toBeNull();
    });
  });

  describe('invalidation', () => {
    it('should invalidate single keys', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      cache.invalidate('key1');
      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toBe('value2');
    });

    it('should invalidate all keys', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      cache.invalidateAll();
      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toBeNull();
      expect(cache.get('key3')).toBeNull();
      expect(cache.size()).toBe(0);
    });

    it('should invalidate keys matching pattern', () => {
      cache.set('user:1', 'alice');
      cache.set('user:2', 'bob');
      cache.set('post:1', 'hello');

      cache.invalidatePattern(/^user:/);
      expect(cache.get('user:1')).toBeNull();
      expect(cache.get('user:2')).toBeNull();
      expect(cache.get('post:1')).toBe('hello');
    });
  });

  describe('getOrFetch', () => {
    it('should fetch and cache on miss', async () => {
      let fetchCount = 0;
      const fetchFn = async () => {
        fetchCount++;
        return 'fetched-value';
      };

      const value1 = await cache.getOrFetch('key', fetchFn);
      expect(value1).toBe('fetched-value');
      expect(fetchCount).toBe(1);

      // Second call should use cache
      const value2 = await cache.getOrFetch('key', fetchFn);
      expect(value2).toBe('fetched-value');
      expect(fetchCount).toBe(1); // Not incremented
    });

    it('should handle fetch errors', async () => {
      const fetchFn = async () => {
        throw new Error('Fetch failed');
      };

      await expect(cache.getOrFetch('key', fetchFn)).rejects.toThrow('Fetch failed');
    });
  });

  describe('statistics', () => {
    it('should track hits and misses', () => {
      cache.set('key', 'value');

      cache.get('key'); // Hit
      cache.get('nonexistent'); // Miss
      cache.get('key'); // Hit

      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
    });

    it('should track cache size', () => {
      expect(cache.size()).toBe(0);

      cache.set('key1', 'value1');
      expect(cache.size()).toBe(1);

      cache.set('key2', 'value2');
      expect(cache.size()).toBe(2);

      cache.invalidate('key1');
      expect(cache.size()).toBe(1);
    });
  });

  describe('has and isValid', () => {
    it('should check if key exists', () => {
      cache.set('key', 'value');
      expect(cache.has('key')).toBe(true);
      expect(cache.has('nonexistent')).toBe(false);
    });

    it('should return false for expired keys', async () => {
      cache.set('key', 'value', 1);
      expect(cache.has('key')).toBe(true);

      await new Promise((resolve) => setTimeout(resolve, 1100));
      expect(cache.has('key')).toBe(false);
    });
  });

  describe('touch', () => {
    it('should extend TTL', async () => {
      cache.set('key', 'value', 1);
      
      // Wait 0.5 seconds
      await new Promise((resolve) => setTimeout(resolve, 500));
      
      // Extend TTL by 2 more seconds
      cache.touch('key', 2);
      
      // Wait another 1 second (would have expired without touch)
      await new Promise((resolve) => setTimeout(resolve, 1000));
      
      // Should still be valid
      expect(cache.get('key')).toBe('value');
    });
  });
});
