/**
 * Cross-asset risk appetite, 0–100.
 *
 * The logic mirrors how a macro desk reads the tape: equities and crypto
 * leading means appetite for risk; gold outperforming means the opposite.
 * Weights are deliberately visible rather than buried in a model, so the
 * output can be explained to a user — which matters when they size on it.
 */
const W = { equities: 2.2, crypto: 1.1, energy: 0.6, gold: -1.4 };

export function computeRisk({ quotes = [], crypto = [] }) {
  const bySymbol = Object.fromEntries([...quotes, ...crypto].map(q => [q.symbol, q]));
  const chg = s => bySymbol[s]?.change ?? 0;

  const raw =
      chg('NQUSD') * W.equities
    + chg('BTCUSD') * W.crypto
    + chg('USOIL')  * W.energy
    + chg('XAUUSD') * W.gold;

  const score = Math.max(4, Math.min(96, 50 + raw * 5));

  return {
    score: Math.round(score * 10) / 10,
    state: score > 62 ? 'RISK_ON' : score < 38 ? 'RISK_OFF' : 'NEUTRAL',
    themes: [
      { name: 'Inflation',   value: clamp(Math.abs(chg('XAUUSD')) * 14 + 22) },
      { name: 'Growth',      value: clamp(50 + chg('NQUSD') * 7) },
      { name: 'Geopolitics', value: clamp(30 + Math.abs(chg('USOIL')) * 8) },
      { name: 'Rates',       value: clamp(44 + chg('DXY') * 9) }
    ],
    inputs: { nasdaq: chg('NQUSD'), bitcoin: chg('BTCUSD'), oil: chg('USOIL'), gold: chg('XAUUSD') },
    at: Date.now()
  };
}

const clamp = v => Math.round(Math.max(8, Math.min(96, v)));
