'use client';

import styles from './terminal.module.css';
import { useConnectionState } from '@/lib/terminal/MarketDataProvider';
import { useLanguage } from '@/lib/i18n/LanguageContext';

/* Dot + label for the WS connection lifecycle — green while push updates
   are flowing, amber while a reconnect is in flight, grey once backoff
   has maxed out and the provider has fallen back to REST polling (see
   MarketDataProvider.tsx's startRestPolling). Sits in TopBar's existing
   top-right cluster, one more item in a row that already has the clock
   and session indicators — no new region added. */
export function ConnectionIndicator() {
  const state = useConnectionState();
  const { t } = useLanguage();
  const LABEL = {
    connected: t.common.badge.Live,
    reconnecting: t.common.badge.Reconnecting,
    'rest-fallback': t.common.badge.Polling,
  } as const;
  return (
    <div className={`${styles.conn} ${styles[state]}`} title={`${t.terminal.shell.backend}: ${LABEL[state]}`}>
      <span className={styles['conn-dot']} />
      {LABEL[state]}
    </div>
  );
}
