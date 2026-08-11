'use client';

import { useEffect, useRef } from 'react';

/* Wraps TradingView's free "Advanced Chart" embeddable widget
   (https://www.tradingview.com/widget/advanced-chart/). The widget is
   loaded by injecting its own <script> tag with a JSON config as text
   content — that's TradingView's documented embed mechanism, not a
   custom iframe URL; the script builds the iframe itself.

   The free widget has no postMessage API to update an already-mounted
   instance, so a symbol/interval/locale change re-creates the widget
   from scratch (clear the container, re-inject). That's a full iframe
   reload on every asset switch, same as if the user changed the symbol
   search box themselves. */
export interface ChartWidgetProps {
  symbol: string;
  interval?: string; // TradingView interval code: '15' | '60' | '240' | 'D' etc.
  locale?: 'en' | 'ar';
  height?: number | string;
}

export function ChartWidget({ symbol, interval = '60', locale = 'en', height = 520 }: ChartWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.innerHTML = '';

    const widgetDiv = document.createElement('div');
    widgetDiv.className = 'tradingview-widget-container__widget';
    widgetDiv.style.height = '100%';
    widgetDiv.style.width = '100%';

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol,
      interval,
      timezone: 'Etc/UTC',
      theme: 'dark',
      style: '1',
      locale,
      backgroundColor: '#050507',
      gridColor: 'rgba(255,255,255,0.06)',
      hide_top_toolbar: true, // minimizes TradingView chrome/branding — the free widget's own logo watermark can't be removed per TradingView's terms
      hide_legend: false,
      hide_side_toolbar: false, // keeps the drawing-tools rail
      withdateranges: false,
      allow_symbol_change: false, // symbol is driven by the app's asset selector, not the widget's own search
      save_image: false,
      studies: ['Volume@tv-basicstudies'],
      support_host: 'https://www.tradingview.com',
    });

    container.appendChild(widgetDiv);
    container.appendChild(script);

    return () => {
      container.innerHTML = '';
    };
  }, [symbol, interval, locale]);

  return (
    // Two nested divs on purpose: TradingView's own script overwrites its
    // given container's style to height:100%/width:100% once it loads (to
    // drive its "autosize" iframe) — it doesn't preserve whatever height
    // React set there. So the *real* explicit height lives on this outer
    // div, which the script never touches; the inner div (the one handed
    // to TradingView via containerRef) just inherits 100%/100% from it.
    // Skipping this indirection is exactly how the chart collapses to 0.
    <div style={{ height, width: '100%' }}>
      <div
        className="tradingview-widget-container"
        ref={containerRef}
        style={{ height: '100%', width: '100%' }}
      />
    </div>
  );
}
