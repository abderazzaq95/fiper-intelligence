import { get } from '../lib/http.js';

const ENDPOINT = 'https://publicreporting.cftc.gov/resource/6dca-aqww.json';

/** Market name patterns → the symbols the terminal uses. */
const MARKETS = {
  EURUSD: /EURO FX/i,
  GBPUSD: /BRITISH POUND/i,
  USDJPY: /JAPANESE YEN/i,
  XAUUSD: /^GOLD/i,
  XAGUSD: /^SILVER/i,
  USOIL:  /CRUDE OIL, LIGHT SWEET/i,
  BTCUSD: /BITCOIN/i
};

/**
 * Commitments of Traders. Keyless, published Friday afternoons for the
 * preceding Tuesday — so it is always a few days behind by design.
 */
export async function fetchCot(weeks = 26) {
  const params = new URLSearchParams({
    '$limit': '800',
    '$order': 'report_date_as_yyyy_mm_dd DESC',
    '$select': [
      'market_and_exchange_names', 'report_date_as_yyyy_mm_dd',
      'noncomm_positions_long_all', 'noncomm_positions_short_all',
      'comm_positions_long_all', 'comm_positions_short_all',
      'open_interest_all'
    ].join(',')
  });

  const rows = await get(`${ENDPOINT}?${params}`);
  if (!Array.isArray(rows)) return null;

  const out = {};
  for (const [symbol, pattern] of Object.entries(MARKETS)) {
    const matched = rows.filter(r => pattern.test(r.market_and_exchange_names || ''));
    if (!matched.length) continue;

    out[symbol] = matched.slice(0, weeks).map(r => ({
      date: r.report_date_as_yyyy_mm_dd?.slice(0, 10),
      specLong:  +r.noncomm_positions_long_all  || 0,
      specShort: +r.noncomm_positions_short_all || 0,
      commLong:  +r.comm_positions_long_all     || 0,
      commShort: +r.comm_positions_short_all    || 0,
      openInterest: +r.open_interest_all || 0
    }));
  }
  return Object.keys(out).length ? { markets: out, source: 'cftc', at: Date.now() } : null;
}
