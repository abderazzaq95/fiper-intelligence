'use client';

import { useState, type ReactNode } from 'react';
import styles from '../terminal.module.css';
import { useMarketData } from '@/lib/terminal/MarketDataProvider';
import { useLanguage } from '@/lib/i18n/LanguageContext';

/* Ported from #s-calendar + renderCalendar(). calDay is local state (was
   a module-level variable, initialised the same way: today's weekday
   index clamped to Mon–Fri, defaulting to Monday on weekends). */
export function CalendarScreen() {
  const S = useMarketData();
  const { t } = useLanguage();
  const DOWS = t.terminal.calendar.dows;
  const [calDay, setCalDay] = useState(() => {
    let d = new Date().getDay() - 1;
    if (d < 0 || d > 4) d = 0;
    return d;
  });

  const today = new Date();
  const evs = S.events.filter((e) => e.day === calDay);

  return (
    <div>
      <div className={styles['cal-days']} id="calDays">
        {DOWS.map((d, i) => {
          const dt = new Date(today);
          dt.setDate(today.getDate() - today.getDay() + 1 + i);
          const cnt = S.events.filter((e) => e.day === i).length;
          const hi = S.events.filter((e) => e.day === i && e.imp === 'HIGH').length;
          return (
            <button key={d} type="button" className={`${styles['cal-day']} ${i === calDay ? styles.on : ''}`} onClick={() => setCalDay(i)}>
              <div className={styles['cd-dow']}>{d}</div>
              <div className={styles['cd-date']}>{dt.getDate()}</div>
              <div className={styles['cd-cnt']}>{t.terminal.calendar.eventsCount(cnt, hi)}</div>
            </button>
          );
        })}
      </div>
      <div className={styles.card}>
        <div className={styles['card-head']}>
          <span className={styles['card-title']} id="calTitle">{t.terminal.calendar.dayTitle(DOWS[calDay], evs.length)}</span>
          <span className={styles['card-note']}>{t.terminal.calendar.consensusNote}</span>
        </div>
        <div id="calEvents">
          {evs.length ? (
            evs.map((e, i) => {
              const beat = e.act != null && e.fc != null ? (e.act > e.fc ? 'up' : e.act < e.fc ? 'down' : 'flat') : 'flat';
              let range: ReactNode;
              if (e.lo != null && e.hi != null) {
                const span = e.hi - e.lo || 1;
                const pos = (v: number) => Math.max(0, Math.min(100, ((v - e.lo!) / span) * 100));
                range = (
                  <div className={styles['bank-range']}>
                    <div className={styles['br-label']} style={{ left: 0 }}>{e.lo}{e.unit}</div>
                    <div className={styles['br-label']} style={{ right: 0 }}>{e.hi}{e.unit}</div>
                    <div className={styles['br-track']} />
                    <div className={styles['br-band']} style={{ left: '8%', right: '8%' }} />
                    {e.fc != null && <div className={`${styles['br-mark']} ${styles.cons}`} style={{ left: pos(e.fc) + '%' }} />}
                    {e.act != null && <div className={`${styles['br-mark']} ${styles.act}`} style={{ left: pos(e.act) + '%' }} />}
                  </div>
                );
              } else {
                range = <div style={{ fontSize: '.63rem', color: 'var(--dim)' }}>{t.terminal.calendar.noForecast}</div>;
              }
              return (
                <div className={styles['ev-row']} key={i}>
                  <span className={styles['ev-time']}>{e.t}</span>
                  <span className={styles['ev-ccy']}>{e.ccy}</span>
                  <div>
                    <div className={styles['ev-name']}>{e.n}</div>
                    <div className={styles['ev-meta']}>
                      {e.released ? t.terminal.calendar.released : t.terminal.calendar.upcoming} · <span className={`${styles.pill} ${styles[e.imp.toLowerCase()]}`} style={{ padding: '1px 5px' }}>{t.common.impact[e.imp]}</span>
                    </div>
                  </div>
                  <div className={styles['ev-nums']}>
                    <div className={styles['ev-num']}>
                      <div className={styles['ev-num-l']}>{t.terminal.calendar.prev}</div>
                      <div className={styles['ev-num-v']}>{e.prev ?? t.terminal.calendar.dash}{e.prev != null ? e.unit : ''}</div>
                    </div>
                    <div className={styles['ev-num']}>
                      <div className={styles['ev-num-l']}>{t.terminal.calendar.cons}</div>
                      <div className={styles['ev-num-v']}>{e.fc ?? t.terminal.calendar.dash}{e.fc != null ? e.unit : ''}</div>
                    </div>
                    <div className={styles['ev-num']}>
                      <div className={styles['ev-num-l']}>{t.terminal.calendar.actual}</div>
                      <div className={`${styles['ev-num-v']} ${styles[beat]}`}>{e.act ?? t.terminal.calendar.dash}{e.act != null ? e.unit : ''}</div>
                    </div>
                  </div>
                  {range}
                </div>
              );
            })
          ) : (
            <div className={styles.empty}>{t.terminal.calendar.noEvents}</div>
          )}
        </div>
      </div>
    </div>
  );
}
