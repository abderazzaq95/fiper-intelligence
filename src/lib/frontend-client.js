/**
 * Drop-in client for the terminal frontend.
 *
 * Replaces the direct browser→provider calls in fiper-terminal.html.
 * Copy into the frontend, or serve it from the API and import it.
 *
 *   const api = createClient('http://localhost:8080');
 *   const markets = await api.markets();
 *   api.onUpdate('prices', rows => render(rows));
 */
export function createClient(base = 'http://localhost:8080') {
  const listeners = new Map();
  let socket = null;

  async function call(path) {
    try {
      const res = await fetch(`${base}/api${path}`);
      const body = await res.json();
      if (!body.ok) return { data: null, error: body.error, hint: body.hint };
      return { data: body.data, stale: body.stale, ageMs: body.ageMs };
    } catch (err) {
      return { data: null, error: err.message };
    }
  }

  function connect() {
    const url = base.replace(/^http/, 'ws') + '/ws';
    socket = new WebSocket(url);

    socket.onmessage = e => {
      const { type, data } = JSON.parse(e.data);
      listeners.get(type)?.forEach(fn => fn(data));
    };
    // reconnect with backoff rather than hammering a downed server
    let delay = 1000;
    socket.onclose = () => setTimeout(() => { delay = Math.min(delay * 2, 30000); connect(); }, delay);
    socket.onopen = () => { delay = 1000; };
  }

  return {
    status:   () => call('/status'),
    markets:  () => call('/markets'),
    crypto:   () => call('/crypto'),
    quotes:   () => call('/quotes'),
    fx:       () => call('/fx'),
    cot:      () => call('/cot'),
    risk:     () => call('/risk'),
    bias:     (symbol) => call(symbol ? `/bias/${symbol}` : '/bias'),
    news:     (opts = {}) => call('/news?' + new URLSearchParams(opts)),
    calendar: () => call('/calendar'),
    klines:   (symbol, interval = '1h', limit = 100) =>
                call(`/klines/${symbol}?interval=${interval}&limit=${limit}`),

    onUpdate(channel, fn) {
      if (!socket) connect();
      if (!listeners.has(channel)) listeners.set(channel, new Set());
      listeners.get(channel).add(fn);
      return () => listeners.get(channel).delete(fn);
    }
  };
}
