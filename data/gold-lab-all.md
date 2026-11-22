# XAUUSD strategy lab — set "all", objective "t"

Source exness: 2023-01-02 → 2024-11-17, 2025-01-01 → 2025-07-20, 2026-01-01 → 2026-04-19 (2.7 years of minute bid/ask). **PRELIMINARY — less than 3 years of data; a direction, not a verdict.**
Develop < 2025-01-01 ≤ validate < 2026-01-01 ≤ holdout. Real bid/ask fills, stop-first on ambiguous minutes, stop slippage. Settings chosen on develop only; validate and holdout never influence the choice.

## AF — Asian-session stretch fade (back toward session average)

Chosen on develop: `{"stretch":0.25,"tpFrac":1,"slMult":1.5}` — **does not hold out of sample**

| period | trades | win rate | win (95% low) | avg win / loss | expectancy | profit factor | max DD | longest losing streak | trades/week |
|---|---|---|---|---|---|---|---|---|---|
| develop (chosen here) | 105 | 50.5% | 41.1% | 0.42 / -0.46R | -0.016R | 0.93 | 8.3R | 5 | 1.1 |
| validate | 65 | 55.4% | 43.3% | 0.47 / -0.57R | +0.006R | 1.02 | 5.1R | 5 | 2.3 |
| **holdout** | 15 | 46.7% | 24.8% | 0.52 / -0.71R | -0.133R | 0.65 | 4.0R | 5 | 1.0 |
| all | 185 | 51.9% | 44.7% | 0.45 / -0.52R | -0.018R | 0.93 | 8.3R | 5 | 1.3 |

Flip odds over all trades: at 2% risk the account doubles before halving in 0.0% of simulations (halves first 1.9%); at 5% risk 5.9% vs 52.0%, median 234 trades to double.

## LPB — London trend-day pullback scalp

Chosen on develop: `{"trendAtr":0.15,"tpAtr":0.08,"slAtr":0.25,"depth":0.38}` — **does not hold out of sample**

| period | trades | win rate | win (95% low) | avg win / loss | expectancy | profit factor | max DD | longest losing streak | trades/week |
|---|---|---|---|---|---|---|---|---|---|
| develop (chosen here) | 117 | 74.4% | 65.8% | 0.37 / -1.00R | +0.017R | 1.07 | 5.5R | 3 | 1.2 |
| validate | 43 | 65.1% | 50.2% | 0.33 / -1.00R | -0.138R | 0.61 | 8.2R | 5 | 1.5 |
| **holdout** | 8 | 62.5% | 30.6% | 0.39 / -1.00R | -0.130R | 0.65 | 1.7R | 1 | 0.5 |
| all | 168 | 71.4% | 64.2% | 0.36 / -1.00R | -0.030R | 0.90 | 9.2R | 5 | 1.2 |

Flip odds over all trades: at 2% risk the account doubles before halving in 0.0% of simulations (halves first 7.0%); at 5% risk 4.2% vs 69.3%, median 203 trades to double.

## LF — Prior-day high/low first-touch fade

Chosen on develop: `{"tpAtr":0.12,"slAtr":0.2,"minRoom":0.3,"offset":0.03}` — **does not hold out of sample**

| period | trades | win rate | win (95% low) | avg win / loss | expectancy | profit factor | max DD | longest losing streak | trades/week |
|---|---|---|---|---|---|---|---|---|---|
| develop (chosen here) | 98 | 56.1% | 46.3% | 0.59 / -1.01R | -0.111R | 0.75 | 17.8R | 5 | 1.0 |
| validate | 23 | 56.5% | 36.8% | 0.60 / -1.01R | -0.098R | 0.78 | 3.4R | 3 | 0.8 |
| **holdout** | 5 | 100.0% | 56.6% | 0.60 / 0.00R | +0.600R | ∞ | 0.0R | 0 | 0.3 |
| all | 126 | 57.9% | 49.2% | 0.59 / -1.01R | -0.081R | 0.81 | 17.8R | 5 | 0.9 |

Flip odds over all trades: at 2% risk the account doubles before halving in 0.0% of simulations (halves first 59.0%); at 5% risk 0.9% vs 96.8%, median 123 trades to double.

## SR — Sweep & Reclaim (Asian range / prior-day levels)

Chosen on develop: `{"rr":3,"sweepPips":8,"maxStopPips":20,"levels":"both","be":null}` — **does not hold out of sample**

| period | trades | win rate | win (95% low) | avg win / loss | expectancy | profit factor | max DD | longest losing streak | trades/week |
|---|---|---|---|---|---|---|---|---|---|
| develop (chosen here) | 257 | 27.2% | 22.2% | 2.72 / -1.03R | -0.009R | 0.99 | 35.0R | 14 | 2.6 |
| validate | 44 | 34.1% | 21.9% | 2.84 / -1.03R | +0.287R | 1.42 | 8.2R | 8 | 1.5 |
| **holdout** | 7 | 42.9% | 15.8% | 2.75 / -1.03R | +0.590R | 2.00 | 2.1R | 2 | 0.5 |
| all | 308 | 28.6% | 23.8% | 2.74 / -1.03R | +0.047R | 1.06 | 35.0R | 14 | 2.2 |

Flip odds over all trades: at 2% risk the account doubles before halving in 35.3% of simulations (halves first 22.9%); at 5% risk 42.7% vs 57.1%, median 58 trades to double.

## BR — Asian-range Break & Retest (limit entry)

Chosen on develop: `{"stopPips":10,"rr":4,"offsetPips":3}` — **does not hold out of sample**

| period | trades | win rate | win (95% low) | avg win / loss | expectancy | profit factor | max DD | longest losing streak | trades/week |
|---|---|---|---|---|---|---|---|---|---|
| develop (chosen here) | 292 | 17.8% | 13.8% | 4.02 / -1.05R | -0.147R | 0.83 | 77.4R | 21 | 3.0 |
| validate | 71 | 21.1% | 13.2% | 4.06 / -1.05R | +0.030R | 1.04 | 18.1R | 17 | 2.5 |
| **holdout** | 19 | 5.3% | 0.9% | 4.00 / -1.05R | -0.784R | 0.21 | 14.9R | 10 | 1.2 |
| all | 382 | 17.8% | 14.3% | 4.03 / -1.05R | -0.146R | 0.83 | 77.4R | 21 | 2.7 |

Flip odds over all trades: at 2% risk the account doubles before halving in 2.9% of simulations (halves first 91.7%); at 5% risk 12.5% vs 87.5%, median 34 trades to double.

## TMP — Trend Micro-Pullback (H1 trend, M5 entry)

Chosen on develop: `{"rr":5,"maxStopPips":20,"be":null}` — **does not hold out of sample**

| period | trades | win rate | win (95% low) | avg win / loss | expectancy | profit factor | max DD | longest losing streak | trades/week |
|---|---|---|---|---|---|---|---|---|---|
| develop (chosen here) | 547 | 20.3% | 17.1% | 3.43 / -1.03R | -0.129R | 0.84 | 96.2R | 24 | 5.6 |
| validate | 31 | 32.3% | 18.6% | 3.15 / -1.03R | +0.321R | 1.46 | 10.3R | 10 | 1.1 |
| **holdout** | 0 | 0.0% | 0.0% | 0.00 / 0.00R | +0.000R | 0.00 | 0.0R | 0 | 0.0 |
| all | 578 | 20.9% | 17.8% | 3.40 / -1.03R | -0.105R | 0.87 | 104.4R | 24 | 4.1 |

Flip odds over all trades: at 2% risk the account doubles before halving in 6.0% of simulations (halves first 83.0%); at 5% risk 16.5% vs 83.5%, median 34 trades to double.

## LORB — London opening-range breakout

Chosen on develop: `{"rangeEnd":7,"stopMode":"opp","tpR":2,"maxRangeAtr":1,"be":0.6}` — **does not hold out of sample**

| period | trades | win rate | win (95% low) | avg win / loss | expectancy | profit factor | max DD | longest losing streak | trades/week |
|---|---|---|---|---|---|---|---|---|---|
| develop (chosen here) | 332 | 58.1% | 52.8% | 0.67 / -0.86R | +0.026R | 1.07 | 20.7R | 6 | 3.4 |
| validate | 68 | 60.3% | 48.4% | 0.52 / -0.83R | -0.016R | 0.95 | 7.2R | 4 | 2.4 |
| **holdout** | 16 | 43.8% | 23.1% | 0.47 / -0.87R | -0.282R | 0.42 | 4.6R | 3 | 1.0 |
| all | 416 | 57.9% | 53.1% | 0.64 / -0.86R | +0.008R | 1.02 | 20.7R | 6 | 2.9 |

Flip odds over all trades: at 2% risk the account doubles before halving in 6.2% of simulations (halves first 6.3%); at 5% risk 32.2% vs 53.9%, median 140 trades to double.

## NYORB — New York open breakout

Chosen on develop: `{"orMinutes":60,"stopMode":"opp","tpR":2,"be":null}` — **does not hold out of sample**

| period | trades | win rate | win (95% low) | avg win / loss | expectancy | profit factor | max DD | longest losing streak | trades/week |
|---|---|---|---|---|---|---|---|---|---|
| develop (chosen here) | 408 | 48.0% | 43.2% | 0.86 / -0.72R | +0.040R | 1.11 | 17.8R | 8 | 4.2 |
| validate | 102 | 37.3% | 28.5% | 0.85 / -0.80R | -0.183R | 0.63 | 22.2R | 7 | 3.6 |
| **holdout** | 37 | 48.6% | 33.4% | 1.25 / -0.95R | +0.121R | 1.25 | 4.0R | 4 | 2.4 |
| all | 547 | 46.1% | 41.9% | 0.89 / -0.75R | +0.004R | 1.01 | 28.9R | 8 | 3.9 |

Flip odds over all trades: at 2% risk the account doubles before halving in 5.8% of simulations (halves first 8.4%); at 5% risk 31.7% vs 56.1%, median 149 trades to double.

## PDB — Prior-day high/low breakout (with daily trend)

Chosen on develop: `{"stopAtr":0.5,"tpR":2.5,"trend":true,"be":0.6}` — **does not hold out of sample**

| period | trades | win rate | win (95% low) | avg win / loss | expectancy | profit factor | max DD | longest losing streak | trades/week |
|---|---|---|---|---|---|---|---|---|---|
| develop (chosen here) | 204 | 55.9% | 49.0% | 0.60 / -0.75R | +0.006R | 1.02 | 16.3R | 6 | 2.1 |
| validate | 49 | 55.1% | 41.3% | 0.56 / -0.87R | -0.080R | 0.79 | 6.5R | 5 | 1.7 |
| **holdout** | 15 | 66.7% | 41.7% | 0.82 / -0.52R | +0.374R | 3.16 | 1.1R | 2 | 1.0 |
| all | 268 | 56.3% | 50.4% | 0.61 / -0.76R | +0.011R | 1.03 | 16.3R | 6 | 1.9 |

Flip odds over all trades: at 2% risk the account doubles before halving in 5.3% of simulations (halves first 3.5%); at 5% risk 34.2% vs 45.4%, median 161 trades to double.

## PDS — Prior-day high/low sweep & reverse

Chosen on develop: `{"sweepAtr":0.05,"stopBuf":0.1,"target":"1R","be":0.6}` — **does not hold out of sample**

| period | trades | win rate | win (95% low) | avg win / loss | expectancy | profit factor | max DD | longest losing streak | trades/week |
|---|---|---|---|---|---|---|---|---|---|
| develop (chosen here) | 266 | 59.4% | 53.4% | 0.66 / -0.87R | +0.037R | 1.11 | 10.1R | 8 | 2.7 |
| validate | 50 | 68.0% | 54.2% | 0.56 / -0.93R | +0.081R | 1.27 | 4.6R | 2 | 1.7 |
| **holdout** | 19 | 47.4% | 27.3% | 0.48 / -0.61R | -0.090R | 0.72 | 5.0R | 5 | 1.2 |
| all | 335 | 60.0% | 54.7% | 0.63 / -0.86R | +0.037R | 1.11 | 10.1R | 8 | 2.4 |

Flip odds over all trades: at 2% risk the account doubles before halving in 13.3% of simulations (halves first 0.5%); at 5% risk 53.7% vs 24.8%, median 177 trades to double.

## VB — Volatility breakout (open ± k × prior range, hold to close)

Chosen on develop: `{"k":0.5,"stopFrac":0.5,"exit":"2R","from":"asia","vol":"high"}` — **does not hold out of sample**

| period | trades | win rate | win (95% low) | avg win / loss | expectancy | profit factor | max DD | longest losing streak | trades/week |
|---|---|---|---|---|---|---|---|---|---|
| develop (chosen here) | 128 | 46.1% | 37.7% | 1.72 / -0.95R | +0.279R | 1.54 | 6.0R | 4 | 1.3 |
| validate | 41 | 39.0% | 25.7% | 1.77 / -0.97R | +0.097R | 1.16 | 8.0R | 6 | 1.4 |
| **holdout** | 10 | 30.0% | 10.8% | 1.35 / -1.00R | -0.296R | 0.58 | 3.5R | 3 | 0.6 |
| all | 179 | 43.6% | 36.5% | 1.72 / -0.96R | +0.205R | 1.38 | 8.1R | 6 | 1.3 |

Flip odds over all trades: at 2% risk the account doubles before halving in 93.7% of simulations (halves first 0.3%); at 5% risk 89.2% vs 10.4%, median 64 trades to double.

## IMOM — Intraday momentum (overnight + US morning → into COMEX close)

Chosen on develop: `{"signalAt":630,"minMove":0.4,"stopAtr":0.6,"exitAt":810}` — **does not hold out of sample**

| period | trades | win rate | win (95% low) | avg win / loss | expectancy | profit factor | max DD | longest losing streak | trades/week |
|---|---|---|---|---|---|---|---|---|---|
| develop (chosen here) | 188 | 51.6% | 44.5% | 0.42 / -0.32R | +0.061R | 1.39 | 5.0R | 9 | 1.9 |
| validate | 66 | 40.9% | 29.9% | 0.41 / -0.29R | -0.005R | 0.97 | 3.1R | 8 | 2.3 |
| **holdout** | 26 | 30.8% | 16.5% | 0.68 / -0.26R | +0.030R | 1.17 | 2.3R | 8 | 1.7 |
| all | 280 | 47.1% | 41.4% | 0.43 / -0.31R | +0.042R | 1.26 | 5.0R | 9 | 2.0 |

Flip odds over all trades: at 2% risk the account doubles before halving in 4.7% of simulations (halves first 0.0%); at 5% risk 62.0% vs 1.4%, median 229 trades to double.

## NEWS — 08:30 NY data impulse (follow or fade the first 5 minutes)

Chosen on develop: `{"minMoveAtr":0.12,"mode":"follow","target":"time"}` — **does not hold out of sample**

| period | trades | win rate | win (95% low) | avg win / loss | expectancy | profit factor | max DD | longest losing streak | trades/week |
|---|---|---|---|---|---|---|---|---|---|
| develop (chosen here) | 101 | 44.6% | 35.2% | 1.53 / -0.96R | +0.149R | 1.28 | 18.2R | 7 | 1.0 |
| validate | 10 | 20.0% | 5.7% | 0.81 / -1.02R | -0.653R | 0.20 | 8.1R | 8 | 0.3 |
| **holdout** | 7 | 28.6% | 8.2% | 0.61 / -0.77R | -0.374R | 0.32 | 3.8R | 5 | 0.5 |
| all | 118 | 41.5% | 33.0% | 1.46 / -0.95R | +0.050R | 1.09 | 25.5R | 10 | 0.8 |

Flip odds over all trades: at 2% risk the account doubles before halving in 34.2% of simulations (halves first 10.3%); at 5% risk 48.1% vs 50.2%, median 87 trades to double.

## BIG — Day after an outsized daily candle (follow or fade)

Chosen on develop: `{"mult":1.5,"mode":"follow","stopAtr":0.7,"target":"1R"}` — **does not hold out of sample**

| period | trades | win rate | win (95% low) | avg win / loss | expectancy | profit factor | max DD | longest losing streak | trades/week |
|---|---|---|---|---|---|---|---|---|---|
| develop (chosen here) | 40 | 55.0% | 39.8% | 0.58 / -0.53R | +0.082R | 1.35 | 4.0R | 4 | 0.4 |
| validate | 5 | 20.0% | 3.6% | 1.00 / -0.40R | -0.123R | 0.62 | 1.1R | 2 | 0.2 |
| **holdout** | 7 | 71.4% | 35.9% | 0.73 / -1.00R | +0.236R | 1.83 | 2.0R | 2 | 0.5 |
| all | 52 | 53.8% | 40.5% | 0.62 / -0.55R | +0.083R | 1.33 | 4.8R | 4 | 0.4 |

Flip odds over all trades: at 2% risk the account doubles before halving in 47.7% of simulations (halves first 0.0%); at 5% risk 92.2% vs 1.5%, median 152 trades to double.
