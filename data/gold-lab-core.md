# XAUUSD strategy lab — set "core", objective "t"

2023-01-02 → 2024-11-17 (1.9 years of minute bid/ask). **PRELIMINARY — less than 3 years of data; a direction, not a verdict.**
Real bid/ask fills, stop-first on ambiguous minutes, $0.05 stop slippage. Settings chosen on the first 60% of days only; validate and holdout never influence the choice.

## LORB — London opening-range breakout

Chosen on develop: `{"rangeEnd":7,"stopMode":"opp","tpR":1,"maxRangeAtr":0.6,"be":0.6}` — **does not hold out of sample**

| period | trades | win rate | win (95% low) | avg win / loss | expectancy | profit factor | max DD | longest losing streak | trades/week |
|---|---|---|---|---|---|---|---|---|---|
| develop (chosen here) | 198 | 55.1% | 48.1% | 0.65 / -0.89R | -0.044R | 0.89 | 11.9R | 6 | 3.3 |
| validate | 61 | 67.2% | 54.7% | 0.61 / -0.82R | +0.145R | 1.54 | 3.9R | 2 | 3.1 |
| **holdout** | 54 | 57.4% | 44.2% | 0.62 / -0.88R | -0.017R | 0.95 | 4.3R | 4 | 2.9 |
| all | 313 | 57.8% | 52.3% | 0.64 / -0.88R | -0.002R | 0.99 | 12.4R | 6 | 3.2 |

Flip odds over all trades: at 2% risk the account doubles before halving in 2.4% of simulations (halves first 6.3%); at 5% risk 24.1% vs 56.1%, median 167 trades to double.

## NYORB — New York open breakout

Chosen on develop: `{"orMinutes":30,"stopMode":"opp","tpR":2,"be":0.6}` — **does not hold out of sample**

| period | trades | win rate | win (95% low) | avg win / loss | expectancy | profit factor | max DD | longest losing streak | trades/week |
|---|---|---|---|---|---|---|---|---|---|
| develop (chosen here) | 250 | 62.4% | 56.3% | 0.61 / -0.79R | +0.085R | 1.29 | 11.4R | 6 | 4.2 |
| validate | 93 | 55.9% | 45.8% | 0.49 / -0.85R | -0.104R | 0.72 | 15.1R | 4 | 4.7 |
| **holdout** | 85 | 61.2% | 50.5% | 0.54 / -0.95R | -0.043R | 0.88 | 11.1R | 4 | 4.5 |
| all | 428 | 60.7% | 56.0% | 0.57 / -0.84R | +0.019R | 1.06 | 21.1R | 6 | 4.4 |

Flip odds over all trades: at 2% risk the account doubles before halving in 8.7% of simulations (halves first 3.1%); at 5% risk 39.8% vs 41.6%, median 158 trades to double.

## PDB — Prior-day high/low breakout (with daily trend)

Chosen on develop: `{"stopAtr":0.5,"tpR":2.5,"trend":false,"be":0.6}` — **does not hold out of sample**

| period | trades | win rate | win (95% low) | avg win / loss | expectancy | profit factor | max DD | longest losing streak | trades/week |
|---|---|---|---|---|---|---|---|---|---|
| develop (chosen here) | 208 | 55.8% | 49.0% | 0.57 / -0.74R | -0.008R | 0.98 | 12.8R | 6 | 3.5 |
| validate | 73 | 49.3% | 38.2% | 0.67 / -0.77R | -0.060R | 0.85 | 8.0R | 5 | 3.7 |
| **holdout** | 65 | 61.5% | 49.4% | 0.55 / -0.73R | +0.061R | 1.22 | 3.9R | 5 | 3.5 |
| all | 346 | 55.5% | 50.2% | 0.59 / -0.75R | -0.006R | 0.98 | 18.0R | 6 | 3.5 |

Flip odds over all trades: at 2% risk the account doubles before halving in 2.0% of simulations (halves first 7.4%); at 5% risk 22.6% vs 59.0%, median 160 trades to double.

## PDS — Prior-day high/low sweep & reverse

Chosen on develop: `{"sweepAtr":0.05,"stopBuf":0.1,"target":"1R","be":0.6}` — **does not hold out of sample**

| period | trades | win rate | win (95% low) | avg win / loss | expectancy | profit factor | max DD | longest losing streak | trades/week |
|---|---|---|---|---|---|---|---|---|---|
| develop (chosen here) | 159 | 63.5% | 55.8% | 0.66 / -0.89R | +0.093R | 1.29 | 4.0R | 4 | 2.7 |
| validate | 62 | 51.6% | 39.4% | 0.68 / -0.88R | -0.075R | 0.82 | 9.7R | 8 | 3.1 |
| **holdout** | 45 | 55.6% | 41.2% | 0.65 / -0.81R | -0.003R | 0.99 | 5.1R | 4 | 2.4 |
| all | 266 | 59.4% | 53.4% | 0.66 / -0.87R | +0.037R | 1.11 | 10.1R | 8 | 2.7 |

Flip odds over all trades: at 2% risk the account doubles before halving in 13.7% of simulations (halves first 0.5%); at 5% risk 53.6% vs 23.9%, median 170 trades to double.
