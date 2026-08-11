# Handoff to Claude Code

## 1. Build the repo

```bash
mkdir -p fiper/web/landing fiper/web/app
cd fiper

# backend
tar -xzf ~/Downloads/fiper-backend.tar.gz -C . --one-top-level=backend

# frontends
cp ~/Downloads/mrkt-fiper-landing.html web/landing/index.html
cp ~/Downloads/fiper-terminal.html     web/app/index.html

# context file — this is the important one
cp ~/Downloads/CLAUDE.md .

git init && git add -A && git commit -m "Initial: landing site, terminal, backend API"
```

## 2. Verify the backend runs

```bash
cd backend
cp .env.example .env
npm install && npm start
```

Expect: three providers enabled (binance, frankfurter, cftc), four disabled with the env var each needs. Then `curl localhost:8080/api/status | jq`.

## 3. Open Claude Code in the repo root

```bash
cd fiper && claude
```

It reads `CLAUDE.md` automatically at the start of every session. That file carries the brand tokens, the live-vs-modelled distinction, and the design decisions — so you never have to re-explain them.

---

## What to say first

Don't ask for everything at once. Give it one scoped task and let it read the code:

> Read CLAUDE.md, then look at web/app/index.html and backend/src/.
>
> First task: migrate the frontends to a Next.js app in web/ — App Router, TypeScript, Tailwind. Landing page at /, terminal at /app. Extract the brand tokens from CLAUDE.md into the Tailwind config, pull the base64 logo out into a real file, and split the 12 dashboard screens into components. Don't wire up the backend yet — get the structure right first, keep it rendering identically.
>
> Plan it out before you start writing files.

## Follow-up tasks, in order

**2 — Wire the backend**
> Replace the direct provider fetches in the dashboard with the client in backend/src/lib/frontend-client.js. Swap the 20-second polling loop for the WebSocket channels. Keep the LIVE/MODEL badges accurate — anything still modelled must still say so.

**3 — Auth and billing**
> Add Supabase auth and Stripe subscriptions. Gate /app behind an active subscription. Login, register, forgot-password, and a paywall screen for logged-in users without a subscription.

**4 — Real backtesting**
> Design a Postgres schema for economic releases and measured price reactions, plus a backfill script. The backtest screen is currently modelled — this is what makes it real.

---

## Things worth telling it explicitly

- **Don't touch the brand colours.** They were sampled from the actual logo file. Approximations were wrong twice already.
- **Keep the LIVE/MODEL badges.** People size trading positions on this. Silently presenting modelled data as real is the worst bug this project can ship.
- **Keep the under-8-instances warning** in backtesting. It's deliberate.
- **The bias engine returns its inputs on purpose.** Don't refactor that away.

## Known gaps — don't let it paper over these

| Gap | Reality |
|---|---|
| Backtest history | No cheap API exists. Needs a real database. |
| News licensing | API access ≠ redistribution rights. Unresolved. |
| Key levels in bias.js | Percentage bands, not real support/resistance. |
| Stock research | Four hardcoded tickers. Needs a fundamentals API. |
