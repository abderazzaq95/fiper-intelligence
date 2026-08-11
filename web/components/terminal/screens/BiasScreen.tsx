'use client';

import styles from '../terminal.module.css';
import { useMarketData } from '@/lib/terminal/MarketDataProvider';
import type { MarketState } from '@/lib/terminal/marketData';
import { biasFor, bcls, buildReasons, type Bias, type Reason } from '@/lib/terminal/bias';
import { num, sign, cls, arrow } from '@/lib/terminal/format';
import { ChipGroup } from '../ChipGroup';
import { ChartWidget } from '../ChartWidget';
import { tvSymbol } from '@/lib/terminal/tradingview';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import type { Dictionary } from '@/lib/i18n/dictionaries';

const BIAS_LIST = ['NQUSD', 'ESUSD', 'XAUUSD', 'USOIL', 'BTCUSD', 'ETHUSD', 'DXY', 'DAX'] as const;

/* Arabic-only parallel to bias.ts's buildReasons() — bias.ts is never
   edited (CLAUDE.md constraint), so the Arabic sentences are
   reconstructed here from the exact same inputs (S, sym, b, q) using the
   exact same branch conditions as buildReasons(), just rendered through
   t.terminal.bias.reasons.* instead of the hardcoded English template
   literals. Every `if`/ternary below is a line-for-line mirror of
   bias.ts's buildReasons() — if that function's branching ever changes,
   this needs a matching update (flagged here + in the i18n common.ts
   header as the one place English/Arabic reason text can silently drift
   out of sync, since there's no shared type enforcing it). */
function buildReasonsAr(S: MarketState, sym: string, b: Bias, q: { chg: number }, t: Dictionary): Reason[] {
  const R: Reason[] = [];
  const risk = S.risk;
  const rs = t.terminal.bias.reasons;

  R.push(
    q.chg > 0
      ? { i: '▲', c: 'var(--green)', t: rs.upMomentum(sym, num(q.chg)) }
      : { i: '▼', c: 'var(--bear)', t: rs.downMomentum(sym, num(Math.abs(q.chg))) }
  );

  R.push(
    risk > 62
      ? { i: '◉', c: 'var(--green)', t: rs.riskHigh(Math.round(risk)) }
      : risk < 38
      ? { i: '◉', c: 'var(--bear)', t: rs.riskLow(Math.round(risk)) }
      : { i: '◉', c: 'var(--amber)', t: rs.riskBalanced(Math.round(risk)) }
  );

  const dxy = S.quotes.DXY?.chg ?? 0;
  if (sym !== 'DXY')
    R.push(
      dxy > 0
        ? { i: '$', c: 'var(--bear)', t: rs.dollarFirmer(sign(dxy)) }
        : { i: '$', c: 'var(--green)', t: rs.dollarSofter(sign(dxy)) }
    );

  const hi = S.news.filter((n) => n.imp === 'HIGH' && n.t.some((tag) => tag.startsWith(sym.slice(0, 3))));
  if (hi.length)
    R.push({ i: '◈', c: 'var(--red-hi)', t: rs.highImpactNews(hi.length, hi.length > 1 ? rs.headlines : rs.headline) });

  const up = S.events.filter((e) => !e.released && e.imp === 'HIGH');
  if (up.length)
    R.push({ i: '▤', c: 'var(--amber)', t: rs.upcomingEvent(up[0].n, up[0].ccy, up[0].t) });

  return R;
}

/* Ported from #s-bias + renderBiasScreen()/buildReasons(). biasSel is
   lifted to TerminalShell (not local state) because the Home screen's
   bias-card click must both switch to this screen AND select a symbol —
   same as the original's shared module-level `biasSel` variable. */
export function BiasScreen({ biasSel, setBiasSel }: { biasSel: string; setBiasSel: (s: string) => void }) {
  const S = useMarketData();
  const { t } = useLanguage();
  const q = S.quotes[biasSel] || S.crypto[biasSel];
  const b = biasFor(S, biasSel);

  return (
    <div className={styles['wide-screen']}>
      <div style={{ marginBottom: 14 }}>
        <ChipGroup options={BIAS_LIST} value={biasSel as (typeof BIAS_LIST)[number]} onChange={setBiasSel} />
      </div>

      {!q || !b ? (
        <div className={styles.card}>
          <div className={styles.empty}>{t.terminal.bias.noData}</div>
        </div>
      ) : (
        <BiasDetail S={S} sym={biasSel} q={q} b={b} />
      )}
    </div>
  );
}

function BiasDetail({ S, sym, q, b }: { S: ReturnType<typeof useMarketData>; sym: string; q: { price: number; chg: number; hist?: number[]; name?: string }; b: NonNullable<ReturnType<typeof biasFor>> }) {
  const { t, lang, dir } = useLanguage();
  const col = b.dir === 'Bullish' ? 'var(--green)' : b.dir === 'Bearish' ? 'var(--bear)' : 'var(--amber)';
  const px = q.price;
  // English keeps bias.ts's buildReasons() output verbatim; Arabic uses the
  // parallel buildReasonsAr() above (see BiasScreen path-3a note in the
  // migration report — bias.ts itself is never touched).
  const reasons = lang === 'ar' ? buildReasonsAr(S, sym, b, q, t) : buildReasons(S, sym, b, q);

  const levels: [string, number, string][] = [
    [t.terminal.bias.levels.resistance2, px * 1.018, 'var(--bear)'],
    [t.terminal.bias.levels.resistance1, px * 1.009, 'var(--bear)'],
    [t.terminal.bias.levels.current, px, 'var(--text)'],
    [t.terminal.bias.levels.support1, px * 0.991, 'var(--green)'],
    [t.terminal.bias.levels.support2, px * 0.982, 'var(--green)'],
  ];

  return (
    <>
      {/* Chart hero — fills full width above everything else, not boxed
          into bh-main's padding, matching the terminal-first layout the
          rest of the screen (direction/confidence/levels/reasons) sits
          below. */}
      <div className={styles.card} style={{ marginBottom: 14 }}>
        <div className={styles['cndl-wrap']} style={{ borderRadius: 12 }}>
          <ChartWidget symbol={tvSymbol(sym)} interval="60" locale={lang} height={480} />
        </div>
      </div>

      <div className={styles['bias-hero']} style={{ marginBottom: 14 }}>
        <div className={`${styles.card} ${styles['bh-main']}`}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '.68rem', fontWeight: 800, letterSpacing: '.13em', textTransform: 'uppercase', color: 'var(--dim)' }}>
                {t.terminal.bias.todaySuffix(q.name || sym)}
              </div>
              <div className={styles['bh-dir']} style={{ color: col }}>{t.common.direction[b.dir]}</div>
              <div className={styles['bh-conf']}>
                <span style={{ fontSize: '.68rem', color: 'var(--muted)' }}>{t.terminal.bias.confidence}</span>
                <span className={styles['conf-track']}><span className={styles['conf-fill']} style={{ width: b.conf + '%', background: col }} /></span>
                <span className={styles.mono} style={{ fontSize: '.78rem', fontWeight: 700, color: col }}>{Math.round(b.conf)}%</span>
              </div>
            </div>
            <div style={{ marginInlineStart: 'auto', textAlign: 'right' }}>
              <div className={styles.mono} style={{ fontSize: '1.7rem', fontWeight: 600 }}>{num(px, px > 1000 ? 2 : px > 10 ? 2 : 4)}</div>
              <div className={`${styles.mono} ${styles[cls(q.chg)]}`} style={{ fontSize: '.85rem', fontWeight: 600 }}>{arrow(q.chg, dir)} {sign(q.chg)}%</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 9, marginTop: 14, flexWrap: 'wrap' }}>
            <span className={`${styles.pill} ${styles[bcls(b.swing)]}`}>{t.terminal.bias.swingLine(t.common.direction[b.swing as keyof typeof t.common.direction])}</span>
            <span className={`${styles.pill} ${styles[bcls(b.day)]}`}>{t.terminal.bias.dayLine(t.common.direction[b.day as keyof typeof t.common.direction])}</span>
            <span className={`${styles.pill} ${styles.neutral}`}>{t.terminal.bias.riskGaugeLine(Math.round(S.risk))}</span>
          </div>
        </div>
        <div className={styles.card}>
          <div className={styles['card-head']}><span className={styles['card-title']}>{t.terminal.bias.keyLevels}</span></div>
          <div className={styles.levels}>
            {levels.map(([l, v, c]) => (
              <div className={styles.lvl} key={l}>
                <span className={styles['lvl-l']}>{l}</span>
                <span className={styles['lvl-v']} style={{ color: c }}>{num(v, v > 1000 ? 2 : v > 10 ? 2 : 4)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className={styles.card}>
        <div className={styles['card-head']}>
          <span className={styles['card-title']}>{t.terminal.bias.whatsDrivingIt}</span>
          <span className={styles['card-note']}>{t.terminal.bias.derivedNote}</span>
        </div>
        <div className={styles['card-body']}>
          <div className={styles.reasons}>
            {reasons.map((r, i) => (
              <div className={styles.reason} key={i}>
                <span className={styles['reason-ico']} style={{ color: r.c }}>{r.i}</span>
                {/* r.t is static computed copy (never user input) — see bias.ts */}
                <span dangerouslySetInnerHTML={{ __html: r.t }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
