/* ══════════════════════════════════════════════════════════════
   Canonical-string lookup maps — NOT a general translation dictionary.
   These translate DATA-LAYER strings that also double as CSS-class keys
   or logic branches (bias.ts's bcls() substring-matches 'Bull'/'Bear' on
   the exact English `dir`/`swing` text; SourceBadge's `mode` prop is
   already a stable key; candle pattern names are returned verbatim by
   candles.ts). bias.ts/candles.ts/backtest.ts/format.ts are NEVER edited
   to return Arabic — translation happens only here, at the render
   boundary, keyed by the exact English string those files already
   return. If bias.ts/candles.ts ever changes its literal English output,
   these maps need a matching update (a TS error will NOT catch that
   drift automatically, since the keys are plain strings, not a shared
   union type — flagged as the one place this dictionary can silently
   fall out of sync with the data layer).
══════════════════════════════════════════════════════════════ */

import type { ScreenKey } from '@/lib/terminal/routes';

export const en = {
  // bias.ts `dir` (Bullish/Bearish/Neutral) and the 5-way `swing`/`day`
  direction: {
    Bullish: 'Bullish',
    Bearish: 'Bearish',
    Neutral: 'Neutral',
    'Slightly Bullish': 'Slightly Bullish',
    'Slightly Bearish': 'Slightly Bearish',
  },

  // Gauge.tsx risk-state readout (all-caps) vs. scale labels (title-case)
  // — genuinely two different English strings for the same concept.
  riskState: {
    'RISK ON': 'RISK ON',
    'RISK OFF': 'RISK OFF',
    NEUTRAL: 'NEUTRAL',
  },
  riskScale: {
    'Risk On': 'Risk On',
    'Risk Off': 'Risk Off',
    Neutral: 'Neutral',
  },

  // computeRisk() theme names
  theme: {
    Inflation: 'Inflation',
    Growth: 'Growth',
    Geopolitics: 'Geopolitics',
    Rates: 'Rates',
  },

  // SourceBadge default labels + the explicit label= overrides screens pass
  badge: {
    Live: 'Live',
    Stale: 'Stale',
    Model: 'Model',
    Reconnecting: 'Reconnecting',
    Polling: 'Polling',
    'Binance Live': 'Binance Live',
    'ECB Live': 'ECB Live',
    'CFTC Live': 'CFTC Live',
    Yahoo: 'Yahoo',
  },

  // NewsCard / calendar impact pills — data values are HIGH/MED/LOW
  impact: {
    HIGH: 'HIGH',
    MED: 'MED',
    LOW: 'LOW',
  },
  impactSuffix: 'IMPACT',

  // candles.ts pattern names (`n`) + descriptions (`d`), exact keys
  pattern: {
    Doji: 'Doji',
    Hammer: 'Hammer',
    'Hanging Man': 'Hanging Man',
    'Inverted Hammer': 'Inverted Hammer',
    'Shooting Star': 'Shooting Star',
    'Bullish Engulfing': 'Bullish Engulfing',
    'Bearish Engulfing': 'Bearish Engulfing',
    'Piercing Line': 'Piercing Line',
    'Dark Cloud Cover': 'Dark Cloud Cover',
    'Bullish Marubozu': 'Bullish Marubozu',
    'Bearish Marubozu': 'Bearish Marubozu',
  },
  patternDesc: {
    'Open and close are nearly equal — buyers and sellers finished the period in balance. On its own it signals indecision; it matters most when it appears after an extended run.':
      'Open and close are nearly equal — buyers and sellers finished the period in balance. On its own it signals indecision; it matters most when it appears after an extended run.',
    'Price was pushed well below the open then bought back before the close. Sellers tried and failed to hold the lows.':
      'Price was pushed well below the open then bought back before the close. Sellers tried and failed to hold the lows.',
    'Same long lower wick as a hammer, but forming into strength. Buyers had to defend a sharp intraperiod drop.':
      'Same long lower wick as a hammer, but forming into strength. Buyers had to defend a sharp intraperiod drop.',
    'Buyers drove price high but could not hold it. In a downtrend this often precedes a reversal attempt.':
      'Buyers drove price high but could not hold it. In a downtrend this often precedes a reversal attempt.',
    'A rally into the period was completely rejected before the close. Supply is sitting above.':
      'A rally into the period was completely rejected before the close. Supply is sitting above.',
    'This candle fully covers the prior down candle. Demand overwhelmed the previous period of selling.':
      'This candle fully covers the prior down candle. Demand overwhelmed the previous period of selling.',
    'This candle fully covers the prior up candle. Supply overwhelmed the previous period of buying.':
      'This candle fully covers the prior up candle. Supply overwhelmed the previous period of buying.',
    'Opened below the prior close but recovered past its midpoint. Partial reversal of the previous move.':
      'Opened below the prior close but recovered past its midpoint. Partial reversal of the previous move.',
    'Opened above the prior close then gave back more than half of it. Momentum stalling.':
      'Opened above the prior close then gave back more than half of it. Momentum stalling.',
    'Almost no wicks — price opened at the low and closed at the high. One-directional conviction.':
      'Almost no wicks — price opened at the low and closed at the high. One-directional conviction.',
    'Almost no wicks — price opened at the high and closed at the low. One-directional conviction.':
      'Almost no wicks — price opened at the high and closed at the low. One-directional conviction.',
  },
  strength: {
    Strong: 'Strong',
    Moderate: 'Moderate',
  },

  // relative time — format.ts's ago(). Simplified: one Arabic plural form
  // used across all N rather than full singular/dual/plural agreement
  // (a deliberate, common simplification — see summary).
  ago: {
    justNow: 'just now',
    minAgo: (m: number) => `${m} min ago`,
    hourMinAgo: (h: number, m: number) => `${h}h ${m}m ago`,
  },

  // breadcrumb [group, name] + sidebar nav label, keyed by ScreenKey —
  // NOT by the English text in routes.ts, so routes.ts itself is never
  // touched and this can't drift out of key-sync (TS enforces the
  // Record<ScreenKey, ...> is total).
  breadcrumb: {
    home: ['Overview', 'Home'],
    headlines: ['Market Pulse', 'Live Headlines'],
    calendar: ['Market Pulse', 'Economic Calendar'],
    bias: ['Market Pulse', 'Daily Bias'],
    global: ['Markets', 'Global Markets'],
    flows: ['Markets', 'Capital Flows'],
    cot: ['Markets', 'COT Positioning'],
    forecasts: ['Markets', 'Price Forecasts'],
    candles: ['Research', 'Candle Analysis'],
    backtest: ['Research', 'Fundamental Backtesting'],
    stocks: ['Research', 'Stock Research'],
    crypto: ['Research', 'Crypto Macro'],
  } as Record<ScreenKey, [string, string]>,
  navLabel: {
    home: 'Home',
    headlines: 'Live Headlines',
    calendar: 'Economic Calendar',
    bias: 'Daily Bias',
    global: 'Global Markets',
    flows: 'Capital Flows',
    cot: 'COT Positioning',
    forecasts: 'Price Forecasts',
    candles: 'Candle Analysis',
    backtest: 'Backtesting',
    stocks: 'Stock Research',
    crypto: 'Crypto Macro',
  } as Record<ScreenKey, string>,
  navGroup: {
    'Market Pulse': 'Market Pulse',
    Markets: 'Markets',
    Research: 'Research',
  },
};

export const ar: typeof en = {
  direction: {
    Bullish: 'صعودي',
    Bearish: 'هبوطي',
    Neutral: 'محايد',
    'Slightly Bullish': 'صعودي طفيف',
    'Slightly Bearish': 'هبوطي طفيف',
  },

  riskState: {
    'RISK ON': 'إقبال على المخاطرة',
    'RISK OFF': 'تجنب المخاطرة',
    NEUTRAL: 'محايد',
  },
  riskScale: {
    'Risk On': 'إقبال على المخاطرة',
    'Risk Off': 'تجنب المخاطرة',
    Neutral: 'محايد',
  },

  theme: {
    Inflation: 'التضخم',
    Growth: 'النمو',
    Geopolitics: 'الجغرافيا السياسية',
    Rates: 'أسعار الفائدة',
  },

  badge: {
    Live: 'مباشر',
    Stale: 'متأخر',
    Model: 'نموذج',
    Reconnecting: 'إعادة الاتصال',
    Polling: 'استقصاء دوري',
    'Binance Live': 'بينانس مباشر',
    'ECB Live': 'البنك المركزي الأوروبي مباشر',
    'CFTC Live': 'لجنة تداول العقود الآجلة مباشر',
    Yahoo: 'ياهو',
  },

  impact: {
    HIGH: 'مرتفع',
    MED: 'متوسط',
    LOW: 'منخفض',
  },
  impactSuffix: 'تأثير',

  pattern: {
    Doji: 'دوجي',
    Hammer: 'المطرقة',
    'Hanging Man': 'الرجل المشنوق',
    'Inverted Hammer': 'المطرقة المقلوبة',
    'Shooting Star': 'الشهاب',
    'Bullish Engulfing': 'الابتلاع الصعودي',
    'Bearish Engulfing': 'الابتلاع الهبوطي',
    'Piercing Line': 'خط الاختراق',
    'Dark Cloud Cover': 'غطاء السحابة الداكنة',
    'Bullish Marubozu': 'ماروبوزو صعودي',
    'Bearish Marubozu': 'ماروبوزو هبوطي',
  },
  patternDesc: {
    'Open and close are nearly equal — buyers and sellers finished the period in balance. On its own it signals indecision; it matters most when it appears after an extended run.':
      'سعرا الافتتاح والإغلاق متقاربان تقريبًا — أنهى المشترون والبائعون الفترة في حالة توازن. بمفردها تشير إلى التردد، وتكتسب أهميتها الكبرى عند ظهورها بعد اتجاه ممتد.',
    'Price was pushed well below the open then bought back before the close. Sellers tried and failed to hold the lows.':
      'انخفض السعر بشكل كبير دون الافتتاح ثم أعيد شراؤه قبل الإغلاق. حاول البائعون الدفاع عن القيعان ولكنهم فشلوا.',
    'Same long lower wick as a hammer, but forming into strength. Buyers had to defend a sharp intraperiod drop.':
      'نفس الظل السفلي الطويل الخاص بالمطرقة، لكنه يتشكل في مرحلة قوة. اضطر المشترون للدفاع عن هبوط حاد خلال الفترة.',
    'Buyers drove price high but could not hold it. In a downtrend this often precedes a reversal attempt.':
      'دفع المشترون السعر للأعلى لكنهم لم يتمكنوا من الحفاظ عليه. في الاتجاه الهابط، غالبًا ما يسبق هذا محاولة انعكاس.',
    'A rally into the period was completely rejected before the close. Supply is sitting above.':
      'تم رفض الصعود خلال الفترة بالكامل قبل الإغلاق. العرض يخيم من الأعلى.',
    'This candle fully covers the prior down candle. Demand overwhelmed the previous period of selling.':
      'هذه الشمعة تغطي بالكامل الشمعة الهابطة السابقة. الطلب تغلب على فترة البيع السابقة.',
    'This candle fully covers the prior up candle. Supply overwhelmed the previous period of buying.':
      'هذه الشمعة تغطي بالكامل الشمعة الصاعدة السابقة. العرض تغلب على فترة الشراء السابقة.',
    'Opened below the prior close but recovered past its midpoint. Partial reversal of the previous move.':
      'افتتحت دون الإغلاق السابق لكنها تعافت متجاوزة نقطة المنتصف. انعكاس جزئي للحركة السابقة.',
    'Opened above the prior close then gave back more than half of it. Momentum stalling.':
      'افتتحت أعلى من الإغلاق السابق ثم تراجعت لأكثر من نصف تلك الحركة. الزخم يتباطأ.',
    'Almost no wicks — price opened at the low and closed at the high. One-directional conviction.':
      'ظلال شبه معدومة — افتتح السعر عند القاع وأغلق عند القمة. قناعة أحادية الاتجاه.',
    'Almost no wicks — price opened at the high and closed at the low. One-directional conviction.':
      'ظلال شبه معدومة — افتتح السعر عند القمة وأغلق عند القاع. قناعة أحادية الاتجاه.',
  },
  strength: {
    Strong: 'قوي',
    Moderate: 'متوسط',
  },

  ago: {
    justNow: 'الآن',
    minAgo: (m: number) => `منذ ${m} دقيقة`,
    hourMinAgo: (h: number, m: number) => `منذ ${h}س ${m}د`,
  },

  breadcrumb: {
    home: ['نظرة عامة', 'الرئيسية'],
    headlines: ['نبض السوق', 'آخر الأخبار'],
    calendar: ['نبض السوق', 'التقويم الاقتصادي'],
    bias: ['نبض السوق', 'التحيز اليومي'],
    global: ['الأسواق', 'الأسواق العالمية'],
    flows: ['الأسواق', 'التدفقات الرأسمالية'],
    cot: ['الأسواق', 'مراكز الملتزمين بالتداول'],
    forecasts: ['الأسواق', 'توقعات الأسعار'],
    candles: ['الأبحاث', 'تحليل الشموع'],
    backtest: ['الأبحاث', 'الاختبار الأساسي التاريخي'],
    stocks: ['الأبحاث', 'أبحاث الأسهم'],
    crypto: ['الأبحاث', 'اقتصاد العملات الرقمية الكلي'],
  },
  navLabel: {
    home: 'الرئيسية',
    headlines: 'آخر الأخبار',
    calendar: 'التقويم الاقتصادي',
    bias: 'التحيز اليومي',
    global: 'الأسواق العالمية',
    flows: 'التدفقات الرأسمالية',
    cot: 'مراكز الملتزمين بالتداول',
    forecasts: 'توقعات الأسعار',
    candles: 'تحليل الشموع',
    backtest: 'الاختبار التاريخي',
    stocks: 'أبحاث الأسهم',
    crypto: 'اقتصاد العملات الرقمية الكلي',
  },
  navGroup: {
    'Market Pulse': 'نبض السوق',
    Markets: 'الأسواق',
    Research: 'الأبحاث',
  },
};
