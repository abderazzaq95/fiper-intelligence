'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import styles from '../terminal.module.css';
import { useMarketData } from '@/lib/terminal/MarketDataProvider';
import { CNDL_ASSETS, CHART_ASSET_GROUPS, TFS, fetchKlines, seedKlines, detectPattern, type Kline } from '@/lib/terminal/candles';
import { fetchExternalKlines } from '@/lib/terminal/yahooFinance';
import { num } from '@/lib/terminal/format';
import { tvSymbol, tvInterval } from '@/lib/terminal/tradingview';
import { TIMEFRAME_NEWS_HOURS } from '@/lib/terminal/newsTimeline';
import type { SrcMode } from '@/lib/terminal/marketData';
import { SourceBadge } from '../SourceBadge';
import { ChartWidget } from '../ChartWidget';
import { NewsTimeline } from '../NewsTimeline';
import { useLanguage } from '@/lib/i18n/LanguageContext';

/* Ported from #s-candles + loadCandles()/renderCandles()/drawCandles().
   Fetches real Binance klines — same lazy, first-visit-only trigger as
   the original (`if(!cndlData.length) loadCandles()` in route()): the
   fetch effect below only fires once this screen becomes `active` for
   the first time (or the asset/timeframe selection changes), matching
   the original's on-demand behaviour and — importantly — keeping
   seedKlines()'s PRNG usage from firing during the app's initial boot
   sequence if the user never visits this screen. */
export function CandlesScreen({ active }: { active: boolean }) {
  const S = useMarketData();
  const { t, lang } = useLanguage();
  // Widened from keyof typeof CNDL_ASSETS: the chart selector now spans
  // all of CHART_ASSET_GROUPS (crypto + commodities/indices/forex), not
  // just the 4 Binance-backed crypto assets CNDL_ASSETS covers.
  const [cndlSel, setCndlSel] = useState<string>('BTCUSD');
  const [cndlTF, setCndlTF] = useState('1h');
  const [cndlData, setCndlData] = useState<Kline[]>([]);
  const [mtfData, setMtfData] = useState<Record<string, Kline[]>>({});
  const [srcMode, setSrcMode] = useState<SrcMode>('wait');
  const lastLoadedKey = useRef<string | null>(null);

  // Crypto assets are keys of CNDL_ASSETS and fetch from Binance
  // (backend-proxied); everything else fetches from Yahoo Finance (also
  // backend-proxied — see yahooFinance.ts for why that's required, not
  // optional, for Yahoo specifically). Both paths return the same
  // Kline[] shape, so patterns/MTF/"why formed" run identically either
  // way — only the fetch function, symbol, and success-badge label
  // differ between them.
  const isCrypto = Object.prototype.hasOwnProperty.call(CNDL_ASSETS, cndlSel);

  useEffect(() => {
    if (!active) return;
    const key = cndlSel + '|' + cndlTF;
    if (lastLoadedKey.current === key) return;
    lastLoadedKey.current = key;

    const fetchOne = isCrypto
      ? (tf: string, limit: number) => fetchKlines(CNDL_ASSETS[cndlSel], tf, limit)
      : (tf: string, limit: number) => fetchExternalKlines(cndlSel, tf, limit);

    let cancelled = false;

    // The main chart-timeframe fetch and all 6 multi-timeframe fetches
    // used to run sequentially (await the main one, *then* start the
    // rest), which doubles the time the Multi-Timeframe Trend panel
    // sits empty for no reason — they don't depend on each other. Firing
    // them all together, and using allSettled instead of all, means a
    // single rejected/timed-out request (see fetchKlines'/
    // fetchExternalKlines' own timeout guards) can't prevent the others
    // from populating — each slot falls back to seedKlines() independently
    // either way.
    Promise.allSettled([fetchOne(cndlTF, 80), ...TFS.map(([tf]) => fetchOne(tf, 50))]).then((results) => {
      if (cancelled) return;
      const [mainResult, ...tfResults] = results;
      const d = mainResult.status === 'fulfilled' ? mainResult.value : null;
      setCndlData(d || seedKlines(80));
      setSrcMode(d ? 'live' : 'demo');

      const next: Record<string, Kline[]> = {};
      TFS.forEach(([tf], i) => {
        const r = tfResults[i];
        const val = r.status === 'fulfilled' ? r.value : null;
        next[tf] = val || seedKlines(50);
      });
      setMtfData(next);
    });

    return () => { cancelled = true; };
  }, [active, cndlSel, cndlTF, isCrypto]);

  const patterns = useMemo(() => {
    const found: { p: NonNullable<ReturnType<typeof detectPattern>>; t: number; c: Kline }[] = [];
    const start = Math.max(1, cndlData.length - 30);
    for (let i = cndlData.length - 1; i >= start; i--) {
      const p = detectPattern(cndlData[i], cndlData[i - 1]);
      if (p) found.push({ p, t: cndlData[i].t, c: cndlData[i] });
      if (found.length >= 6) break;
    }
    return found;
  }, [cndlData]);

  const mtf = useMemo(
    () =>
      TFS.map(([tf, lbl]) => {
        const d = mtfData[tf];
        if (!d || d.length < 20) return null;
        const sma = (n: number) => d.slice(-n).reduce((a, b) => a + b.c, 0) / n;
        const fast = sma(10);
        const slow = sma(20);
        const diff = ((fast - slow) / slow) * 100;
        const dir = diff > 0.12 ? 'Uptrend' : diff < -0.12 ? 'Downtrend' : 'Ranging';
        const color = diff > 0.12 ? '#00D084' : diff < -0.12 ? '#FF5470' : '#F0A500';
        return { tf, lbl, dir, color, diff };
      }),
    [mtfData]
  );

  const why = useMemo(() => {
    if (cndlData.length < 2) return null;
    const last = cndlData[cndlData.length - 1];
    const chg = ((last.c - last.o) / last.o) * 100;
    const rng = ((last.h - last.l) / last.o) * 100;
    const avgV = cndlData.slice(-20).reduce((a, b) => a + b.v, 0) / 20;
    const volRatio = last.v / avgV;
    const hiNews = S.news.filter((n) => n.imp === 'HIGH').slice(0, 2);
    return { chg, rng, volRatio, hiNews };
  }, [cndlData, S.news]);

  return (
    <div className={styles['wide-screen']}>
      <div className={styles.card} style={{ marginBottom: 14 }}>
        <div className={styles['card-head']}>
          <span className={styles['card-title']}>{t.terminal.candles.candleAnalysis}</span>
          <SourceBadge
            mode={srcMode}
            label={srcMode === 'live' ? (isCrypto ? 'Binance Live' : 'Yahoo') : 'Model'}
            className={styles.mono}
          />
        </div>
        <div className={`${styles['cndl-tools']} ${styles['card-body']}`}>
          <div className={styles['cndl-asset-groups']}>
            {CHART_ASSET_GROUPS.map((g, gi) => (
              <div className={styles['cndl-group']} key={g.key}>
                {gi > 0 && <span className={styles['cndl-group-sep']} aria-hidden="true" />}
                <span className={styles['cndl-group-label']}>{t.terminal.candles.assetGroups[g.key]}</span>
                <div className={styles.chips}>
                  {g.assets.map((a) => (
                    <button key={a} type="button" className={`${styles.chip} ${a === cndlSel ? styles.on : ''}`} onClick={() => setCndlSel(a)}>
                      {a}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginInlineStart: 'auto', display: 'flex', gap: 6 }}>
            {TFS.map(([v, l]) => (
              <button key={v} type="button" className={`${styles['tf-btn']} ${v === cndlTF ? styles.on : ''}`} onClick={() => setCndlTF(v)}>
                {l}
              </button>
            ))}
          </div>
        </div>
        {/* Full-bleed — no card-body padding — so the chart is the hero
            element, not a small box inside it. Fills the rest of the
            viewport below the top bar/ticker/tools row, with a 520px
            floor for short viewports. */}
        <div className={styles['cndl-wrap']}>
          <ChartWidget symbol={tvSymbol(cndlSel)} interval={tvInterval(cndlTF)} locale={lang} height="max(520px, calc(100vh - 280px))" />
        </div>
        {/* "News on Chart" (Phase 1) — the bottom-most element of this
            card now, so it (not .cndl-wrap) carries the bottom corner
            radius. Hours-of-history syncs to the selected chart
            timeframe, not re-fetched per timeframe — see
            newsTimeline.ts. */}
        <NewsTimeline hoursWindow={TIMEFRAME_NEWS_HOURS[cndlTF] ?? 24} />
      </div>

      <div className={`${styles.grid} ${styles.g3}`}>
        <div className={styles.card}>
          <div className={styles['card-head']}>
            <span className={styles['card-title']}>{t.terminal.candles.patternsDetected}</span>
            <span className={styles['card-note']}>{t.terminal.candles.last30}</span>
          </div>
          <div className={styles['card-body']}>
            {patterns.length ? (
              patterns.map(({ p, t: ts, c: k }, i) => {
                const col = p.bias === 'bull' ? '#00D084' : p.bias === 'bear' ? '#FF5470' : '#F0A500';
                const rng = k.h - k.l || 1;
                const bt = ((k.h - Math.max(k.o, k.c)) / rng) * 40;
                const bh = Math.max(2, (Math.abs(k.c - k.o) / rng) * 40);
                return (
                  <div className={styles.pat} key={i}>
                    <div className={styles['pat-ico']}>
                      <svg width={14} height={44} viewBox="0 0 14 44">
                        <line x1={7} y1={2} x2={7} y2={42} stroke={col} strokeWidth={1.4} />
                        <rect x={2} y={2 + bt} width={10} height={bh} fill={col} />
                      </svg>
                    </div>
                    <div>
                      <div className={styles['pat-name']} style={{ color: col }}>{t.common.pattern[p.n as keyof typeof t.common.pattern]}</div>
                      <div className={styles['pat-desc']}>{t.common.patternDesc[p.d as keyof typeof t.common.patternDesc]}</div>
                      <div className={styles['pat-meta']}>
                        <span className={`${styles.pill} ${styles[p.bias]}`}>{p.bias === 'bull' ? t.common.direction.Bullish : p.bias === 'bear' ? t.common.direction.Bearish : t.common.direction.Neutral}</span>
                        <span className={`${styles.pill} ${styles.neutral}`}>{t.common.strength[p.str as keyof typeof t.common.strength]}</span>
                        <span className={`${styles.pill} ${styles.neutral} ${styles.mono}`}>{new Date(ts).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className={styles.empty}>{t.terminal.candles.noPatterns}</div>
            )}
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles['card-head']}><span className={styles['card-title']}>{t.terminal.candles.multiTimeframeTrend}</span></div>
          <div className={styles['card-body']}>
            <div className={styles.mtf}>
              {mtf.map((m, i) =>
                m ? (
                  <div className={styles['mtf-cell']} key={m.tf}>
                    <div className={styles['mtf-tf']}>{m.lbl}</div>
                    <div className={styles['mtf-dir']} style={{ color: m.color }}>{t.terminal.candles.trend[m.dir as keyof typeof t.terminal.candles.trend]}</div>
                    <div className={styles['mtf-bar']}><div className={styles['mtf-fill']} style={{ width: Math.min(100, Math.abs(m.diff) * 22 + 18) + '%', background: m.color }} /></div>
                    <div style={{ fontSize: '.6rem', color: 'var(--dim)', marginTop: 5 }}>{t.terminal.candles.maSpread((m.diff >= 0 ? '+' : '') + num(m.diff))}</div>
                  </div>
                ) : (
                  <div key={i} />
                )
              )}
            </div>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles['card-head']}><span className={styles['card-title']}>{t.terminal.candles.whyFormed}</span></div>
          <div className={styles['card-body']}>
            {why && (
              <>
                <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', marginBottom: 12 }}>
                  <span className={`${styles.pill} ${styles[why.chg >= 0 ? 'bull' : 'bear']}`}>{why.chg >= 0 ? t.terminal.candles.up : t.terminal.candles.down} {num(Math.abs(why.chg))}%</span>
                  <span className={`${styles.pill} ${styles.neutral}`}>{t.terminal.candles.rangePct(num(why.rng))}</span>
                  <span className={`${styles.pill} ${styles[why.volRatio > 1.4 ? 'high' : 'neutral']}`}>{t.terminal.candles.volumeX(num(why.volRatio, 1))}</span>
                </div>
                <div className={styles.reasons}>
                  <div className={styles.reason}>
                    <span className={styles['reason-ico']} style={{ color: why.chg >= 0 ? '#00D084' : '#FF5470' }}>{why.chg >= 0 ? '▲' : '▼'}</span>
                    <span>
                      {t.terminal.candles.closedSentence(cndlTF, (why.chg >= 0 ? t.terminal.candles.up : t.terminal.candles.down).toLowerCase(), num(Math.abs(why.chg)), num(why.rng))}{' '}
                      {why.rng > 2 ? t.terminal.candles.wideRange : t.terminal.candles.containedRange}
                    </span>
                  </div>
                  <div className={styles.reason}>
                    <span className={styles['reason-ico']} style={{ color: '#5B9BFF' }}>≋</span>
                    <span>
                      {t.terminal.candles.volumeSentence(num(why.volRatio, 1))}{' '}
                      {why.volRatio > 1.4 ? t.terminal.candles.volumeConfirms : t.terminal.candles.volumeUnremarkable}
                    </span>
                  </div>
                  <div className={styles.reason}>
                    <span className={styles['reason-ico']} style={{ color: S.risk > 55 ? '#00D084' : '#FF5470' }}>◉</span>
                    <span>
                      {t.terminal.candles.riskSentence(Math.round(S.risk), S.risk > 55 ? t.terminal.candles.movingWith : t.terminal.candles.fighting)}
                    </span>
                  </div>
                  {why.hiNews.length > 0 && (
                    <div className={styles.reason}>
                      <span className={styles['reason-ico']} style={{ color: 'var(--red-hi)' }}>◈</span>
                      <span>
                        {t.terminal.candles.concurrentNews(why.hiNews[0].h.slice(0, 72))}
                      </span>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
