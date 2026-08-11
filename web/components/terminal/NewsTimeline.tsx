'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './terminal.module.css';
import { fetchTimelineNews } from '@/lib/terminal/newsTimeline';
import type { NewsItem } from '@/lib/terminal/marketData';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import type { Dictionary } from '@/lib/i18n/dictionaries';

const REFRESH_MS = 5 * 60 * 1000;
const PX_PER_HOUR = 40; // widens the scrollable track for longer windows — see summary for the exact formula
const POPUP_WIDTH = 230;

/* Local replacement for format.ts's ago(), same pattern NewsCard.tsx
   uses — format.ts's own ago() stays untouched (CLAUDE.md constraint),
   this just renders the same minute/hour math through translated
   t.common.ago strings. */
function agoText(ts: number, t: Dictionary): string {
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return t.common.ago.justNow;
  if (m < 60) return t.common.ago.minAgo(m);
  const h = Math.floor(m / 60);
  return t.common.ago.hourMinAgo(h, m % 60);
}

interface PopupState {
  item: NewsItem;
  top: number;
  left: number;
}

/* "News on Chart" timeline — Phase 1 of "what drove this move". Pins
   are positioned by insetInlineStart (a logical CSS property, not
   left), so the same percentage-of-window math mirrors correctly under
   dir="rtl" with zero extra RTL-specific code: the browser flips which
   physical side 0%/100% resolve to, which is exactly "pins are
   mirrored" from the spec. Native `overflow-x: auto` + inherited
   `direction: rtl` similarly reverses scroll direction for free. The
   popup is portalled to <body> — see the CSS comment on .nt-popup for
   why. */
export function NewsTimeline({ hoursWindow }: { hoursWindow: number }) {
  const { t } = useLanguage();
  // undefined = first fetch still in flight, null = confirmed no feed configured
  const [raw, setRaw] = useState<NewsItem[] | null | undefined>(undefined);
  const [popup, setPopup] = useState<PopupState | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetchTimelineNews().then((items) => {
        if (!cancelled) setRaw(items);
      });
    };
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // A popup positioned from a one-time measurement goes stale if the
  // page scrolls or resizes while it's open — closing it is simpler and
  // more correct than re-measuring on every scroll tick for a Phase 1
  // feature. Capture phase so this also catches scroll events fired on
  // nested scrollers (like .nt-scroll itself), which don't bubble but do
  // still pass through window during the capture phase — that's also
  // why .nt-scroll doesn't need its own separate onScroll handler.
  //
  // The listener attachment is deferred one frame: the very click that
  // *opens* the popup can itself trigger a native focus-scroll (the
  // browser scrolling the newly focused pin button fully into view),
  // and attaching synchronously would let that same click's own scroll
  // immediately close the popup it just opened (confirmed while
  // testing — the popup was being set then instantly unset within the
  // same tick). Standard "outside interaction" pattern: start listening
  // only after the opening interaction has fully settled.
  useEffect(() => {
    if (!popup) return;
    const close = () => setPopup(null);
    const raf = requestAnimationFrame(() => {
      window.addEventListener('scroll', close, true);
      window.addEventListener('resize', close);
    });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [popup]);

  const windowEnd = Date.now();
  const windowStart = windowEnd - hoursWindow * 3_600_000;

  // Timeframe changes only re-filter/re-space the already-fetched batch
  // (limit=40, unfiltered by time) rather than re-fetching — the spec's
  // fetch call is a fixed page size, not parameterized per timeframe.
  const items = useMemo(() => {
    if (!raw) return raw;
    return raw
      .filter((n) => (n.imp === 'HIGH' || n.imp === 'MED') && n.ts >= windowStart && n.ts <= windowEnd)
      .sort((a, b) => a.ts - b.ts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw, hoursWindow]);

  const trackMinWidth = Math.max(100, hoursWindow * PX_PER_HOUR);

  function openPopup(item: NewsItem, e: React.MouseEvent<HTMLButtonElement>) {
    if (popup?.item.id === item.id) {
      setPopup(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const rawLeft = rect.left + rect.width / 2;
    const left = Math.min(Math.max(rawLeft, POPUP_WIDTH / 2 + 8), window.innerWidth - POPUP_WIDTH / 2 - 8);
    setPopup({ item, top: rect.top - 8, left });
  }

  return (
    <div className={styles['news-timeline']}>
      <div style={{ padding: '10px 16px 0' }}>
        <span className={styles['card-title']}>{t.terminal.candles.newsEvents}</span>
      </div>

      {raw === null ? (
        <div className={styles['nt-empty']}>{t.terminal.candles.connectNewsFeed}</div>
      ) : (
        <div className={styles['nt-scroll']}>
          <div className={styles['nt-track']} style={{ minWidth: trackMinWidth + 'px' }}>
            {(items || []).map((n) => {
              const pct = Math.min(100, Math.max(0, ((n.ts - windowStart) / (windowEnd - windowStart)) * 100));
              const color = n.imp === 'HIGH' ? 'var(--red)' : 'var(--amber)';
              const shortHeadline = n.h.length > 40 ? n.h.slice(0, 40).trimEnd() + '…' : n.h;
              return (
                <div className={styles['nt-pin-wrap']} style={{ insetInlineStart: pct + '%' }} key={n.id}>
                  <button type="button" className={styles['nt-pin']} onClick={(e) => openPopup(n, e)}>
                    <span className={styles['nt-line']} />
                    <span className={styles['nt-dot']} style={{ background: color }} />
                    <span className={styles['nt-time']}>{new Date(n.ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                    <span className={styles['nt-headline']}>{shortHeadline}</span>
                    <span className={styles['nt-tags']}>
                      {n.t.slice(0, 2).map((tag, i) => (
                        <span key={i} className={`${styles.tag} ${styles[tag.includes('↑') ? 'up' : 'down']}`}>{tag}</span>
                      ))}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {popup &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className={styles['nt-popup']}
            style={{ top: popup.top, left: popup.left, transform: 'translate(-50%, -100%)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <button type="button" className={styles['nt-popup-close']} aria-label={t.terminal.candles.closePopup} onClick={() => setPopup(null)}>
              ×
            </button>
            <div className={styles['nt-popup-head']}>{popup.item.h}</div>
            {popup.item.s && <div className={styles['nt-popup-sum']}>{popup.item.s}</div>}
            <span className={styles['nt-tags']}>
              {popup.item.t.map((tag, i) => (
                <span key={i} className={`${styles.tag} ${styles[tag.includes('↑') ? 'up' : 'down']}`}>{tag}</span>
              ))}
            </span>
            <div className={styles['nt-popup-time']}>{agoText(popup.item.ts, t)}</div>
          </div>,
          document.body
        )}
    </div>
  );
}
