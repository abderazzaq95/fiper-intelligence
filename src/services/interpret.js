import { config } from '../config.js';
import { cache } from '../lib/cache.js';
import { log } from '../lib/logger.js';

/**
 * The AI layer: raw headline → per-asset directional impact.
 *
 * This is the part users are actually paying for, so a few deliberate
 * choices:
 *  - Results are cached by headline. The same wire story reaching you
 *    twice must not produce two different calls.
 *  - The model is asked for structured JSON and the output is validated.
 *    Anything malformed is dropped rather than guessed at.
 *  - Confidence is returned and surfaced. A low-confidence read should
 *    look different in the UI from a high-confidence one.
 */
const TRACKED = ['NQUSD','ESUSD','DAX','XAUUSD','XAGUSD','USOIL','DXY',
                 'EURUSD','GBPUSD','USDJPY','AUDUSD','BTCUSD','ETHUSD'];

const SYSTEM = `You interpret financial news for experienced traders.

For each headline, decide which of these instruments it moves and in which direction:
${TRACKED.join(', ')}

Rules:
- Only list an instrument if the headline has a direct, explainable transmission to it. Two or three is normal; listing eight means you are guessing.
- direction is "up" or "down" — the expected move in that instrument.
- Confidence reflects how reliably this type of headline has moved these markets, not how confident you feel writing it.
- summary is one sentence explaining the mechanism, not a restatement of the headline.
- If the headline is not market-moving, return an empty impacts array.

Return only JSON matching:
{"impacts":[{"symbol":"NQUSD","direction":"up","confidence":0.0-1.0}],
 "summary":"one sentence","impact":"HIGH"|"MED"|"LOW","category":"forex"|"indices"|"commodities"|"crypto"|"macro"}`;

export async function interpretHeadline(headline, { publisher = '' } = {}) {
  if (!config.keys.anthropic) return null;

  const key = `interp:${hash(headline)}`;
  const hit = cache.get(key);
  if (hit) return hit;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': config.keys.anthropic,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: config.anthropicModel,
        max_tokens: 400,
        system: SYSTEM,
        messages: [{ role: 'user', content: `${headline}${publisher ? `\n(via ${publisher})` : ''}` }]
      })
    });

    if (!res.ok) { log.warn(`interpret ${res.status}`); return null; }

    const body = await res.json();
    const text = body.content?.filter(b => b.type === 'text').map(b => b.text).join('') ?? '';
    const parsed = safeParse(text);
    if (!parsed) return null;

    const clean = validate(parsed);
    return cache.set(key, clean, 24 * 3600_000);
  } catch (err) {
    log.warn(`interpret failed: ${err.message}`);
    return null;
  }
}

/** Interpret a batch, bounded concurrency so one burst cannot blow the rate limit. */
export async function interpretBatch(items, concurrency = 3) {
  const out = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const slice = items.slice(i, i + concurrency);
    const results = await Promise.all(
      slice.map(n => interpretHeadline(n.headline, { publisher: n.publisher }))
    );
    slice.forEach((n, j) => out.push({ ...n, ai: results[j] }));
  }
  return out;
}

function safeParse(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

/** Drop anything the model invented. Never trust the shape blindly. */
function validate(p) {
  const impacts = Array.isArray(p.impacts) ? p.impacts
    .filter(i => TRACKED.includes(i.symbol) && ['up', 'down'].includes(i.direction))
    .slice(0, 5)
    .map(i => ({
      symbol: i.symbol,
      direction: i.direction,
      confidence: Math.max(0, Math.min(1, Number(i.confidence) || 0.5))
    })) : [];

  return {
    impacts,
    summary: typeof p.summary === 'string' ? p.summary.slice(0, 320) : '',
    impact: ['HIGH', 'MED', 'LOW'].includes(p.impact) ? p.impact : 'LOW',
    category: ['forex','indices','commodities','crypto','macro'].includes(p.category) ? p.category : 'macro',
    model: config.anthropicModel
  };
}

function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; }
  return (h >>> 0).toString(36);
}
