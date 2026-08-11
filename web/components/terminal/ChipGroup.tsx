'use client';

import styles from './terminal.module.css';

/* Generic ported `.chips`/`.chip.on` filter/tab pattern, reused by the
   headlines category filter, calendar day tabs, bias/COT/crypto symbol
   tabs, and the candle asset/timeframe pickers. */
export function ChipGroup<T extends string>({
  options,
  value,
  onChange,
  labels,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  labels?: Partial<Record<T, string>>;
}) {
  return (
    <div className={styles.chips}>
      {options.map((o) => (
        <button key={o} type="button" className={`${styles.chip} ${o === value ? styles.on : ''}`} onClick={() => onChange(o)}>
          {labels?.[o] ?? o}
        </button>
      ))}
    </div>
  );
}
