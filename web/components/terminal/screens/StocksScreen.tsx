'use client';

import { useState } from 'react';
import styles from '../terminal.module.css';
import { num, sign, cls, arrow } from '@/lib/terminal/format';
import { useLanguage } from '@/lib/i18n/LanguageContext';

interface StockData {
  n: string; sec: string; px: number; chg: number; mcap: string; pe: number; eps: number; div: number;
  rev: string; growth: number; beta: number;
  sens: Record<string, number>;
}

/* Ported from #s-stocks + renderStock()/initStocks(). STOCKS is static
   modelled coverage (same "Model" badge as the original), kept here
   rather than in lib/terminal since it's screen-scoped content, exactly
   where it lived in the original script. Numeric/fundamental fields (px,
   chg, mcap, pe, ...) are data, not copy, so they stay here unlocalized.
   The bull-case/bear-case bullets and upcoming-catalyst tuples that used
   to live inline here now come from t.terminal.stocks.stockContent (see
   StockDetail below) — option (a) from the i18n brief: real Arabic
   translations were written for all four tickers rather than leaving
   this content English-only. */
const STOCKS: Record<string, StockData> = {
  NVDA: { n: 'NVIDIA', sec: 'Semiconductors', px: 1042.3, chg: 2.14, mcap: '2.56T', pe: 58.2, eps: 17.9, div: 0.02,
    rev: '130.5B', growth: 94, beta: 1.68,
    sens: { 'Fed rate path': -0.82, 'Dollar strength': -0.31, 'Oil price': -0.08, 'Risk appetite': 0.91, '10Y yield': -0.74 } },
  AAPL: { n: 'Apple', sec: 'Consumer Electronics', px: 243.18, chg: -0.42, mcap: '3.68T', pe: 37.4, eps: 6.51, div: 0.44,
    rev: '416.2B', growth: 8, beta: 1.09,
    sens: { 'Fed rate path': -0.51, 'Dollar strength': -0.62, 'Oil price': -0.05, 'Risk appetite': 0.58, '10Y yield': -0.44 } },
  JPM: { n: 'JPMorgan Chase', sec: 'Banking', px: 298.62, chg: 0.88, mcap: '831B', pe: 13.1, eps: 22.8, div: 2.1,
    rev: '177.4B', growth: 12, beta: 1.12,
    sens: { 'Fed rate path': 0.68, 'Dollar strength': 0.21, 'Oil price': 0.11, 'Risk appetite': 0.74, '10Y yield': 0.79 } },
  XOM: { n: 'Exxon Mobil', sec: 'Energy', px: 118.94, chg: 1.32, mcap: '472B', pe: 14.8, eps: 8.04, div: 3.3,
    rev: '344.6B', growth: -3, beta: 0.86,
    sens: { 'Fed rate path': 0.12, 'Dollar strength': -0.44, 'Oil price': 0.94, 'Risk appetite': 0.32, '10Y yield': 0.18 } },
};

export function StocksScreen() {
  const { t } = useLanguage();
  const [stkSel, setStkSel] = useState('NVDA');
  const [query, setQuery] = useState('');
  const d = STOCKS[stkSel];

  const go = () => {
    const v = query.trim().toUpperCase();
    if (v) setStkSel(v);
  };

  return (
    <div>
      <div className={styles['search-wrap']}>
        <input
          className={styles.search}
          id="stkSearch"
          placeholder={t.terminal.stocks.searchPlaceholder}
          autoComplete="off"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') go(); }}
        />
        <button className={styles.btn} id="stkGo" type="button" onClick={go}>{t.terminal.stocks.search}</button>
      </div>
      <div className={styles.chips} style={{ marginBottom: 14 }} id="stkQuick">
        {Object.keys(STOCKS).map((k) => (
          <button key={k} type="button" className={`${styles.chip} ${k === stkSel ? styles.on : ''}`} onClick={() => setStkSel(k)}>{k}</button>
        ))}
      </div>

      <div id="stkDetail">
        {!d ? (
          <div className={styles.card}>
            <div className={styles.empty}>
              <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>{t.terminal.stocks.noCoverage(stkSel)}</div>
              {t.terminal.stocks.coverageNote}
            </div>
          </div>
        ) : (
          <StockDetail sym={stkSel} d={d} />
        )}
      </div>
    </div>
  );
}

function StockDetail({ sym, d }: { sym: string; d: StockData }) {
  const { t } = useLanguage();
  const sensMax = Math.max(...Object.values(d.sens).map(Math.abs));
  const content = t.terminal.stocks.stockContent[sym as keyof typeof t.terminal.stocks.stockContent];
  const topFactor = Object.entries(d.sens).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0][0];
  return (
    <>
      <div className={styles.card} style={{ marginBottom: 14 }}>
        <div className={styles['card-head']}>
          <div>
            <span className={styles['card-title']}>{sym} · {d.n}</span>
            <div style={{ fontSize: '.65rem', color: 'var(--dim)', marginTop: 3 }}>{t.terminal.stocks.sectors[d.sec as keyof typeof t.terminal.stocks.sectors]}</div>
          </div>
          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
            <div className={styles.mono} style={{ fontSize: '1.4rem', fontWeight: 600 }}>${num(d.px)}</div>
            <div className={`${styles.mono} ${styles[cls(d.chg)]}`} style={{ fontSize: '.78rem', fontWeight: 600 }}>{arrow(d.chg)} {sign(d.chg)}%</div>
          </div>
          <span className={`${styles.src} ${styles.demo}`} style={{ marginLeft: 12 }}>{t.terminal.stocks.model}</span>
        </div>
        <div className={styles['card-body']}>
          <div className={styles['fund-grid']}>
            {([[t.terminal.stocks.fund.marketCap, d.mcap], [t.terminal.stocks.fund.pe, d.pe], [t.terminal.stocks.fund.eps, '$' + d.eps], [t.terminal.stocks.fund.dividend, d.div + '%'], [t.terminal.stocks.fund.revenue, d.rev], [t.terminal.stocks.fund.revGrowth, d.growth + '%'], [t.terminal.stocks.fund.beta, d.beta]] as [string, string | number][]).map(([l, v]) => (
              <div className={styles.fund} key={l}>
                <div className={styles['fund-l']}>{l}</div>
                <div className={styles['fund-v']}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className={`${styles.grid} ${styles.g2}`} style={{ marginBottom: 14 }}>
        <div className={styles.card}>
          <div className={styles['card-head']}>
            <span className={styles['card-title']}>{t.terminal.stocks.macroSensitivity}</span>
            <span className={styles['card-note']}>{t.terminal.stocks.correlationNote}</span>
          </div>
          <div className={styles['card-body']}>
            {Object.entries(d.sens).map(([k, v]) => {
              const w = (Math.abs(v) / sensMax) * 48;
              return (
                <div className={styles['sens-row']} key={k}>
                  <span className={styles['sens-n']}>{t.terminal.stocks.sensFactors[k as keyof typeof t.terminal.stocks.sensFactors]}</span>
                  <span className={styles['sens-wrap']}>
                    <span style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: 'var(--line2)' }} />
                    <span
                      className={styles['sens-bar']}
                      style={v >= 0 ? { left: '50%', width: w + '%', background: 'linear-gradient(90deg,#00A868,#00D084)' } : { right: '50%', width: w + '%', background: 'linear-gradient(90deg,#C42626,#FF5470)' }}
                    />
                  </span>
                  <span className={`${styles['sens-v']} ${styles[cls(v)]}`}>{v > 0 ? '+' : ''}{num(v)}</span>
                </div>
              );
            })}
            <div style={{ fontSize: '.65rem', color: 'var(--dim)', marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--line)' }}>
              {t.terminal.stocks.sensitivitySentence(d.n, t.terminal.stocks.sensFactors[topFactor as keyof typeof t.terminal.stocks.sensFactors])}
            </div>
          </div>
        </div>
        <div className={styles.card}>
          <div className={styles['card-head']}><span className={styles['card-title']}>{t.terminal.stocks.upcomingCatalysts}</span></div>
          <div className={styles['card-body']}>
            {content.cat.map((c, i) => {
              const dt = new Date();
              dt.setDate(dt.getDate() + 7 + i * 11);
              return (
                <div className={styles['cat-row']} key={i}>
                  <span className={`${styles['cat-date']} ${styles.mono}`}>{dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</span>
                  <div>
                    <div style={{ fontSize: '.77rem', fontWeight: 600 }}>{c[1]}</div>
                    <div style={{ fontSize: '.63rem', color: 'var(--dim)', marginTop: 2 }}>{c[0]}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className={`${styles.grid} ${styles.g2}`}>
        <div className={`${styles.case} ${styles.bull}`}>
          <div className={styles['case-t']} style={{ color: 'var(--green)' }}>{t.terminal.stocks.bullCase}</div>
          <ul>{content.bull.map((b, i) => <li key={i}>{b}</li>)}</ul>
        </div>
        <div className={`${styles.case} ${styles.bear}`}>
          <div className={styles['case-t']} style={{ color: 'var(--bear)' }}>{t.terminal.stocks.bearCase}</div>
          <ul>{content.bear.map((b, i) => <li key={i}>{b}</li>)}</ul>
        </div>
      </div>
    </>
  );
}
