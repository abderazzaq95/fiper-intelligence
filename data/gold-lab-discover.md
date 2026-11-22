# XAUUSD strategy lab — set "discover", objective "t"

Source exness: 2023-01-02 → 2024-11-17, 2025-01-01 → 2025-07-20, 2026-01-01 → 2026-04-19 (2.7 years of minute bid/ask). **PRELIMINARY — less than 3 years of data; a direction, not a verdict.**
Develop < 2025-01-01 ≤ validate < 2026-01-01 ≤ holdout. Real bid/ask fills, stop-first on ambiguous minutes, stop slippage. Settings chosen on develop only; validate and holdout never influence the choice.

## VB — Volatility breakout (open ± k × prior range, hold to close)

Chosen on develop: `{"k":0.5,"stopFrac":0.5,"exit":"2R","from":"asia","vol":"high"}` — **does not hold out of sample**

| period | trades | win rate | win (95% low) | avg win / loss | expectancy | profit factor | max DD | longest losing streak | trades/week |
|---|---|---|---|---|---|---|---|---|---|
| develop (chosen here) | 128 | 46.1% | 37.7% | 1.72 / -0.95R | +0.279R | 1.54 | 6.0R | 4 | 1.3 |
| validate | 41 | 39.0% | 25.7% | 1.77 / -0.97R | +0.097R | 1.16 | 8.0R | 6 | 1.4 |
| **holdout** | 10 | 30.0% | 10.8% | 1.35 / -1.00R | -0.296R | 0.58 | 3.5R | 3 | 0.6 |
| all | 179 | 43.6% | 36.5% | 1.72 / -0.96R | +0.205R | 1.38 | 8.1R | 6 | 1.3 |

Flip odds over all trades: at 2% risk the account doubles before halving in 93.6% of simulations (halves first 0.3%); at 5% risk 89.2% vs 10.7%, median 63 trades to double.
