# Fiper Backend

Aggregates, caches and interprets market data for the Fiper terminal.

## Why this exists

The dashboard originally called Binance, Frankfurter and the CFTC straight from the browser. That works for one user and breaks for a hundred:

- **Rate limits.** Those APIs are unauthenticated and throttle per IP. Every browser hitting them independently means you hit the ceiling at a few dozen concurrent users.
- **CORS.** Most useful providers (news, calendar, index prices) refuse browser requests entirely. They only work server-side.
- **Keys.** Anything paid needs a secret that cannot ship in frontend JavaScript.
- **Cost.** One AI interpretation per headline, shared across all users, instead of one per user per page load.

This service fetches once on a schedule, caches, and serves everyone from memory.

## Quick start

```bash
cp .env.example .env
npm install
npm start
```

Three providers work immediately with **no keys at all**: Binance (crypto), Frankfurter (FX), CFTC (positioning). Everything else reports itself as disabled until you add a key — it never invents numbers to fill a gap.

Check what is running:

```bash
curl localhost:8080/api/status | jq
```

## Endpoints

| Route | Returns |
|---|---|
| `GET /health` | Liveness probe |
| `GET /api/status` | Provider health, cache ages, WS client count |
| `GET /api/markets` | All instruments, quotes + crypto combined |
| `GET /api/crypto` | Binance spot prices |
| `GET /api/quotes` | Indices, commodities, DXY |
| `GET /api/fx` | ECB reference rates |
| `GET /api/cot` | CFTC positioning, 26 weeks |
| `GET /api/risk` | Risk gauge + macro themes |
| `GET /api/bias` | Bias for every tracked instrument |
| `GET /api/bias/:symbol` | Bias for one instrument |
| `GET /api/news` | Headlines with AI impact tags. `?category=` `?impact=` `?limit=` |
| `GET /api/calendar` | Economic events |
| `GET /api/klines/:symbol` | OHLC candles. `?interval=1h&limit=100` |

Every response carries `ok`, `stale` and `ageMs` so the UI can show when data is going cold.

## WebSocket

```js
const ws = new WebSocket('ws://localhost:8080/ws');
ws.onmessage = e => {
  const { type, data } = JSON.parse(e.data);
  // type: 'prices' | 'news' | 'derived'
};
ws.send(JSON.stringify({ type: 'subscribe', channels: ['prices', 'derived'] }));
```

## Layout

```
src/
  config.js            env config + provider registry
  index.js             server bootstrap
  lib/
    cache.js           TTL cache — swap the Map for Redis to scale out
    http.js            fetch with timeout + retry
    scheduler.js       the refresh loop
    logger.js
  providers/           one file per upstream, each returns null on failure
    binance.js         crypto prices + OHLC          (keyless)
    frankfurter.js     ECB FX rates                  (keyless)
    cftc.js            COT positioning               (keyless)
    quotes.js          indices/commodities           (TWELVEDATA_KEY)
    news.js            headlines                     (MARKETAUX_KEY | FINNHUB_KEY)
    calendar.js        economic events               (FMP_KEY | TRADING_ECONOMICS_KEY)
  services/
    risk.js            cross-asset risk gauge
    bias.js            per-asset directional bias
    interpret.js       headline → asset impact via Claude
  routes/index.js      REST surface
  ws/hub.js            WebSocket broadcast
```

## Design decisions worth knowing

**Providers fail soft.** Every upstream call returns `null` rather than throwing. A dead provider degrades one widget instead of taking down the API.

**Stale beats empty.** Routes serve expired cache during an outage and flag it with `stale: true`. A price from four minutes ago is more useful than a 503.

**The bias engine is rule-based on purpose.** Every input into the score is returned in `inputs` so the UI can explain the call. Replace it with a model if you like — keep the explainability, because users size positions on this.

**AI output is validated, not trusted.** `interpret.js` drops any instrument the model invented and clamps confidence to 0–1. Results are cached by headline hash so the same wire story cannot produce two different calls.

## Before you go live

**Data licensing is the real constraint.** API access is not the same as redistribution rights. Reselling a wire's headlines to paying subscribers generally needs a distribution licence. Check the terms of whichever provider you settle on — this shapes what the product can be, so resolve it before building further.

**Accuracy matters more here than in most software.** Reviews of comparable products flag news latency and thin bias signals as the main complaints. People size positions on this output. Keep the honest labelling: if a number is modelled, say so in the UI.

## Next

- Persist COT and calendar history to Postgres — the backtesting screen needs real historical event reactions, which is the one thing no API gives you cheaply
- Redis for cache so you can run more than one process
- Auth middleware + Stripe subscription gate in front of `/api`
