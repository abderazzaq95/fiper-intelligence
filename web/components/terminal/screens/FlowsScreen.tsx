'use client';

import styles from '../terminal.module.css';
import { useMarketData } from '@/lib/terminal/MarketDataProvider';
import { sign, cls } from '@/lib/terminal/format';
import { SourceBadge } from '../SourceBadge';
import { useLanguage } from '@/lib/i18n/LanguageContext';

const REF: Record<string, number> = { EUR: 0.918, GBP: 0.784, JPY: 151.2, CHF: 0.882, AUD: 1.512, CAD: 1.362, NZD: 1.648 };

/* Ported from #s-flows + renderFlows(). Three sub-widgets: currency
   strength (derived from live USD cross rates vs a reference basket),
   asset class flows, and institutional-vs-retail positioning divergence
   from COT. */
export function FlowsScreen() {
  const S = useMarketData();
  const { t } = useLanguage();

  const rows: { ccy: string; v: number }[] = [];
  let usdScore = 0;
  for (const [c, ref] of Object.entries(REF)) {
    const r = S.fx.rates?.[c];
    if (!r) continue;
    const dev = ((r - ref) / ref) * 100; // USD stronger => more foreign per USD
    usdScore += dev;
    rows.push({ ccy: c, v: -dev * 8 }); // invert: foreign currency strength
  }
  rows.push({ ccy: 'USD', v: usdScore * 1.4 });
  rows.sort((a, b) => b.v - a.v);
  const mx = Math.max(...rows.map((r) => Math.abs(r.v)), 1);

  const classes = [
    { n: 'US Equities', v: (S.quotes.NQUSD?.chg ?? 0) + (S.quotes.ESUSD?.chg ?? 0) },
    { n: 'EU Equities', v: (S.quotes.DAX?.chg ?? 0) * 1.4 },
    { n: 'Precious Metals', v: (S.quotes.XAUUSD?.chg ?? 0) + (S.quotes.XAGUSD?.chg ?? 0) },
    { n: 'Energy', v: (S.quotes.USOIL?.chg ?? 0) * 1.6 },
    { n: 'Crypto', v: ((S.crypto.BTCUSD?.chg ?? 0) + (S.crypto.ETHUSD?.chg ?? 0)) / 2 },
    { n: 'Dollar', v: (S.quotes.DXY?.chg ?? 0) * 2.2 },
  ].sort((a, b) => b.v - a.v);
  const cm = Math.max(...classes.map((c) => Math.abs(c.v)), 1);

  const dv = Object.entries(S.cot)
    .map(([k, cotRows]) => {
      const r = cotRows[0];
      if (!r) return null;
      const specNet = r.specLong - r.specShort;
      const commNet = r.commLong - r.commShort;
      const tot = Math.abs(specNet) + Math.abs(commNet) || 1;
      return { k, spec: (specNet / tot) * 100, comm: (commNet / tot) * 100 };
    })
    .filter((x): x is { k: string; spec: number; comm: number } => x != null);

  return (
    <div>
      <div className={`${styles.grid} ${styles.g2}`} style={{ marginBottom: 14 }}>
        <div className={styles.card}>
          <div className={styles['card-head']}>
            <span className={styles['card-title']}>{t.terminal.flows.currencyStrength}</span>
            <SourceBadge mode={S.srcs.fx} label={S.srcs.fx === 'live' ? 'ECB Live' : undefined} />
          </div>
          <div className={styles['card-body']}>
            {rows.map((r) => {
              const w = (Math.abs(r.v) / mx) * 48;
              return (
                <div className={styles['cs-row']} key={r.ccy}>
                  <span className={styles['cs-ccy']}>{r.ccy}</span>
                  <span className={styles['cs-bar-wrap']}>
                    <span className={styles['cs-mid']} />
                    <span
                      className={styles['cs-bar']}
                      style={
                        r.v >= 0
                          ? { left: '50%', width: w + '%', background: 'linear-gradient(90deg,#00A868,#00D084)' }
                          : { right: '50%', width: w + '%', background: 'linear-gradient(90deg,#C42626,#FF5470)' }
                      }
                    />
                  </span>
                  <span className={`${styles['cs-val']} ${styles[cls(r.v)]}`}>{sign(r.v)}</span>
                </div>
              );
            })}
            <div style={{ fontSize: '.63rem', color: 'var(--dim)', marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--line)' }}>
              {t.terminal.flows.deviationNote(S.fx.date || '—')}
            </div>
          </div>
        </div>
        <div className={styles.card}>
          <div className={styles['card-head']}>
            <span className={styles['card-title']}>{t.terminal.flows.assetClassFlows}</span>
            <span className={styles['card-note']}>{t.terminal.flows.net5d}</span>
          </div>
          <div className={styles['card-body']}>
            {classes.map((c) => (
              <div className={styles['flow-row']} key={c.n}>
                <span className={styles['flow-name']}>{t.terminal.flows.classes[c.n as keyof typeof t.terminal.flows.classes]}</span>
                <span className={styles['flow-bar-wrap']}>
                  <span
                    className={styles['flow-bar']}
                    style={{ width: (Math.abs(c.v) / cm) * 100 + '%', background: c.v >= 0 ? 'linear-gradient(90deg,#00A868,#00D084)' : 'linear-gradient(90deg,#C42626,#FF5470)' }}
                  />
                </span>
                <span className={`${styles['flow-val']} ${styles[cls(c.v)]}`}>{sign(c.v)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className={styles.card}>
        <div className={styles['card-head']}>
          <span className={styles['card-title']}>{t.terminal.flows.positioningDivergence}</span>
          <span className={styles['card-note']}>{t.terminal.flows.institutionalVsRetail}</span>
        </div>
        <div className={styles['card-body']}>
          {dv.length ? (
            <>
              <div className={styles['cot-legend']} style={{ marginBottom: 14 }}>
                <span className={styles.leg}><span className={styles['leg-sw']} style={{ background: '#00D084' }} />{t.terminal.flows.largeSpecs}</span>
                <span className={styles.leg}><span className={styles['leg-sw']} style={{ background: '#5B9BFF' }} />{t.terminal.flows.commercials}</span>
              </div>
              {dv.map((d) => (
                <div className={styles['flow-row']} key={d.k}>
                  <span className={styles['flow-name']}>{d.k}</span>
                  <span className={styles['flow-bar-wrap']} style={{ position: 'relative', height: 16, background: 'transparent' }}>
                    <span
                      style={{
                        position: 'absolute', top: 1, height: 6, borderRadius: 3, background: '#00D084',
                        ...(d.spec >= 0 ? { left: '50%', width: Math.min(50, Math.abs(d.spec) / 2) + '%' } : { right: '50%', width: Math.min(50, Math.abs(d.spec) / 2) + '%' }),
                      }}
                    />
                    <span
                      style={{
                        position: 'absolute', top: 9, height: 6, borderRadius: 3, background: '#5B9BFF',
                        ...(d.comm >= 0 ? { left: '50%', width: Math.min(50, Math.abs(d.comm) / 2) + '%' } : { right: '50%', width: Math.min(50, Math.abs(d.comm) / 2) + '%' }),
                      }}
                    />
                    <span style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: 'var(--line2)' }} />
                  </span>
                  <span className={`${styles['flow-val']} ${styles[cls(d.spec)]}`}>{d.spec > 0 ? t.terminal.flows.netLong : t.terminal.flows.netShort}</span>
                </div>
              ))}
            </>
          ) : (
            <div className={styles.empty}>{t.terminal.flows.loading}</div>
          )}
        </div>
      </div>
    </div>
  );
}
