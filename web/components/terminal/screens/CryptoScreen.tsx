'use client';

import { useState } from 'react';
import styles from '../terminal.module.css';
import { useMarketData } from '@/lib/terminal/MarketDataProvider';
import { biasFor } from '@/lib/terminal/bias';
import { num, sign, cls, arrow } from '@/lib/terminal/format';
import { SourceBadge } from '../SourceBadge';
import { useLanguage } from '@/lib/i18n/LanguageContext';

const CRY_LIST = ['BTCUSD', 'ETHUSD', 'SOLUSD', 'XRPUSD'];

/* Ported from #s-crypto + renderCrypto(). Price/24h range/volume are
   live from Binance; macro drivers are computed from that live state
   (or its modelled fallback) and clearly labelled either way. */
export function CryptoScreen() {
  const S = useMarketData();
  const { t } = useLanguage();
  const [crySel, setCrySel] = useState('BTCUSD');
  const q = S.crypto[crySel];

  return (
    <div>
      <div className={styles.chips} style={{ marginBottom: 14, display: 'flex', alignItems: 'center' }} id="cryTabs">
        {CRY_LIST.map((k) => (
          <button key={k} type="button" className={`${styles.chip} ${k === crySel ? styles.on : ''}`} onClick={() => setCrySel(k)}>{k}</button>
        ))}
        <SourceBadge mode={S.srcs.crypto} label={S.srcs.crypto === 'live' ? 'Binance Live' : undefined} />
      </div>

      <div id="cryDetail">
        {!q ? (
          <div className={styles.card}><div className={styles.empty}>{t.terminal.crypto.loading}</div></div>
        ) : (
          <CryptoDetail S={S} sym={crySel} q={q} />
        )}
      </div>
    </div>
  );
}

function CryptoDetail({ S, sym, q }: { S: ReturnType<typeof useMarketData>; sym: string; q: { price: number; chg: number; high: number; low: number; vol: number } }) {
  const { t } = useLanguage();
  const b = biasFor(S, sym);
  if (!b) return null;
  const col = b.dir === 'Bullish' ? 'var(--green)' : b.dir === 'Bearish' ? 'var(--bear)' : 'var(--amber)';
  const rangePos = ((q.price - q.low) / ((q.high - q.low) || 1)) * 100;

  const dxy = S.quotes.DXY?.chg ?? 0;
  const nq = S.quotes.NQUSD?.chg ?? 0;
  const cot = S.cot.BTCUSD?.[0];
  const cotNet = cot ? cot.specLong - cot.specShort : null;
  const cd = t.terminal.crypto.drivers;
  const nqSign = sign(nq);
  const chgSign = sign(q.chg);
  const aligned = Math.sign(nq) === Math.sign(q.chg);

  const drivers = [
    { n: cd.fedPolicy.name, v: S.risk > 55 ? cd.fedPolicy.supportive : cd.fedPolicy.headwind, s: S.risk > 55 ? 1 : -1,
      why: cd.fedPolicy.why },
    { n: cd.riskAppetite.name, v: S.risk > 62 ? cd.riskAppetite.riskOn : S.risk < 38 ? cd.riskAppetite.riskOff : cd.riskAppetite.balanced, s: S.risk > 62 ? 1 : S.risk < 38 ? -1 : 0,
      why: cd.riskAppetite.why(Math.round(S.risk)) },
    { n: cd.dollar.name, v: dxy > 0 ? cd.dollar.headwind : cd.dollar.tailwind, s: dxy > 0 ? -1 : 1,
      why: cd.dollar.why(sign(dxy)) },
    { n: cd.equityCorrelation.name, v: aligned ? cd.equityCorrelation.together : cd.equityCorrelation.diverging, s: aligned ? 1 : 0,
      why: aligned ? cd.equityCorrelation.whyAligned(nqSign, sym, chgSign) : cd.equityCorrelation.whyDiverging(nqSign, sym, chgSign) },
    { n: cd.futuresPositioning.name, v: cotNet == null ? cd.futuresPositioning.noCftc : cotNet > 0 ? cd.futuresPositioning.fundsLong : cd.futuresPositioning.fundsShort, s: cotNet == null ? 0 : cotNet > 0 ? 1 : -1,
      why: cotNet == null ? cd.futuresPositioning.whyNoData : cd.futuresPositioning.why(cotNet > 0 ? cd.futuresPositioning.long : cd.futuresPositioning.short, Math.abs(Math.round(cotNet)).toLocaleString()) },
  ];
  const score = drivers.reduce((a, d) => a + d.s, 0);

  return (
    <>
      <div className={`${styles.grid} ${styles.g2}`} style={{ marginBottom: 14 }}>
        <div className={styles.card}>
          <div className={styles['card-head']}><span className={styles['card-title']}>{t.terminal.crypto.directionalCall(sym)}</span></div>
          <div className={styles['card-body']}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
              <div>
                <div className={styles['bh-dir']} style={{ color: col, fontSize: '2.5rem' }}>{t.common.direction[b.dir]}</div>
                <div className={styles['bh-conf']} style={{ marginTop: 12 }}>
                  <span style={{ fontSize: '.68rem', color: 'var(--muted)' }}>{t.terminal.crypto.confidence}</span>
                  <span className={styles['conf-track']}><span className={styles['conf-fill']} style={{ width: b.conf + '%', background: col }} /></span>
                  <span className={styles.mono} style={{ fontSize: '.76rem', fontWeight: 700, color: col }}>{Math.round(b.conf)}%</span>
                </div>
              </div>
              <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                <div className={styles.mono} style={{ fontSize: '1.6rem', fontWeight: 600 }}>${num(q.price, q.price > 1000 ? 2 : 4)}</div>
                <div className={`${styles.mono} ${styles[cls(q.chg)]}`} style={{ fontSize: '.82rem', fontWeight: 600 }}>{arrow(q.chg)} {sign(q.chg)}%</div>
              </div>
            </div>
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
              <div style={{ fontSize: '.6rem', fontWeight: 800, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 7 }}>{t.terminal.crypto.rangePosition}</div>
              <div style={{ position: 'relative', height: 8, borderRadius: 4, background: 'linear-gradient(90deg,rgba(255,84,112,.35),rgba(0,208,132,.35))' }}>
                <div style={{ position: 'absolute', top: -4, left: rangePos + '%', width: 3, height: 16, background: '#fff', borderRadius: 2, boxShadow: '0 0 8px rgba(255,255,255,.8)' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontFamily: 'var(--mono)', fontSize: '.66rem', color: 'var(--dim)' }}>
                <span>${num(q.low, q.low > 1000 ? 0 : 2)}</span>
                <span style={{ color: 'var(--text)' }}>{t.terminal.crypto.ofRange(num(rangePos, 0))}</span>
                <span>${num(q.high, q.high > 1000 ? 0 : 2)}</span>
              </div>
            </div>
          </div>
        </div>
        <div className={styles.card}>
          <div className={styles['card-head']}>
            <span className={styles['card-title']}>{t.terminal.crypto.marketMetrics}</span>
            <SourceBadge mode={S.srcs.crypto} />
          </div>
          <div className={styles['card-body']}>
            <div className={styles['oc-grid']}>
              <div className={styles.oc}>
                <div className={styles['oc-l']}>{t.terminal.crypto.volume24h}</div>
                <div className={styles['oc-v']}>${(q.vol / 1e9).toFixed(2)}B</div>
                <div className={styles['oc-note']}>{t.terminal.crypto.volumeNote}</div>
              </div>
              <div className={styles.oc}>
                <div className={styles['oc-l']}>{t.terminal.crypto.range24h}</div>
                <div className={styles['oc-v']}>{num(((q.high - q.low) / q.low) * 100)}%</div>
                <div className={styles['oc-note']}>{((q.high - q.low) / q.low) * 100 > 4 ? t.terminal.crypto.elevatedVolatility : t.terminal.crypto.contained}</div>
              </div>
              <div className={styles.oc}>
                <div className={styles['oc-l']}>{t.terminal.crypto.riskGauge}</div>
                <div className={styles['oc-v']} style={{ color: S.risk > 55 ? 'var(--green)' : 'var(--bear)' }}>{Math.round(S.risk)}</div>
                <div className={styles['oc-note']}>{t.terminal.crypto.crossAssetAppetite}</div>
              </div>
              <div className={styles.oc}>
                <div className={styles['oc-l']}>{t.terminal.crypto.driverScore}</div>
                <div className={styles['oc-v']} style={{ color: score > 0 ? 'var(--green)' : score < 0 ? 'var(--bear)' : 'var(--amber)' }}>{score > 0 ? '+' : ''}{score}/5</div>
                <div className={styles['oc-note']}>{t.terminal.crypto.netMacroSupport}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className={styles.card}>
        <div className={styles['card-head']}>
          <span className={styles['card-title']}>{t.terminal.crypto.macroDrivers}</span>
          <span className={styles['card-note']}>{t.terminal.crypto.macroDriversNote}</span>
        </div>
        <div className={styles['card-body']}>
          {drivers.map((d) => {
            const c = d.s > 0 ? 'var(--green)' : d.s < 0 ? 'var(--bear)' : 'var(--amber)';
            return (
              <div style={{ padding: '13px 0', borderBottom: '1px solid var(--line)' }} key={d.n}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <span className={styles['driver-dot']} style={{ background: c, width: 7, height: 7 }} />
                  <span style={{ fontSize: '.79rem', fontWeight: 700 }}>{d.n}</span>
                  <span style={{ marginLeft: 'auto', fontSize: '.73rem', fontWeight: 600, color: c }}>{d.v}</span>
                </div>
                <div style={{ fontSize: '.73rem', color: 'var(--muted)', lineHeight: 1.6, paddingLeft: 17 }}>{d.why}</div>
              </div>
            );
          })}
          <div style={{ fontSize: '.72rem', color: 'var(--muted)', lineHeight: 1.6, marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
            <b style={{ color: 'var(--text)' }}>{t.terminal.crypto.netRead}</b>{' '}
            {score >= 2
              ? t.terminal.crypto.netReadAligned
              : score <= -2
              ? t.terminal.crypto.netReadAgainst
              : t.terminal.crypto.netReadMixed}
          </div>
        </div>
      </div>
    </>
  );
}
