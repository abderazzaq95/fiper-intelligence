'use client';

import styles from './terminal.module.css';
import { num, sign } from '@/lib/terminal/format';

/* No literal UI copy here (symbol/price/% are all numeric/data values,
   not translatable strings), so no useLanguage() call is needed — 'use
   client' is added only so this can be safely imported from client
   screens per the migration batch's Server→Client Component pass. */

/* Ported from heatColor() + the .heat-cell markup in renderGlobal(). */
export function heatColor(c: number): string {
  const a = Math.min(1, Math.abs(c) / 3);
  return c >= 0 ? `rgba(0,208,132,${0.14 + a * 0.55})` : `rgba(255,84,112,${0.14 + a * 0.55})`;
}

export function HeatCell({ sym, price, chg }: { sym: string; price: number; chg: number }) {
  return (
    <div className={styles['heat-cell']} style={{ background: heatColor(chg) }}>
      <div className={styles['hc-sym']}>{sym}</div>
      <div className={styles['hc-chg']}>{sign(chg)}%</div>
      <div className={styles['hc-px']}>{num(price, price > 1000 ? 0 : 2)}</div>
    </div>
  );
}
