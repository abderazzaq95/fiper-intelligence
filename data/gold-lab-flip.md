# XAUUSD strategy lab — set "flip", objective "t"

2023-01-02 → 2024-11-17 (1.9 years of minute bid/ask). **PRELIMINARY — less than 3 years of data; a direction, not a verdict.**
Real bid/ask fills, stop-first on ambiguous minutes, $0.05 stop slippage. Settings chosen on the first 60% of days only; validate and holdout never influence the choice.

## SR — Sweep & Reclaim (Asian range / prior-day levels)

Chosen on develop: `{"rr":3,"sweepPips":8,"maxStopPips":15,"levels":"both","be":null}` — **does not hold out of sample**

| period | trades | win rate | win (95% low) | avg win / loss | expectancy | profit factor | max DD | longest losing streak | trades/week |
|---|---|---|---|---|---|---|---|---|---|
| develop (chosen here) | 85 | 25.9% | 17.8% | 2.66 / -1.04R | -0.082R | 0.89 | 20.5R | 9 | 1.4 |
| validate | 24 | 25.0% | 12.0% | 2.62 / -1.04R | -0.122R | 0.84 | 9.0R | 6 | 1.2 |
| **holdout** | 11 | 36.4% | 15.2% | 2.86 / -1.03R | +0.383R | 1.58 | 6.2R | 6 | 0.6 |
| all | 120 | 26.7% | 19.6% | 2.68 / -1.04R | -0.047R | 0.94 | 20.5R | 11 | 1.2 |

Flip odds over all trades: at 2% risk the account doubles before halving in 7.9% of simulations (halves first 59.7%); at 5% risk 22.2% vs 77.6%, median 52 trades to double.

## BR — Asian-range Break & Retest (limit entry)

Chosen on develop: `{"stopPips":15,"rr":3,"offsetPips":0}` — **does not hold out of sample**

| period | trades | win rate | win (95% low) | avg win / loss | expectancy | profit factor | max DD | longest losing streak | trades/week |
|---|---|---|---|---|---|---|---|---|---|
| develop (chosen here) | 174 | 20.7% | 15.3% | 3.00 / -1.03R | -0.199R | 0.76 | 42.4R | 18 | 2.9 |
| validate | 49 | 22.4% | 13.0% | 3.00 / -1.03R | -0.128R | 0.84 | 11.9R | 9 | 2.5 |
| **holdout** | 49 | 20.4% | 11.5% | 3.00 / -1.03R | -0.210R | 0.74 | 17.1R | 7 | 2.6 |
| all | 272 | 21.0% | 16.5% | 3.00 / -1.03R | -0.188R | 0.77 | 55.9R | 18 | 2.8 |

Flip odds over all trades: at 2% risk the account doubles before halving in 0.4% of simulations (halves first 97.2%); at 5% risk 5.9% vs 94.2%, median 34 trades to double.

## TMP — Trend Micro-Pullback (H1 trend, M5 entry)

Chosen on develop: `{"rr":5,"maxStopPips":20,"be":null}` — **does not hold out of sample**

| period | trades | win rate | win (95% low) | avg win / loss | expectancy | profit factor | max DD | longest losing streak | trades/week |
|---|---|---|---|---|---|---|---|---|---|
| develop (chosen here) | 427 | 21.5% | 17.9% | 3.48 / -1.04R | -0.064R | 0.92 | 52.8R | 24 | 7.2 |
| validate | 78 | 16.7% | 10.0% | 3.19 / -1.02R | -0.319R | 0.63 | 30.3R | 16 | 3.9 |
| **holdout** | 42 | 14.3% | 6.7% | 3.08 / -1.03R | -0.440R | 0.50 | 18.5R | 14 | 2.2 |
| all | 547 | 20.3% | 17.1% | 3.43 / -1.03R | -0.129R | 0.84 | 96.2R | 24 | 5.6 |

Flip odds over all trades: at 2% risk the account doubles before halving in 4.2% of simulations (halves first 87.9%); at 5% risk 13.9% vs 86.1%, median 31 trades to double.
