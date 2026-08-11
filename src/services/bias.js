/**
 * Directional bias per asset.
 *
 * Rule-based on purpose. Every number that goes into the score is
 * inspectable and returned in `inputs`, so the UI can explain the call
 * instead of asking the user to trust a black box. Swap this for a model
 * later if you like — keep the explainability.
 */
const HAVENS = new Set(['XAUUSD', 'XAGUSD', 'JPY', 'USDJPY', 'DXY']);

export function computeBias(symbol, { quote, risk, cot, dollarChange = 0 }) {
  if (!quote) return null;

  const momentum = quote.change * 10;
  const riskTilt = (HAVENS.has(symbol) ? (50 - risk.score) : (risk.score - 50)) * 0.5;
  const dollarTilt = symbol === 'DXY' ? 0 : -dollarChange * 3;

  let positioning = 0;
  if (cot?.length) {
    const net = cot[0].specLong - cot[0].specShort;
    const total = cot[0].specLong + cot[0].specShort || 1;
    positioning = (net / total) * 8;
  }

  const score = momentum + riskTilt + dollarTilt + positioning;

  return {
    symbol,
    direction: score > 12 ? 'Bullish' : score < -12 ? 'Bearish' : 'Neutral',
    swing: label(score, 22, 6),
    day:   label(quote.change * 10, 9, 1.5),
    confidence: Math.round(Math.min(94, 46 + Math.abs(score) * 1.5)),
    score: Math.round(score * 10) / 10,
    inputs: {
      momentum: round(momentum),
      riskTilt: round(riskTilt),
      dollarTilt: round(dollarTilt),
      positioning: round(positioning)
    },
    levels: keyLevels(quote.price),
    at: Date.now()
  };
}

const round = n => Math.round(n * 10) / 10;

function label(v, strong, mild) {
  if (v > strong) return 'Bullish';
  if (v > mild) return 'Slightly Bullish';
  if (v < -strong) return 'Bearish';
  if (v < -mild) return 'Slightly Bearish';
  return 'Neutral';
}

/**
 * Percentage-based levels around spot. These are reference bands, not
 * derived support and resistance — swap in pivots or swing highs from
 * real OHLC before presenting them as anything more than that.
 */
function keyLevels(price) {
  return {
    resistance2: round(price * 1.018),
    resistance1: round(price * 1.009),
    spot: round(price),
    support1: round(price * 0.991),
    support2: round(price * 0.982)
  };
}
