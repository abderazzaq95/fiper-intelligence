'use client';

import { useState } from 'react';
import styles from './terminal.module.css';
import { type ScreenKey } from '@/lib/terminal/routes';
import { Brand } from './Brand';
import { TopBar } from './TopBar';
import { Sidebar } from './Sidebar';
import { HomeScreen } from './screens/HomeScreen';
import { HeadlinesScreen } from './screens/HeadlinesScreen';
import { CalendarScreen } from './screens/CalendarScreen';
import { BiasScreen } from './screens/BiasScreen';
import { GlobalMarketsScreen } from './screens/GlobalMarketsScreen';
import { FlowsScreen } from './screens/FlowsScreen';
import { CotScreen } from './screens/CotScreen';
import { ForecastsScreen } from './screens/ForecastsScreen';
import { CandlesScreen } from './screens/CandlesScreen';
import { BacktestScreen } from './screens/BacktestScreen';
import { StocksScreen } from './screens/StocksScreen';
import { CryptoScreen } from './screens/CryptoScreen';
import { TradeScreen } from './screens/TradeScreen';

/* Ported from the #app shell + route(). All 12 <section class="screen">
   blocks stay mounted simultaneously (toggled via the `.on` class, same
   as the original's show/hide-not-mount/unmount router) so switching
   tabs is instant and never re-fetches — state (chip selections, form
   fields, loaded candle data...) lives in each screen's own component
   state and simply isn't torn down when you navigate away. */
export function TerminalShell() {
  const [activeScreen, setActiveScreen] = useState<ScreenKey>('home');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [biasSel, setBiasSel] = useState('NQUSD');

  const select = (key: ScreenKey) => {
    setActiveScreen(key);
    setSidebarOpen(false);
  };
  const goToBias = (sym: string) => {
    setBiasSel(sym);
    select('bias');
  };

  const screenClass = (key: ScreenKey) => `${styles.screen} ${activeScreen === key ? styles.on : ''}`;

  return (
    <div className={styles.terminalRoot}>
      <div id={styles.app}>
        <Brand onToggleSidebar={() => setSidebarOpen((o) => !o)} />
        <TopBar active={activeScreen} />
        <Sidebar active={activeScreen} open={sidebarOpen} onSelect={select} />

        <main className={styles.main} id="main">
          <section className={screenClass('home')} id="s-home">
            <HomeScreen onGotoCalendar={() => select('calendar')} onGotoBias={goToBias} />
          </section>

          <section className={screenClass('headlines')} id="s-headlines">
            <HeadlinesScreen />
          </section>

          <section className={screenClass('calendar')} id="s-calendar">
            <CalendarScreen />
          </section>

          <section className={screenClass('bias')} id="s-bias">
            <BiasScreen biasSel={biasSel} setBiasSel={setBiasSel} />
          </section>

          <section className={screenClass('global')} id="s-global">
            <GlobalMarketsScreen />
          </section>

          <section className={screenClass('flows')} id="s-flows">
            <FlowsScreen />
          </section>

          <section className={screenClass('cot')} id="s-cot">
            <CotScreen />
          </section>

          <section className={screenClass('forecasts')} id="s-forecasts">
            <ForecastsScreen />
          </section>

          <section className={screenClass('candles')} id="s-candles">
            <CandlesScreen active={activeScreen === 'candles'} />
          </section>

          <section className={screenClass('backtest')} id="s-backtest">
            <BacktestScreen active={activeScreen === 'backtest'} />
          </section>

          <section className={screenClass('stocks')} id="s-stocks">
            <StocksScreen />
          </section>

          <section className={screenClass('crypto')} id="s-crypto">
            <CryptoScreen />
          </section>

          <section className={screenClass('trade')} id="s-trade">
            <TradeScreen active={activeScreen === 'trade'} />
          </section>
        </main>
      </div>
    </div>
  );
}
