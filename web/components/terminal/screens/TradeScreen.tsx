'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import styles from '../terminal.module.css';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { num, sign, cls } from '@/lib/terminal/format';
import {
  tradeClient,
  type TradeStatus,
  type BrokerPosition,
  type TradeHistoryEntry,
} from '@/lib/terminal/tradeClient';

const POLL_MS = 5000;

/* "Trade for Me" — paper-trading auto-execution. Gated on `active` the
   same way CandlesScreen/BacktestScreen avoid work while hidden: no
   point polling a broker account for a screen the user isn't looking
   at. Settings form fields are seeded from the backend exactly once
   (seededRef) so a background poll never clobbers an in-progress edit. */
export function TradeScreen({ active }: { active: boolean }) {
  const { t } = useLanguage();
  const tt = t.terminal.trade;

  const [status, setStatus] = useState<TradeStatus | null>(null);
  const [positions, setPositions] = useState<BrokerPosition[]>([]);
  const [history, setHistory] = useState<TradeHistoryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [riskPct, setRiskPct] = useState(1);
  const [minConfidence, setMinConfidence] = useState(40);
  const [selected, setSelected] = useState<string[]>([]);
  const seededRef = useRef(false);

  const [confirmEnable, setConfirmEnable] = useState(false);
  const [confirmKill, setConfirmKill] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [testConfirm, setTestConfirm] = useState(false);
  const [testBusy, setTestBusy] = useState(false);

  async function loadAll() {
    const [s, p, h] = await Promise.all([tradeClient.status(), tradeClient.positions(), tradeClient.history(30)]);
    if (s.data) setStatus(s.data);
    if (s.error) setError(s.error);
    if (p.data) setPositions(p.data);
    if (h.data) setHistory(h.data);
  }

  useEffect(() => {
    if (!active) return;
    loadAll();
    const id = setInterval(loadAll, POLL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  useEffect(() => {
    if (seededRef.current || !status) return;
    seededRef.current = true;
    setRiskPct(status.settings.riskPct);
    setMinConfidence(status.settings.minConfidence);
    setSelected(status.settings.allowedInstruments);
  }, [status]);

  async function saveSettings() {
    setSaving(true);
    const res = await tradeClient.updateSettings({ riskPct, minConfidence, allowedInstruments: selected });
    setSaving(false);
    if (res.data) {
      setStatus((s) => (s ? { ...s, settings: res.data! } : s));
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1500);
    } else {
      setError(res.error ?? 'save failed');
    }
  }

  async function runDemoTestOrder() {
    if (!testConfirm) {
      setTestConfirm(true);
      return;
    }
    setTestConfirm(false);
    setTestBusy(true);
    setError(null);
    const res = await tradeClient.testOrder('BUY');
    setTestBusy(false);
    if (res.data) await loadAll();
    else setError(res.error ?? 'demo test order failed');
  }

  async function toggleEnabled() {
    if (!status) return;
    if (!status.settings.enabled && !confirmEnable) {
      setConfirmEnable(true);
      return;
    }
    setConfirmEnable(false);
    const res = await tradeClient.updateSettings({ enabled: !status.settings.enabled });
    if (res.data) setStatus((s) => (s ? { ...s, settings: res.data! } : s));
    else setError(res.error ?? 'update failed');
  }

  async function doKill() {
    if (!confirmKill) {
      setConfirmKill(true);
      return;
    }
    setConfirmKill(false);
    const res = await tradeClient.killSwitch('manual (dashboard)');
    if (res.data) setStatus((s) => (s ? { ...s, settings: res.data! } : s));
  }

  async function doClose(dealId: string) {
    await tradeClient.closePosition(dealId);
    loadAll();
  }

  const toggleInstrument = (sym: string) =>
    setSelected((cur) => (cur.includes(sym) ? cur.filter((s) => s !== sym) : [...cur, sym]));

  const inputStyle: CSSProperties = {
    background: 'var(--panel2)',
    border: '1px solid var(--line)',
    borderRadius: 8,
    padding: '9px 11px',
    fontFamily: 'var(--mono)',
    fontSize: '.78rem',
    color: 'var(--text)',
    width: '100%',
  };

  return (
    <div className={styles['wide-screen']}>
      <div className={styles.card} style={{ marginBottom: 14 }}>
        <div className={styles['card-head']}>
          <span className={styles['card-title']}>{tt.title}</span>
          <span className={styles.pill} style={{ marginLeft: 'auto', color: 'var(--amber)', borderColor: 'rgba(240,165,0,.4)' }}>
            {tt.paperBadge}
          </span>
        </div>
        <div className={styles['card-body']}>
          <div style={{ fontSize: '.78rem', color: 'var(--muted)', marginBottom: 4 }}>{tt.subtitle}</div>
          <div className={styles.warn}>
            <span>⚠</span>
            <span>{tt.disclaimer}</span>
          </div>
          {error && (
            <div className={styles.warn} style={{ marginTop: 8 }}>
              <span>⚠</span>
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>

      {status && !status.brokerConfigured && (
        <div className={styles.card} style={{ marginBottom: 14 }}>
          <div className={styles['card-body']}>
            <div className={styles.empty}>{tt.notConfigured}</div>
          </div>
        </div>
      )}

      {status && (
        <>
          <div className={styles.card} style={{ marginBottom: 14 }}>
            <div className={styles['card-head']}>
              <span className={styles['card-title']}>{tt.status}</span>
              <span
                className={`${styles.pill} ${status.settings.enabled ? styles.bull : styles.neutral}`}
                style={{ marginLeft: 'auto' }}
              >
                {status.settings.enabled ? tt.statusOn : tt.statusOff}
              </span>
            </div>
            <div className={styles['card-body']}>
              {status.settings.killSwitch && (
                <div className={styles.warn}>
                  <span>⛔</span>
                  <span>{tt.killSwitchTripped(status.settings.killSwitch.reason, new Date(status.settings.killSwitch.at).toLocaleString())}</span>
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <button type="button" className={styles.btn} disabled={!status.brokerConfigured} onClick={toggleEnabled}>
                  {status.settings.enabled ? tt.disable : tt.enable}
                </button>
                {confirmEnable && (
                  <>
                    <span style={{ fontSize: '.74rem', color: 'var(--amber)' }}>{tt.confirmEnable}</span>
                    <button type="button" className={styles.btn} onClick={toggleEnabled}>{tt.confirmEnableYes}</button>
                    <button type="button" className={styles.sel} onClick={() => setConfirmEnable(false)}>{tt.cancel}</button>
                  </>
                )}

                <button
                  type="button"
                  className={styles.btn}
                  style={{ marginInlineStart: confirmEnable ? 0 : 'auto', background: 'linear-gradient(135deg,#FF5470,#971212)' }}
                  onClick={doKill}
                >
                  {tt.killSwitchButton}
                </button>
                {confirmKill && (
                  <>
                    <span style={{ fontSize: '.74rem', color: 'var(--amber)' }}>{tt.killSwitchConfirm}</span>
                    <button type="button" className={styles.sel} onClick={() => setConfirmKill(false)}>{tt.cancel}</button>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className={styles.card} style={{ marginBottom: 14 }}>
            <div className={styles['card-head']}>
              <span className={styles['card-title']}>{tt.settingsTitle}</span>
              {savedFlash && <span className={styles['card-note']}>{tt.saved}</span>}
            </div>
            <div className={styles['card-body']}>
              <div className={styles['bt-form']}>
                <div className={styles.fld}>
                  <label className={styles['fld-l']}>{tt.riskPct}</label>
                  <input
                    type="number" min={0.1} max={10} step={0.1}
                    value={riskPct}
                    onChange={(e) => setRiskPct(+e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div className={styles.fld}>
                  <label className={styles['fld-l']}>{tt.minConfidence}</label>
                  <input
                    type="number" min={40} max={95} step={1}
                    value={minConfidence}
                    onChange={(e) => setMinConfidence(+e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div style={{ marginTop: 12 }}>
                <label className={styles['fld-l']}>{tt.allowedInstruments}</label>
                <div className={styles.chips} style={{ marginTop: 6 }}>
                  {status.supportedInstruments.map((sym) => (
                    <button
                      key={sym}
                      type="button"
                      className={`${styles.chip} ${selected.includes(sym) ? styles.on : ''}`}
                      onClick={() => toggleInstrument(sym)}
                    >
                      {sym}
                    </button>
                  ))}
                </div>
              </div>

              <button type="button" className={styles.btn} style={{ marginTop: 14 }} disabled={saving} onClick={saveSettings}>
                {tt.save}
              </button>
            </div>
          </div>

          <div className={styles.card} style={{ marginBottom: 14 }}>
            <div className={styles['card-head']}>
              <span className={styles['card-title']}>{tt.accountTitle}</span>
            </div>
            <div className={styles['card-body']}>
              {status.account ? (
                <div className={styles['stat-row']}>
                  <div className={styles.stat}>
                    <div className={styles['stat-l']}>{tt.balance}</div>
                    <div className={styles['stat-v']}>{num(status.account.balance, 2)}</div>
                  </div>
                  <div className={styles.stat}>
                    <div className={styles['stat-l']}>{tt.available}</div>
                    <div className={styles['stat-v']}>{num(status.account.available, 2)}</div>
                  </div>
                  <div className={styles.stat}>
                    <div className={styles['stat-l']}>{tt.unrealizedPl}</div>
                    <div className={`${styles['stat-v']} ${styles[cls(status.account.unrealizedPL)]}`}>{sign(status.account.unrealizedPL)}</div>
                  </div>
                  <div className={styles.stat}>
                    <div className={styles['stat-l']}>{tt.dailyPl}</div>
                    <div className={`${styles['stat-v']} ${styles[cls(status.dailyPl ?? 0)]}`}>
                      {status.dailyPl == null ? '—' : sign(status.dailyPl)}
                    </div>
                  </div>
                </div>
              ) : (
                <div className={styles.empty}>{tt.notConfigured}</div>
              )}
            </div>
          </div>

          <div className={styles.card} style={{ marginBottom: 14 }}>
            <div className={styles['card-head']}>
              <span className={styles['card-title']}>Demo test order</span>
            </div>
            <div className={styles['card-body']}>
              <div className={styles.warn}>
                <span>!</span>
                <span>Demo only: BUY BTCUSD, 0.01 lot, with a 2% stop and target.</span>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <button type="button" className={styles.btn} disabled={testBusy || !status.brokerConfigured} onClick={runDemoTestOrder}>
                  {testBusy ? 'Placing demo test...' : testConfirm ? 'Click again to confirm BTCUSD BUY' : 'Test BTCUSD BUY 0.01'}
                </button>
                {testConfirm && <span style={{ fontSize: '.74rem', color: 'var(--amber)' }}>Click again to confirm</span>}
              </div>
            </div>
          </div>
          <div className={styles.card} style={{ marginBottom: 14 }}>
            <div className={styles['card-head']}>
              <span className={styles['card-title']}>{tt.statsTitle}</span>
            </div>
            <div className={styles['card-body']}>
              {status.stats.closedCount === 0 ? (
                <div className={styles.empty}>{tt.notEnoughData}</div>
              ) : (
                <div className={styles['stat-row']}>
                  <div className={styles.stat}>
                    <div className={styles['stat-l']}>{tt.closedTrades}</div>
                    <div className={styles['stat-v']}>{status.stats.closedCount}</div>
                  </div>
                  <div className={styles.stat}>
                    <div className={styles['stat-l']}>{tt.winRate}</div>
                    <div className={styles['stat-v']}>{status.stats.winRatePct == null ? '—' : `${status.stats.winRatePct}%`}</div>
                  </div>
                  <div className={styles.stat}>
                    <div className={styles['stat-l']}>{tt.netRealizedPl}</div>
                    <div className={`${styles['stat-v']} ${styles[cls(status.stats.netRealizedPl)]}`}>{sign(status.stats.netRealizedPl)}</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className={styles.card} style={{ marginBottom: 14 }}>
            <div className={styles['card-head']}>
              <span className={styles['card-title']}>{tt.positionsTitle}</span>
            </div>
            <div className={styles['card-body']}>
              {positions.length === 0 ? (
                <div className={styles.empty}>{tt.noPositions}</div>
              ) : (
                <table className={styles['bt-table']}>
                  <thead>
                    <tr>
                      <th>{tt.table.instrument}</th>
                      <th>{tt.table.direction}</th>
                      <th>{tt.table.units}</th>
                      <th>{tt.table.pl}</th>
                      <th>{tt.table.action}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {positions.map((p) => {
                      const long = p.direction === 'BUY';
                      return (
                        <tr key={p.dealId}>
                          <td className={styles.mono}>{p.epic}</td>
                          <td><span className={`${styles.pill} ${styles[long ? 'bull' : 'bear']}`}>{long ? tt.long : tt.short}</span></td>
                          <td className={styles.mono}>{p.size}</td>
                          <td className={`${styles.mono} ${styles[cls(p.unrealizedPL)]}`}>{sign(p.unrealizedPL)}</td>
                          <td><button type="button" className={styles.sel} onClick={() => doClose(p.dealId)}>{tt.close}</button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles['card-head']}>
              <span className={styles['card-title']}>{tt.historyTitle}</span>
              <span className={styles['card-note']}>{tt.historyNote}</span>
            </div>
            <div className={styles['card-body']}>
              {history.length === 0 ? (
                <div className={styles.empty}>{tt.noHistory}</div>
              ) : (
                <div className={styles.reasons}>
                  {history.map((h, i) => (
                    <div className={styles.reason} key={i}>
                      <span
                        className={styles['reason-ico']}
                        style={{ color: h.action === 'order' ? 'var(--green)' : h.action === 'error' ? 'var(--bear)' : 'var(--dim)' }}
                      >
                        {h.action === 'order' ? '✓' : h.action === 'error' ? '✕' : '·'}
                      </span>
                      <span>
                        <b>{h.symbol}</b>{' '}
                        {h.action === 'order' ? tt.actionOrder : h.action === 'error' ? tt.actionError : tt.actionSkip}
                        {h.direction && h.direction !== 'Neutral' ? ` — ${h.direction === 'Bullish' ? tt.long : tt.short}` : ''}
                        {typeof h.confidence === 'number' ? ` — ${tt.confidenceLabel(h.confidence)}` : ''}
                        {h.reason ? <div style={{ color: 'var(--muted)', fontSize: '.72rem', marginTop: 2 }}>{tt.reasonLabel} {h.reason}</div> : null}
                        {h.error ? <div style={{ color: 'var(--bear)', fontSize: '.72rem', marginTop: 2 }}>{h.error}</div> : null}
                        {h.action === 'order' && (
                          <div style={{ marginTop: 2 }}>
                            {h.outcome ? (
                              <span
                                className={`${styles.pill} ${styles[h.outcome === 'win' ? 'bull' : h.outcome === 'loss' ? 'bear' : 'neutral']}`}
                              >
                                {h.outcome === 'win' ? tt.outcomeWin : h.outcome === 'loss' ? tt.outcomeLoss : h.outcome === 'breakeven' ? tt.outcomeBreakeven : tt.outcomeUnknown}
                                {typeof h.realizedPL === 'number' ? ` ${sign(h.realizedPL)}` : ''}
                              </span>
                            ) : h.tradeId ? (
                              <span style={{ fontSize: '.7rem', color: 'var(--dim)' }}>{tt.pendingOutcome}</span>
                            ) : null}
                          </div>
                        )}
                        <div style={{ color: 'var(--dim)', fontSize: '.68rem', marginTop: 2 }}>{new Date(h.at).toLocaleTimeString()}</div>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
