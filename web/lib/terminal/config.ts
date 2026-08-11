/* Every fetch in web/lib/terminal now goes through the Node backend
   (src/ at repo root) instead of hitting Binance/Frankfurter/CFTC/etc.
   directly from the browser — apiClient.ts is the client for it. Direct
   provider URLs are gone; the backend owns those now (avoids per-browser
   CORS/rate-limit problems, per src/lib/scheduler.js's own doc comment).

   apiBase is configurable via NEXT_PUBLIC_API_URL so this works against
   a non-default backend host/port without a code change (docker, a
   staging deploy, etc.) — falls back to the backend's own default port
   (src/config.js: PORT=8080) when unset. */

export const CONFIG = {
  apiBase: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080',
  refreshMs: 20000,
  // fx/cot only refresh daily/weekly server-side (src/lib/scheduler.js's
  // refreshDaily never broadcasts over WS) — poll them far less often than
  // the WS-pushed prices/news channels.
  slowRefreshMs: 5 * 60_000,
};
