'use client';

import styles from './landing.module.css';

const LOGOS = ['Reuters', 'Bloomberg', 'LSEG', 'CME Group', 'NASDAQ', 'TradingView', 'CTrader', 'MetaTrader 5'];

export default function PartnersMarquee() {
  const doubled = [...LOGOS, ...LOGOS];
  return (
    <div className={styles['marquee-section']}>
      <div className={styles['marquee-track']}>
        {doubled.map((name, i) => (
          <span className={styles['marquee-logo']} key={i}>{name}</span>
        ))}
      </div>
    </div>
  );
}
