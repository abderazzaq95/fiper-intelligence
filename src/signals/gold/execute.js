/**
 * Minute-by-minute trade replay with broker-realistic fills.
 *
 *   long  — enters at the ASK, exits at the BID (stops and targets
 *           trigger on bid prices, as on MT5)
 *   short — enters at the BID, exits at the ASK (ask = bid + spread)
 *
 * When one minute touches both stop and target, the stop is assumed
 * first. A stop is filled `slip` worse than its level. Gaps (weekend,
 * rollover) fill at the open. These choices all cost money in the
 * backtest on purpose; a strategy that survives them has margin left
 * for real-world friction.
 */
export const DEFAULTS = { slip: 0.05, maxSpread: 1.5 };

/**
 * @param m       minute data from loadM1
 * @param i       minute index to enter at (its open)
 * @param trade   { dir, stop, tp, exitAt?: unix sec hard time exit, beAt?: R to move stop to entry, trailR?: trailing distance in R once beAt hit }
 * @returns       { R, outcome, exitIdx, entry, risk } or null if not enterable (spread blown out / stop on wrong side / no data)
 */
export function execute(m, i, trade, opt = DEFAULTS) {
  if (i >= m.n) return null;
  const { dir } = trade;
  const sp0 = m.sp[Math.max(0, i - 1)];
  // A broker spread this wide means rollover or news — no sane entry happens there
  if (sp0 > opt.maxSpread) return null;
  const entry = dir > 0 ? m.o[i] + sp0 : m.o[i];
  const risk = dir * (entry - trade.stop);
  if (!(risk > 0)) return null;
  const tp = trade.tp;
  let stop = trade.stop, armed = false, best = entry;
  const end = trade.exitAt ?? Infinity;

  for (let j = i; j < m.n; j++) {
    if (m.t[j] >= end) return close(j, dir > 0 ? m.o[j] : m.o[j] + m.sp[j], 'TIME');
    // Prices the position is exposed to this minute
    const sp = m.sp[j];
    const adverse = dir > 0 ? m.l[j] : m.h[j] + sp;    // what can hit the stop
    const favour = dir > 0 ? m.h[j] : m.l[j] + sp;     // what can hit the target
    const open = dir > 0 ? m.o[j] : m.o[j] + sp;

    if (dir > 0 ? adverse <= stop : adverse >= stop) {
      const gapped = j > i && (dir > 0 ? open < stop : open > stop);
      return close(j, gapped ? open : stop - dir * opt.slip, armed ? 'BE' : 'SL');
    }
    if (tp != null && (dir > 0 ? favour >= tp : favour <= tp)) return close(j, tp, 'TP');

    // Management updates take effect from the NEXT minute — no peeking inside the bar
    if (dir > 0 ? favour > best : favour < best) best = favour;
    if (trade.beAt != null && !armed && dir * (best - entry) >= trade.beAt * risk) {
      armed = true;
      stop = entry + dir * 0.1 * risk; // lock a sliver so the scratch covers the spread
    }
    if (armed && trade.trailR != null) {
      const trail = best - dir * trade.trailR * risk;
      if (dir > 0 ? trail > stop : trail < stop) stop = trail;
    }
  }
  return null; // ran off the end of the data — unresolved

  function close(j, price, outcome) {
    return { R: dir * (price - entry) / risk, outcome, exitIdx: j, entry, exit: price, risk, entryT: m.t[i], exitT: m.t[j] };
  }
}
