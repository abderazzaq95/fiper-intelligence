'use client';

import styles from './terminal.module.css';
import type { Theme } from '@/lib/terminal/marketData';
import { useLanguage } from '@/lib/i18n/LanguageContext';

/* Ported from renderRisk() + the .gauge-wrap markup — the "signature
   element" on the Home screen risk-environment card.

   The needle's `left: value + '%'` position and the 0%=risk-off /
   100%=risk-on scale convention are NOT mirrored for RTL by design (see
   terminal.module.css's `[dir="rtl"] .gauge` override, which isolates
   the gauge back to `direction: ltr`) — so the "Risk Off"/"Neutral"/
   "Risk On" labels below are left in their original left-to-right DOM
   order in both languages; only the label text itself is translated. */
export function Gauge({ value, themes }: { value: number; themes: Theme[] }) {
  const { t } = useLanguage();
  const state: [string, string] =
    value > 62 ? [t.common.riskState['RISK ON'], 'var(--green)']
    : value < 38 ? [t.common.riskState['RISK OFF'], 'var(--bear)']
    : [t.common.riskState.NEUTRAL, 'var(--amber)'];

  return (
    <div className={styles['gauge-wrap']}>
      <div className={styles['gauge-read']}>
        <span className={styles['gauge-val']} id="riskVal">{Math.round(value)}</span>
        <span className={styles['gauge-state']} id="riskState" style={{ color: state[1] }}>{state[0]}</span>
      </div>
      <div className={styles.gauge}>
        <div className={styles['gauge-needle']} id="needle" style={{ left: value + '%' }} />
      </div>
      <div className={styles['gauge-scale']}>
        <span style={{ color: 'var(--bear)' }}>{t.common.riskScale['Risk Off']}</span>
        <span style={{ color: 'var(--amber)' }}>{t.common.riskScale.Neutral}</span>
        <span style={{ color: 'var(--green)' }}>{t.common.riskScale['Risk On']}</span>
      </div>
      <div className={styles.themes} id="themes">
        {themes.map((th) => (
          <div className={styles.theme} key={th.n}>
            <span className={styles['theme-name']}>{t.common.theme[th.n as keyof typeof t.common.theme] ?? th.n}</span>
            <span className={styles['theme-bar']}>
              <span className={styles['theme-fill']} style={{ width: th.v + '%', background: th.c }} />
            </span>
            <span className={styles['theme-val']} style={{ color: th.c }}>{Math.round(th.v)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
