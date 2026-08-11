'use client';

import styles from '../terminal.module.css';
import { useMarketData } from '@/lib/terminal/MarketDataProvider';
import { biasFor } from '@/lib/terminal/bias';
import { num } from '@/lib/terminal/format';
import { useLanguage } from '@/lib/i18n/LanguageContext';

const LIST = ['NQUSD', 'XAUUSD', 'BTCUSD', 'ETHUSD', 'USOIL', 'DXY'];

/* Ported from #s-forecasts + renderForecasts(). */
export function ForecastsScreen() {
  const S = useMarketData();
  const { t } = useLanguage();

  return (
    <div className={`${styles.grid} ${styles.g2}`} id="forecastGrid">
      {LIST.map((sym) => {
        const q = S.quotes[sym] || S.crypto[sym];
        const b = biasFor(S, sym);
        if (!q || !b) return null;
        const col = b.dir === 'Bullish' ? 'var(--green)' : b.dir === 'Bearish' ? 'var(--bear)' : 'var(--amber)';
        const s = b.score / 100;
        const dxyChg = S.quotes.DXY?.chg ?? 0;
        const cotRow = S.cot[sym]?.[0];
        const drivers = [
          { n: 'Fed policy cycle', v: S.risk > 55 ? 'Supportive' : 'Restrictive', c: S.risk > 55 ? 'var(--green)' : 'var(--bear)' },
          { n: 'Risk appetite', v: S.risk > 62 ? 'Risk-on' : S.risk < 38 ? 'Risk-off' : 'Balanced', c: S.risk > 62 ? 'var(--green)' : S.risk < 38 ? 'var(--bear)' : 'var(--amber)' },
          { n: 'Dollar direction', v: dxyChg > 0 ? 'Strengthening' : 'Softening', c: dxyChg > 0 ? 'var(--bear)' : 'var(--green)' },
          { n: 'Positioning', v: !cotRow ? 'No COT' : cotRow.specLong - cotRow.specShort > 0 ? 'Net long' : 'Net short', c: '#5B9BFF' },
        ];
        return (
          <div className={styles['fc-card']} key={sym}>
            <div className={styles['fc-head']}>
              <div>
                <div className={styles['bc-sym']}>{sym}</div>
                <div className={styles['bc-name']}>{t.terminal.forecasts.weekLine(q.name || t.terminal.forecasts.cryptoFallback)}</div>
              </div>
              <div className={styles['fc-dir']} style={{ color: col }}>{t.common.direction[b.dir]}</div>
            </div>
            <div className={styles['fc-body']}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <span style={{ fontSize: '.68rem', color: 'var(--muted)' }}>{t.terminal.forecasts.confidence}</span>
                <span className={styles['conf-track']}><span className={styles['conf-fill']} style={{ width: b.conf + '%', background: col }} /></span>
                <span className={styles.mono} style={{ fontSize: '.74rem', fontWeight: 700, color: col }}>{Math.round(b.conf)}%</span>
              </div>
              <div className={styles['fc-targets']}>
                <div className={styles['fc-t']}>
                  <div className={styles['fc-t-l']}>{t.terminal.forecasts.conservative}</div>
                  <div className={styles['fc-t-v']}>{num(q.price * (1 + s * 0.006), q.price > 1000 ? 0 : 2)}</div>
                </div>
                <div className={styles['fc-t']}>
                  <div className={styles['fc-t-l']}>{t.terminal.forecasts.base}</div>
                  <div className={styles['fc-t-v']} style={{ color: col }}>{num(q.price * (1 + s * 0.018), q.price > 1000 ? 0 : 2)}</div>
                </div>
                <div className={styles['fc-t']}>
                  <div className={styles['fc-t-l']}>{t.terminal.forecasts.stretch}</div>
                  <div className={styles['fc-t-v']}>{num(q.price * (1 + s * 0.038), q.price > 1000 ? 0 : 2)}</div>
                </div>
              </div>
              <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--line)' }}>
                {drivers.map((d) => (
                  <div className={styles.driver} key={d.n}>
                    <span className={styles['driver-dot']} style={{ background: d.c }} />
                    {t.terminal.forecasts.driverNames[d.n as keyof typeof t.terminal.forecasts.driverNames]}
                    <span style={{ marginLeft: 'auto', color: d.c, fontWeight: 600 }}>{t.terminal.forecasts.driverValues[d.v as keyof typeof t.terminal.forecasts.driverValues]}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
