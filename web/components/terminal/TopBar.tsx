'use client';

import { useEffect, useState } from 'react';
import styles from './terminal.module.css';
import { type ScreenKey } from '@/lib/terminal/routes';
import { Ticker } from './Ticker';
import { ConnectionIndicator } from './ConnectionIndicator';
import { LogoutButton } from './LogoutButton';
import { LanguageSwitcher } from '@/components/i18n/LanguageSwitcher';
import { useLanguage } from '@/lib/i18n/LanguageContext';

/* Ported from tickClock() + SESSIONS. Owns its own setInterval(1000),
   independent of the 20s market-data refresh loop (per the migration
   plan — clock/session indicators are a separate concern from S). */
const SESSIONS = [
  { n: 'SYD', o: 21, c: 6 },
  { n: 'TKY', o: 0, c: 9 },
  { n: 'LDN', o: 7, c: 16 },
  { n: 'NY', o: 12, c: 21 },
];

export function TopBar({ active }: { active: ScreenKey }) {
  const { t } = useLanguage();
  const [utc, setUtc] = useState('--:--:--');
  const [hour, setHour] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setUtc(d.toUTCString().slice(17, 25));
      setHour(d.getUTCHours());
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const [group, name] = t.common.breadcrumb[active];

  return (
    <div className={styles.topwrap}>
      <div className={styles.topbar}>
        <div>
          <div className={styles['screen-label']} id="crumb">{group}</div>
          <div className={styles['screen-name']} id="crumbName">{name}</div>
        </div>
        <div className={styles['top-right']}>
          <ConnectionIndicator />
          <LanguageSwitcher />
          <div className={styles.sessions} id="sessions">
            {SESSIONS.map((s) => {
              const open = hour == null ? false : s.o < s.c ? hour >= s.o && hour < s.c : hour >= s.o || hour < s.c;
              return (
                <span key={s.n} className={`${styles.sess} ${open ? styles.open : ''}`}>
                  {s.n}
                </span>
              );
            })}
          </div>
          <div className={styles.clock} id="clock">
            {utc} <b>{t.terminal.shell.utc}</b>
          </div>
          <button className={styles['icon-btn']} aria-label={t.terminal.shell.alerts} type="button">
            🔔<span className={styles['badge-dot']} />
          </button>
          <LogoutButton />
        </div>
      </div>
      <Ticker />
    </div>
  );
}
