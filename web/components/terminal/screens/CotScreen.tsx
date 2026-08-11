'use client';

import { useState } from 'react';
import styles from '../terminal.module.css';
import { useMarketData } from '@/lib/terminal/MarketDataProvider';
import { SparkLine } from '../SparkLine';
import { SourceBadge } from '../SourceBadge';
import { useLanguage } from '@/lib/i18n/LanguageContext';

/* Ported from #s-cot + renderCot(). cotSel is local state; falls back to
   the first available key once COT data has loaded, same as the
   original's `if(!keys.includes(cotSel)) cotSel=keys[0]`. */
export function CotScreen() {
  const S = useMarketData();
  const { t } = useLanguage();
  const [cotSel, setCotSel] = useState('EURUSD');
  const keys = Object.keys(S.cot);

  if (!keys.length) {
    return (
      <div className={styles.card}>
        <div className={styles.empty}>{t.terminal.cot.loading}</div>
      </div>
    );
  }
  const sel = keys.includes(cotSel) ? cotSel : keys[0];
  const rows = S.cot[sel];
  const c = rows[0];
  const specNet = c.specLong - c.specShort;
  const prevNet = rows[1] ? rows[1].specLong - rows[1].specShort : specNet;
  const chg = specNet - prevNet;
  const sTot = c.specLong + c.specShort || 1;
  const longPct = (c.specLong / sTot) * 100;
  const nets = rows.map((r) => r.specLong - r.specShort).reverse();
  const cTot = c.commLong + c.commShort || 1;
  const commLongPct = (c.commLong / cTot) * 100;

  return (
    <div>
      <div className={styles.chips} style={{ marginBottom: 14, display: 'flex', alignItems: 'center' }}>
        {keys.map((k) => (
          <button key={k} type="button" className={`${styles.chip} ${k === sel ? styles.on : ''}`} onClick={() => setCotSel(k)}>{k}</button>
        ))}
        <SourceBadge mode={S.srcs.cot} label={S.srcs.cot === 'live' ? 'CFTC Live' : undefined} className={styles.mono} />
      </div>

      <div className={`${styles.grid} ${styles.g2}`} style={{ marginBottom: 14 }}>
        <div className={styles.card}>
          <div className={styles['card-head']}>
            <span className={styles['card-title']}>{t.terminal.cot.largeSpecNetPosition}</span>
            <span className={styles['card-note']}>{c.date}</span>
          </div>
          <div className={styles['card-body']}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 6 }}>
              <span className={styles.mono} style={{ fontSize: '2rem', fontWeight: 700, color: specNet >= 0 ? 'var(--green)' : 'var(--bear)' }}>
                {specNet >= 0 ? '+' : ''}{Math.round(specNet).toLocaleString()}
              </span>
              <span className={`${styles.mono} ${styles[chg >= 0 ? 'up' : 'down']}`} style={{ fontSize: '.82rem', fontWeight: 600 }}>
                {chg >= 0 ? '+' : ''}{Math.round(chg).toLocaleString()} {t.terminal.cot.wow}
              </span>
            </div>
            <div style={{ fontSize: '.7rem', color: 'var(--muted)', marginBottom: 12 }}>
              {specNet >= 0 ? t.terminal.cot.fundsNetLong() : t.terminal.cot.fundsNetShort()}
            </div>
            <SparkLine vals={nets} color={specNet >= 0 ? '#00D084' : '#FF5470'} w={600} h={90} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.6rem', color: 'var(--dim)', marginTop: 4 }}>
              <span>{rows[rows.length - 1].date}</span><span>{c.date}</span>
            </div>
          </div>
        </div>
        <div className={styles.card}>
          <div className={styles['card-head']}>
            <span className={styles['card-title']}>{t.terminal.cot.longShortSplit}</span>
            <span className={styles['card-note']}>{t.terminal.cot.openInterest(c.oi.toLocaleString())}</span>
          </div>
          <div className={styles['card-body']}>
            <div style={{ fontSize: '.6rem', fontWeight: 800, letterSpacing: '.09em', color: 'var(--dim)', textTransform: 'uppercase', marginBottom: 5 }}>{t.terminal.cot.largeSpecsLabel}</div>
            <div className={styles['cot-split']}>
              <div className={styles['cot-long']} style={{ width: longPct + '%' }}>{t.terminal.cot.longPct(longPct.toFixed(0))}</div>
              <div className={styles['cot-short']} style={{ width: 100 - longPct + '%' }}>{t.terminal.cot.shortPct((100 - longPct).toFixed(0))}</div>
            </div>
            <div style={{ fontSize: '.6rem', fontWeight: 800, letterSpacing: '.09em', color: 'var(--dim)', textTransform: 'uppercase', margin: '14px 0 5px' }}>{t.terminal.cot.commercialsLabel}</div>
            <div className={styles['cot-split']}>
              <div className={styles['cot-long']} style={{ width: commLongPct + '%' }}>{t.terminal.cot.longPct(commLongPct.toFixed(0))}</div>
              <div className={styles['cot-short']} style={{ width: 100 - commLongPct + '%' }}>{t.terminal.cot.shortPct((100 - commLongPct).toFixed(0))}</div>
            </div>
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--line)', fontSize: '.7rem', color: 'var(--muted)', lineHeight: 1.6 }}>
              {longPct > 72
                ? t.terminal.cot.crowdedLong
                : longPct < 28
                ? t.terminal.cot.crowdedShort
                : t.terminal.cot.normalRange}
            </div>
          </div>
        </div>
      </div>
      <div className={styles.card}>
        <div className={styles['card-head']}>
          <span className={styles['card-title']}>{t.terminal.cot.weeklyHistory}</span>
          <span className={styles['card-note']}>{t.terminal.cot.sourceNote}</span>
        </div>
        <div className={styles['card-body']} style={{ padding: '0 6px 6px', overflowX: 'auto' }}>
          <table className={styles['cot-table']}>
            <thead>
              <tr>
                <th>{t.terminal.cot.table.reportDate}</th><th>{t.terminal.cot.table.specLong}</th><th>{t.terminal.cot.table.specShort}</th><th>{t.terminal.cot.table.specNet}</th>
                <th>{t.terminal.cot.table.commLong}</th><th>{t.terminal.cot.table.commShort}</th><th>{t.terminal.cot.table.openInterest}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const n = r.specLong - r.specShort;
                return (
                  <tr key={i}>
                    <td>{r.date}</td>
                    <td>{r.specLong.toLocaleString()}</td>
                    <td>{r.specShort.toLocaleString()}</td>
                    <td className={styles[n >= 0 ? 'up' : 'down']}>{n >= 0 ? '+' : ''}{n.toLocaleString()}</td>
                    <td>{r.commLong.toLocaleString()}</td>
                    <td>{r.commShort.toLocaleString()}</td>
                    <td>{r.oi.toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
