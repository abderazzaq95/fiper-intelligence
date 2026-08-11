'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './terminal.module.css';
import { fetchTimelineNews } from '@/lib/terminal/newsTimeline';
import type { NewsItem } from '@/lib/terminal/marketData';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import type { Dictionary } from '@/lib/i18n/dictionaries';

const REFRESH_MS = 5 * 60 * 1000;
const PX_PER_HOUR = 40; // widens the scrollable track for longer windows — see summary for the exact formula
const POPUP_WIDTH = 230;
const CLUSTER_PX = 60; // pins whose real rendered positions land within this many px of each other collapse into one cluster dot

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

// HH:MM only — toLocaleTimeString with just hour/minute never includes
// seconds, so this already satisfies "no seconds" with no extra work.
function timeLabel(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

interface Cluster {
  items: NewsItem[];
  pxLeft: number; // position at CLUSTER_PX-measurement time, in px from the track's inline-start edge
}

interface PopupState {
  items: NewsItem[]; // length 1 = single-pin detail, length > 1 = cluster list
  top: number;
  left: number;
  dir: 'up' | 'down'; // which way the popup extends from `top` — see openPopupAt
}

// Estimated popup heights (generous, not measured) used only to decide
// whether "above the pin" has room before the chart's bottom edge — see
// openPopupAt. A single-item popup tops out around 150-190px depending
// on summary length; a cluster list can run up to its own CSS
// max-height (280px) plus ~70px of chrome (close button, padding).
const EST_HEIGHT_SINGLE = 190;
const EST_HEIGHT_CLUSTER = 360;

/* "News on Chart" timeline — Phase 1 of "what drove this move". Pins
   are positioned by insetInlineStart (a logical CSS property, not
   left), so the same percentage-of-window math mirrors correctly under
   dir="rtl" with zero extra RTL-specific code: the browser flips which
   physical side 0%/100% resolve to, which is exactly "pins are
   mirrored" from the spec. Native `overflow-x: auto` + inherited
   `direction: rtl` similarly reverses scroll direction for free.

   Clustering (two pins within CLUSTER_PX of each other collapse into
   one dot) needs each pin's real *rendered* pixel position, not just
   its 0–100% time-window position — .nt-track's width is only
   `min-width: trackMinWidth`, so on a short time window (e.g. the 15m
   timeframe's 4h news window) the track actually renders wider than
   that floor, at whatever width the card gives it. A ResizeObserver on
   the track measures that real width so the 60px threshold is checked
   against real pixels, not a percentage that would silently mean a
   different pixel distance depending on window width.

   The popup is portalled to <body> — see the CSS comment on .nt-popup
   for why (an overflow-x:auto/overflow-y:hidden container computes both
   axes as scrolling per the CSS overflow spec, so a popup positioned to
   overflow *above* .nt-scroll the ordinary way gets silently clipped). */
export function NewsTimeline({ hoursWindow }: { hoursWindow: number }) {
  const { t } = useLanguage();
  // undefined = first fetch still in flight, null = confirmed no feed configured
  const [raw, setRaw] = useState<NewsItem[] | null | undefined>(undefined);
  const [popup, setPopup] = useState<PopupState | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [trackWidth, setTrackWidth] = useState(0);

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

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setTrackWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
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
  // Falls back to trackMinWidth before the ResizeObserver's first
  // measurement lands, so clustering/positioning still has a sane
  // (if momentarily approximate) width to work against on first paint.
  const effectiveWidth = trackWidth || trackMinWidth;

  // Greedy adjacent-distance clustering: walk items in time order (== in
  // pxLeft order, since position is a monotonic function of timestamp)
  // and chain consecutive pins into the same cluster while each is
  // within CLUSTER_PX of the previous one. A cluster's own position is
  // the mean of its members' — anchoring on the first member would bias
  // the dot away from center as a chain grows.
  const clusters = useMemo<Cluster[]>(() => {
    if (!items || !items.length) return [];
    const withPx = items.map((n) => ({
      item: n,
      pxLeft: (Math.min(100, Math.max(0, ((n.ts - windowStart) / (windowEnd - windowStart)) * 100)) / 100) * effectiveWidth,
    }));
    const out: Cluster[] = [];
    let current: { item: NewsItem; pxLeft: number }[] = [];
    for (const entry of withPx) {
      if (current.length === 0 || entry.pxLeft - current[current.length - 1].pxLeft < CLUSTER_PX) {
        current.push(entry);
      } else {
        out.push({ items: current.map((c) => c.item), pxLeft: current.reduce((a, c) => a + c.pxLeft, 0) / current.length });
        current = [entry];
      }
    }
    if (current.length) out.push({ items: current.map((c) => c.item), pxLeft: current.reduce((a, c) => a + c.pxLeft, 0) / current.length });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, effectiveWidth, windowStart, windowEnd]);

  function openPopupAt(items: NewsItem[], rect: DOMRect) {
    if (popup && popup.items.length === items.length && popup.items[0]?.id === items[0]?.id) {
      setPopup(null);
      return;
    }
    const rawLeft = rect.left + rect.width / 2;
    const left = Math.min(Math.max(rawLeft, POPUP_WIDTH / 2 + 8), window.innerWidth - POPUP_WIDTH / 2 - 8);

    // The chart above this timeline can run 500-900px tall with zero gap
    // before the pin row, so "open above the pin" (the default, matching
    // how these pins visually read) frequently has no room at all — the
    // popup would render fine but sit visually *behind* the TradingView
    // iframe's own compositing layer, unclickable and unreadable, since
    // that layer wins over normal z-index stacking for third-party
    // iframes like this one (confirmed while testing — a portalled
    // z-index:200 popup still lost to it). Flip to opening below the pin
    // instead whenever "above" would climb past this component's own top
    // edge (i.e. into the chart), where there's always open space (the
    // Patterns/MTF/Why panels sit below with plenty of room).
    const estHeight = items.length > 1 ? EST_HEIGHT_CLUSTER : EST_HEIGHT_SINGLE;
    const rootTop = rootRef.current?.getBoundingClientRect().top ?? 0;
    const fitsAbove = rect.top - 8 - estHeight >= rootTop;

    if (fitsAbove) {
      setPopup({ items, top: rect.top - 8, left, dir: 'up' });
    } else {
      setPopup({ items, top: rect.bottom + 8, left, dir: 'down' });
    }
  }

  return (
    <div className={styles['news-timeline']} ref={rootRef}>
      <div style={{ padding: '10px 16px 0' }}>
        <span className={styles['card-title']}>{t.terminal.candles.newsEvents}</span>
      </div>

      {raw === null ? (
        <div className={styles['nt-empty']}>{t.terminal.candles.connectNewsFeed}</div>
      ) : (
        <div className={styles['nt-scroll']}>
          <div className={styles['nt-track']} ref={trackRef} style={{ minWidth: trackMinWidth + 'px' }}>
            {clusters.map((c) => {
              if (c.items.length === 1) {
                const n = c.items[0];
                const color = n.imp === 'HIGH' ? 'var(--red)' : 'var(--amber)';
                const shortHeadline = n.h.length > 28 ? n.h.slice(0, 28).trimEnd() + '…' : n.h;
                return (
                  <div className={styles['nt-pin-wrap']} style={{ insetInlineStart: c.pxLeft + 'px' }} key={n.id}>
                    <button type="button" className={styles['nt-pin']} onClick={(e) => openPopupAt([n], e.currentTarget.getBoundingClientRect())}>
                      <span className={styles['nt-line']} />
                      <span className={styles['nt-dot']} style={{ background: color }} />
                      <span className={styles['nt-time']}>{timeLabel(n.ts)}</span>
                      <span className={styles['nt-headline']}>{shortHeadline}</span>
                      <span className={styles['nt-tags']}>
                        {n.t.slice(0, 2).map((tag, i) => (
                          <span key={i} className={`${styles.tag} ${styles[tag.includes('↑') ? 'up' : 'down']}`}>{tag}</span>
                        ))}
                      </span>
                    </button>
                  </div>
                );
              }
              const hasHigh = c.items.some((n) => n.imp === 'HIGH');
              return (
                <div className={styles['nt-pin-wrap']} style={{ insetInlineStart: c.pxLeft + 'px' }} key={c.items[0].id}>
                  <button
                    type="button"
                    className={styles['nt-pin']}
                    onClick={(e) => openPopupAt(c.items, e.currentTarget.getBoundingClientRect())}
                  >
                    <span className={styles['nt-line']} />
                    <span className={styles['nt-cluster-dot']} style={{ borderColor: hasHigh ? 'var(--red-hi)' : 'var(--amber)' }}>
                      {c.items.length}
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
            style={{ top: popup.top, left: popup.left, transform: `translate(-50%, ${popup.dir === 'up' ? '-100%' : '0'})` }}
            onClick={(e) => e.stopPropagation()}
          >
            <button type="button" className={styles['nt-popup-close']} aria-label={t.terminal.candles.closePopup} onClick={() => setPopup(null)}>
              ×
            </button>
            {popup.items.length === 1 ? (
              <>
                <div className={styles['nt-popup-head']}>{popup.items[0].h}</div>
                {popup.items[0].s && <div className={styles['nt-popup-sum']}>{popup.items[0].s}</div>}
                <span className={styles['nt-tags']}>
                  {popup.items[0].t.map((tag, i) => (
                    <span key={i} className={`${styles.tag} ${styles[tag.includes('↑') ? 'up' : 'down']}`}>{tag}</span>
                  ))}
                </span>
                <div className={styles['nt-popup-time']}>{agoText(popup.items[0].ts, t)}</div>
              </>
            ) : (
              <div className={styles['nt-cluster-list']}>
                {popup.items.map((n) => (
                  <div
                    className={styles['nt-cluster-item']}
                    key={n.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setPopup((p) => (p ? { ...p, items: [n] } : p))}
                  >
                    <div className={styles['nt-cluster-item-head']}>{n.h}</div>
                    <div className={styles['nt-cluster-item-meta']}>
                      {timeLabel(n.ts)} · {n.t.slice(0, 2).join(' ')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
