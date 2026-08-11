'use client';

import { useEffect, useRef, useState } from 'react';
import styles from '../terminal.module.css';
import { BT_ASSETS, BT_EVENTS, runBacktest, type BacktestResult } from '@/lib/terminal/backtest';
import { num, sign, cls } from '@/lib/terminal/format';
import { useLanguage } from '@/lib/i18n/LanguageContext';

const COND_OPTIONS: { v: 'beat' | 'miss' | 'any'; l: string }[] = [
  { v: 'beat', l: 'Beat forecast' },
  { v: 'miss', l: 'Missed forecast' },
  { v: 'any', l: 'Any result' },
];
const WIN_OPTIONS: { v: number; l: string }[] = [
  { v: 30, l: '30 minutes' },
  { v: 240, l: '4 hours' },
  { v: 1440, l: '1 day' },
  { v: 7200, l: '5 days' },
];

/* Ported from #s-backtest + runBacktest()/initBacktest().
   runBacktest() reseeds the shared deterministic PRNG (see rng.ts) —
   it must NOT run before MarketDataProvider's boot() sequence has
   finished consuming its share of that sequence, or every "modelled"
   number generated afterwards (crypto/COT fallbacks, calendar counts)
   would desync from the original. Gated on `active` the same way
   CandlesScreen gates its klines fetch: the original only ever called
   initBacktest() when the user navigated to #backtest, never during
   boot(), so this reproduces that same lazy, on-demand timing. */
export function BacktestScreen({ active }: { active: boolean }) {
  const { t } = useLanguage();
  const [asset, setAsset] = useState(BT_ASSETS[0]);
  const [evId, setEvId] = useState(BT_EVENTS[0].id);
  const [cond, setCond] = useState<'beat' | 'miss' | 'any'>('beat');
  const [win, setWin] = useState(1440);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const initedRef = useRef(false);

  useEffect(() => {
    if (!active || initedRef.current) return;
    initedRef.current = true;
    setResult(runBacktest(asset, evId, cond, win));
    // deliberately only depends on `active` — this is the one-time init, not a live-recompute effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const run = () => setResult(runBacktest(asset, evId, cond, win));

  return (
    <div>
      <div className={styles.card} style={{ marginBottom: 14 }}>
        <div className={styles['card-head']}>
          <span className={styles['card-title']}>{t.terminal.backtest.title}</span>
          <span className={styles['card-note']}>{t.terminal.backtest.subtitle}</span>
        </div>
        <div className={styles['card-body']}>
          <div className={styles['bt-form']}>
            <div className={styles.fld}>
              <label className={styles['fld-l']} htmlFor="btAsset">{t.terminal.backtest.asset}</label>
              <select className={styles.sel} id="btAsset" value={asset} onChange={(e) => setAsset(e.target.value)}>
                {BT_ASSETS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div className={styles.fld}>
              <label className={styles['fld-l']} htmlFor="btEvent">{t.terminal.backtest.event}</label>
              <select className={styles.sel} id="btEvent" value={evId} onChange={(e) => setEvId(e.target.value)}>
                {BT_EVENTS.map((e) => <option key={e.id} value={e.id}>{t.terminal.backtest.events[e.n as keyof typeof t.terminal.backtest.events]}</option>)}
              </select>
            </div>
            <div className={styles.fld}>
              <label className={styles['fld-l']} htmlFor="btCond">{t.terminal.backtest.outcome}</label>
              <select className={styles.sel} id="btCond" value={cond} onChange={(e) => setCond(e.target.value as 'beat' | 'miss' | 'any')}>
                {COND_OPTIONS.map((o) => <option key={o.v} value={o.v}>{t.terminal.backtest.condOptions[o.l as keyof typeof t.terminal.backtest.condOptions]}</option>)}
              </select>
            </div>
            <div className={styles.fld}>
              <label className={styles['fld-l']} htmlFor="btWin">{t.terminal.backtest.measuredOver}</label>
              <select className={styles.sel} id="btWin" value={win} onChange={(e) => setWin(+e.target.value)}>
                {WIN_OPTIONS.map((o) => <option key={o.v} value={o.v}>{t.terminal.backtest.winOptions[o.l as keyof typeof t.terminal.backtest.winOptions]}</option>)}
              </select>
            </div>
          </div>
          <button className={styles.btn} id="btRun" style={{ marginTop: 14 }} type="button" onClick={run}>{t.terminal.backtest.runBacktest}</button>
        </div>
      </div>

      <div id="btResults">
        {result && (
          <>
            <div className={styles.card} style={{ marginBottom: 14 }}>
              <div className={styles['card-head']}>
                <span className={styles['card-title']}>{t.terminal.backtest.result}</span>
                <span className={styles['card-note']}>
                  {t.terminal.backtest.resultLine(
                    result.asset,
                    t.terminal.backtest.events[result.ev.n as keyof typeof t.terminal.backtest.events],
                    result.cond === 'any' ? t.terminal.backtest.filterAll : result.cond === 'beat' ? t.terminal.backtest.filterBeats : t.terminal.backtest.filterMisses,
                    result.lookback
                  )}
                </span>
              </div>
              <div className={styles['card-body']}>
                <div className={styles['stat-row']}>
                  <div className={styles.stat}>
                    <div className={styles['stat-l']}>{t.terminal.backtest.instances}</div>
                    <div className={styles['stat-v']} style={{ color: result.reliable ? 'var(--text)' : 'var(--amber)' }}>{result.n}</div>
                  </div>
                  <div className={styles.stat}>
                    <div className={styles['stat-l']}>{t.terminal.backtest.avgMove}</div>
                    <div className={`${styles['stat-v']} ${styles[cls(result.avg)]}`}>{sign(result.avg)}%</div>
                  </div>
                  <div className={styles.stat}>
                    <div className={styles['stat-l']}>{t.terminal.backtest.hitRate}</div>
                    <div className={styles['stat-v']}>{num(result.winRate, 0)}%</div>
                  </div>
                  <div className={styles.stat}>
                    <div className={styles['stat-l']}>{t.terminal.backtest.stdDev}</div>
                    <div className={styles['stat-v']} style={{ color: 'var(--muted)' }}>{num(result.sd)}%</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 20, marginTop: 14, fontSize: '.73rem', color: 'var(--muted)', flexWrap: 'wrap' }}>
                  <span>{t.terminal.backtest.best} <b className={`${styles.mono} ${styles.up}`}>{sign(result.best)}%</b></span>
                  <span>{t.terminal.backtest.worst} <b className={`${styles.mono} ${styles.down}`}>{sign(result.worst)}%</b></span>
                  <span>{t.terminal.backtest.measuredOverColon} <b style={{ color: 'var(--text)' }}>{result.win < 60 ? result.win + ' ' + t.terminal.backtest.unit.min : result.win < 1440 ? result.win / 60 + ' ' + t.terminal.backtest.unit.hours : result.win / 1440 + ' ' + t.terminal.backtest.unit.days}</b></span>
                </div>
                {!result.reliable ? (
                  <div className={styles.warn}>
                    <span>⚠</span>
                    <span>
                      {t.terminal.backtest.reliabilityWarning(result.n, result.n === 1 ? '' : 's')}
                    </span>
                  </div>
                ) : (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line)', fontSize: '.74rem', color: 'var(--muted)', lineHeight: 1.6 }}>
                    {t.terminal.backtest.reliableSummary(result.n, result.asset, sign(result.avg), num(result.winRate, 0))}{' '}
                    {result.winRate > 65
                      ? t.terminal.backtest.consistentReaction
                      : result.winRate > 52
                      ? t.terminal.backtest.mildEdge
                      : t.terminal.backtest.noEdge}
                  </div>
                )}
              </div>
            </div>
            <div className={styles.card}>
              <div className={styles['card-head']}>
                <span className={styles['card-title']}>{t.terminal.backtest.everyInstance}</span>
                <span className={`${styles.src} ${styles.demo}`}>{t.terminal.backtest.model}</span>
              </div>
              <div className={styles['card-body']} style={{ padding: '0 6px 6px', overflowX: 'auto' }}>
                <table className={styles['bt-table']}>
                  <thead>
                    <tr><th>{t.terminal.backtest.table.releaseDate}</th><th>{t.terminal.backtest.table.result}</th><th>{t.terminal.backtest.table.surprise}</th><th style={{ width: 160 }}>{t.terminal.backtest.table.reaction}</th><th>{t.terminal.backtest.table.move}</th></tr>
                  </thead>
                  <tbody>
                    {result.rows.map((r, i) => {
                      const w = (Math.abs(r.move) / result.maxAbs) * 48;
                      return (
                        <tr key={i}>
                          <td>{r.date}</td>
                          <td className={styles[r.beat ? 'up' : 'down']}>{r.beat ? t.terminal.backtest.beat : t.terminal.backtest.miss}</td>
                          <td>{sign(r.surprise)}σ</td>
                          <td>
                            <div className={styles['react-bar']}>
                              <div className={styles['rb-mid']} />
                              <div
                                className={styles['rb-fill']}
                                style={r.move >= 0 ? { left: '50%', width: w + '%', background: '#00D084' } : { right: '50%', width: w + '%', background: '#FF5470' }}
                              />
                            </div>
                          </td>
                          <td className={styles[cls(r.move)]}>{sign(r.move)}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
