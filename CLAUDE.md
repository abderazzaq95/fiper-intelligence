# Fiper Intelligence

An AI-powered market intelligence terminal for retail traders. Modelled on mrktedge.ai, wearing Fiper's (fiper.me) visual identity.

## Repo layout

```
fiper/
├── CLAUDE.md          this file
├── backend/           Node API — aggregates, caches, interprets market data
└── web/
    ├── landing/       public marketing site  (index.html)
    └── app/           the terminal dashboard (index.html)
```

Both frontends are currently **single self-contained HTML files**. That was right for prototyping and is now the main thing holding the project back — see "Next up".

## Brand

Sampled from the real logo, not eyeballed. Do not substitute approximations.

| Token | Value | Use |
|---|---|---|
| Navy | `#003364` | brand base |
| App shell | `#00101F` → `#04192F` | dashboard surfaces |
| Red bright | `#E53838` | gradient top |
| Red base | `#C42626` | primary accent, CTAs |
| Red deep | `#971212` | gradient bottom |
| Bullish | `#00D084` | never repurpose |
| Bearish | `#FF5470` | distinct from brand red on purpose |

Buttons use the logo's own diagonal gradient (`#E53838 → #971212`), not a flat fill.

Type: **Playfair Display** (headlines, logo wordmark — echoes the serif "Fiper"), **Inter** (UI/body), **JetBrains Mono** (all prices and numeric data).

The logo is embedded as base64 in both HTML files. Extract it to `web/shared/logo.png` when you componentise.

## What is real vs modelled

This distinction matters more than usual — people size trading positions on this output. **Every widget in the UI carries a LIVE or MODEL badge. Preserve that.** If you make something real, update the badge. If you add something modelled, badge it.

Live today, no API key needed:
- **Binance** — crypto spot prices, 24h stats, and OHLC candles
- **Frankfurter** — ECB reference FX rates (daily, not tick)
- **CFTC** — Commitments of Traders positioning (weekly, published Fridays)

Modelled until a key is added:
- News headlines → `MARKETAUX_KEY` or `FINNHUB_KEY`
- Economic calendar → `FMP_KEY` or `TRADING_ECONOMICS_KEY`
- Index/commodity prices → `TWELVEDATA_KEY`
- Backtest history → **no API provides this cheaply.** Needs a Postgres table of releases + measured price reactions. This is the biggest real gap.

## Design decisions to preserve

**The bias engine is rule-based deliberately.** `backend/src/services/bias.js` returns its `inputs` (momentum, riskTilt, dollarTilt, positioning) as separate numbers so the UI can explain any call. If you replace it with a model, keep the explainability — an unexplainable trading signal is worse than no signal.

**AI output is validated, never trusted.** `interpret.js` drops instruments the model invented, clamps confidence to 0–1, and caches by headline hash so the same wire story cannot produce two different calls.

**Providers fail soft.** Every upstream returns `null` rather than throwing. A dead provider degrades one widget instead of taking down the API.

**Stale beats empty.** Routes serve expired cache during outages flagged `stale: true`. A four-minute-old price beats a 503.

**Statistical honesty in backtesting.** Under 8 matching instances, the UI refuses to present the result as reliable. Keep this. It is a feature, not a limitation.

## Dashboard screens (12, all built)

Market Pulse — Home, Live Headlines, Economic Calendar, Daily Bias
Markets — Global Markets, Capital Flows, COT Positioning, Price Forecasts
Research — Candle Analysis, Fundamental Backtesting, Stock Research, Crypto Macro

Candle Analysis runs real pattern detection (doji, hammer, shooting star, engulfing, piercing, dark cloud, marubozu) on real Binance OHLC — measured from body/range and wick ratios, not a lookup table.

## Next up, in order

1. **Componentise the frontends.** Next.js + Tailwind. The single-file HTML is at its limit — no reuse, no tests, no routing. Do this before adding features.
2. **Point the frontend at the backend.** `backend/src/lib/frontend-client.js` is a ready adapter. Replaces direct browser→provider fetches, adds WebSocket push in place of the 20s polling loop.
3. **Auth + billing.** Supabase or Clerk, Stripe subscriptions, gate `/app` behind an active subscription.
4. **Postgres.** Persist COT and calendar history. Unblocks real backtesting.
5. **Redis.** Swap the Map in `backend/src/lib/cache.js` — the interface is small on purpose.

## Constraints worth knowing

**Data licensing is unresolved and is the real risk.** API access is not redistribution rights. Reselling a wire's headlines to paying subscribers generally needs a distribution licence. This shapes what the product can legally be. Resolve before building further on top of the news feed.

**Latency and accuracy are the product.** Reviews of comparable tools flag news delay and thin bias signals as the main complaints. Treat both as correctness bugs, not polish.

## Signal engine (`src/signals/`) → Telegram

Research-gated trade signals for XAUUSD, USTEC, BTCUSD. **The scanner only signals what the latest `npm run research` enabled** — an instrument whose edge fails out-of-sample goes silent. Keep that gate.

- `swing.js` — daily "dip in an uptrend" (RSI(2) < 10 above the 200-day SMA, exit on close > 5-day SMA, 10-day time stop, 3-ATR stop). Rules fixed at published defaults — **do not add a parameter search**; the lack of one is why its numbers are believable. Split 70/30 in time; enabled only if both halves have positive expectancy after spread + swap.
- `research.js` + `strategies.js`/`features.js`/`model.js` — hourly playbook: six setups filtered by a walk-forward logistic model; train 50 / validation 25 / holdout 25. Settings chosen on validation only; holdout touched once. Currently all disabled — do not loosen criteria to make them pass.
- `backtest.js` — conservative fills: next-bar open entry, stop assumed first when a bar spans both levels, gaps fill at open.
- `scanner.js` — live loop, alerts entries and exits, records live outcomes in `data/signals-state.json`.
- Feeds are proxies (GC=F, NQ=F, Binance), not Exness quotes — alerts give stop/target as distances for that reason.
- Commands: `npm run research | signals [-- --once] | replay -- USTEC 200 | diagnose -- XAUUSD | telegram -- chats|test`. Corporate TLS on the dev PC needs `--use-system-ca` (already in the npm scripts).

## Conventions

- ESM everywhere, Node 20+
- No build step in the backend — keep it runnable with `npm start`
- Comments explain *why*, not *what*
- No new dependency without a reason it cannot be done with the standard library
