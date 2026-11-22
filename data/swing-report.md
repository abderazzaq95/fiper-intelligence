# Swing playbook — research

Generated 2026-11-22T10:57:59.519Z. Daily bars, entry next open, exit on first close above the 5-day average, 10-day time stop, 3-ATR protective stop. Spread and overnight swap charged on every trade. Rules fixed in advance — no parameter search.

## USTEC — ENABLED

positive expectancy in development AND holdout. ~0.69 signals/month. Data 2000-09-18 → 2026-11-20.

| sample | trades | win rate | win (95% low) | expectancy | profit factor | stop-outs | avg nights | max DD |
|---|---|---|---|---|---|---|---|---|
| development (first 70%) | 147 | 66.7% | 58.7% | 0.073R | 1.55 | 14 | 2.6 | 3.3R |
| **holdout (last 30%)** | 63 | 69.8% | 57.6% | 0.089R | 1.77 | 5 | 2.4 | 2.2R |
| all | 210 | 67.6% | 61.0% | 0.078R | 1.61 | 19 | 2.5 | 3.8R |

Win rate by dip depth (all history):

| RSI(2) at signal | trades | win rate | win (95% low) |
|---|---|---|---|
| 0–3 | 12 | 75.0% | 46.8% |
| 3–6 | 67 | 62.7% | 50.7% |
| 6–10 | 131 | 69.5% | 61.1% |

- Flip odds at 2% risk: doubles before halving in **34.4%** of 4,000 simulations; halves first in 0.0%; median 350 trades to double.
- Flip odds at 5% risk: doubles before halving in **97.6%** of 4,000 simulations; halves first in 0.0%; median 175 trades to double.

## XAUUSD — DISABLED

edge did not hold in both periods. ~0.58 signals/month. Data 2000-08-30 → 2026-11-20.

| sample | trades | win rate | win (95% low) | expectancy | profit factor | stop-outs | avg nights | max DD |
|---|---|---|---|---|---|---|---|---|
| development (first 70%) | 123 | 61.0% | 52.1% | 0.010R | 1.06 | 14 | 3.0 | 4.0R |
| **holdout (last 30%)** | 54 | 64.8% | 51.5% | -0.017R | 0.90 | 6 | 3.0 | 4.2R |
| all | 177 | 62.1% | 54.8% | 0.002R | 1.01 | 20 | 3.0 | 6.1R |

Win rate by dip depth (all history):

| RSI(2) at signal | trades | win rate | win (95% low) |
|---|---|---|---|
| 0–3 | 12 | 83.3% | 55.2% |
| 3–6 | 58 | 62.1% | 49.2% |
| 6–10 | 107 | 59.8% | 50.3% |

- Flip odds at 2% risk: doubles before halving in **0.0%** of 4,000 simulations; halves first in 0.0%; median — trades to double.
- Flip odds at 5% risk: doubles before halving in **10.1%** of 4,000 simulations; halves first in 16.7%; median 264 trades to double.

## BTCUSD — DISABLED

edge did not hold in both periods. ~0.71 signals/month. Data 2017-08-17 → 2026-11-21.

| sample | trades | win rate | win (95% low) | expectancy | profit factor | stop-outs | avg nights | max DD |
|---|---|---|---|---|---|---|---|---|
| development (first 70%) | 51 | 74.5% | 61.1% | 0.035R | 1.29 | 5 | 2.6 | 2.9R |
| **holdout (last 30%)** | 23 | 65.2% | 44.9% | -0.027R | 0.82 | 3 | 2.7 | 2.6R |
| all | 74 | 71.6% | 60.5% | 0.016R | 1.12 | 8 | 2.6 | 2.9R |

Win rate by dip depth (all history):

| RSI(2) at signal | trades | win rate | win (95% low) |
|---|---|---|---|
| 0–3 | 6 | 50.0% | 18.8% |
| 3–6 | 24 | 58.3% | 38.8% |
| 6–10 | 44 | 81.8% | 68.0% |

- Flip odds at 2% risk: doubles before halving in **0.0%** of 4,000 simulations; halves first in 0.0%; median — trades to double.
- Flip odds at 5% risk: doubles before halving in **21.4%** of 4,000 simulations; halves first in 3.3%; median 288 trades to double.
