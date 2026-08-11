import { log } from './logger.js';

/**
 * fetch with a timeout and one retry on network/5xx failure.
 * Every provider goes through this so failure handling is consistent:
 * a dead upstream returns null rather than throwing into a route.
 */
export async function get(url, { timeout = 8000, retries = 1, headers = {} } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    try {
      const res = await fetch(url, { signal: ctrl.signal, headers });
      clearTimeout(timer);
      if (res.status >= 500 && attempt < retries) continue;
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return await res.json();
    } catch (err) {
      clearTimeout(timer);
      if (attempt === retries) {
        log.warn(`fetch failed ${new URL(url).host}: ${err.message}`);
        return null;
      }
    }
  }
  return null;
}
