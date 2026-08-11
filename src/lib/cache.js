/**
 * TTL cache. Deliberately in-memory so the service runs with zero
 * infrastructure — swap the Map for a Redis client when you scale past
 * one process. The interface is small on purpose to make that easy.
 */
class Cache {
  #store = new Map();

  set(key, value, ttlMs) {
    this.#store.set(key, { value, expires: Date.now() + ttlMs, at: Date.now() });
    return value;
  }

  /** Returns the value, or null when missing/expired. */
  get(key) {
    const hit = this.#store.get(key);
    if (!hit) return null;
    if (Date.now() > hit.expires) { this.#store.delete(key); return null; }
    return hit.value;
  }

  /** Returns the value even if stale — used to serve during upstream outages. */
  getStale(key) { return this.#store.get(key)?.value ?? null; }

  meta(key) {
    const hit = this.#store.get(key);
    if (!hit) return null;
    return { ageMs: Date.now() - hit.at, stale: Date.now() > hit.expires };
  }

  keys() { return [...this.#store.keys()]; }
  clear() { this.#store.clear(); }
}

export const cache = new Cache();
