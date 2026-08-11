/* UI copy for the landing page. Fabricated "real content" — the fake news
   headlines baked into data/news-items.ts and AnimatedTerminalDemo, and
   the testimonial quotes/handles in data/testimonials.ts — is NOT
   translated here (per the explicit exclusion list: news headlines stay
   in their original language). Only UI chrome (nav, headings, buttons,
   static section copy) is covered. */

export const en = {
  navbar: {
    features: 'Features',
    howItWorks: 'How It Works',
    faq: 'FAQ',
    resources: 'Resources',
    signIn: 'Sign In',
    getAccess: 'Get Access',
  },

  hero: {
    eyebrow: 'AI-Powered Market Intelligence',
    headlineStart: 'See What The Market Is About To Do — ',
    headlineEm: 'Before Most Traders Even React',
    sub: 'Macro, news, and market signals turned into clear trade direction. Instantly. No economics degree. No second-guessing.',
    getAccessNow: 'Get Access Now',
    seeHowItWorks: 'See How It Works',
    proofBold: '10,000+ traders',
    proofRest: ' already trading with clarity',
  },

  /* UI-chrome labels inside the hero's self-driving terminal demo
     (AnimatedTerminalDemo.tsx). The fake headline text and fake
     breaking-news popup copy are NOT here — those stay English per the
     "don't translate fabricated news content" rule. This is only the
     generic badge/label chrome wrapped around that fake content. */
  heroDemo: {
    highImpact: 'HIGH IMPACT',
    justNow: 'Just now',
    swingTrading: 'Swing Trading',
    dayTrading: 'Day Trading',
    slightlyBullish: 'Slightly Bullish',
    target: 'TARGET',
    targetReached: 'TARGET REACHED',
    pullbackArea: 'Pullback Area',
  },

  problem: {
    eyebrow: 'The Problem',
    headline1: "The Market Doesn't Lack Information.",
    headline2: 'It Lacks Clarity.',
    sub: 'Every trader sees the same data. News hits. Indicators move. Charts react. But knowing what it means — and how to act — is where most traders struggle and lose edge.',
    cta: 'Show Me The Solution',
  },

  beforeAfter: {
    eyebrow: 'The Difference',
    headline: 'Markets Move on Interpretation, Not News',
    sub: 'Everyone sees the same release. The edge is understanding what it means before the market prices it in.',
    beforeLabel: '❌ Raw Data — What you had before',
    afterLabel: '✅ Fiper Intelligence — Actionable insight',
    tableHeaders: { time: 'Time', event: 'Event', prev: 'Prev', fore: 'Fore' },
    zeroContext: '↑ Numbers with zero context. What does 0.3% mean for your trade?',
    event1Name: 'CPI m/m — 08:30 EST',
    event1Bias: 'BEARISH USD',
    event1Context: 'Actual 0.4% vs forecast 0.2% — hot surprise. Dollar strength likely. Watch EURUSD for short opportunity, gold under pressure.',
    event2Name: 'FOMC Minutes — 14:00 EST',
    event2Bias: 'BULLISH NQ',
    event2Context: 'Minutes show dovish lean — 3 members pushed back on rate hike. Risk-on environment expected. Tech likely to rally into close.',
  },

  howItWorks: {
    eyebrow: 'How It Works',
    headline: 'From Raw Data to Clear Direction in Seconds',
    sub: 'No analysis loop. No hesitation. Just a clear plan the moment it matters.',
    steps: [
      {
        title: 'Aggregates Global Market Data',
        desc: 'News, economic releases, central bank signals, and cross-market activity pulled in real time from Reuters, Bloomberg, LSEG, and CME.',
      },
      {
        title: 'AI Interprets Impact & Sentiment',
        desc: 'Identifies what matters, what was expected vs surprised, and how price is likely to react — mapped to specific assets — before the market moves.',
      },
      {
        title: 'You Get Clear Direction',
        desc: "Bias, scenarios, and risk zones delivered instantly. No extra analysis needed. You own the understanding — not a dependency on someone else's signal.",
      },
    ],
  },

  testimonials: {
    eyebrow: 'Social Proof',
    headline: 'Thousands of Traders Already Using This Edge',
  },

  compare: {
    eyebrow: 'Why Fiper Intelligence',
    headline1: 'Signals Keep You Dependent.',
    headline2: 'We Give You the Edge You Own.',
    sub: 'Following someone else’s trades is not a strategy. Understanding the market is.',
    signalsTitle: 'Signal Services',
    signalsSub: 'No context. No understanding. Just instructions.',
    oursTitle: 'Fiper Intelligence',
    oursSub: 'Context. Direction. Yours to keep.',
    recommended: 'RECOMMENDED',
    signalItems: [
      'No explanation — just instructions to follow',
      'Breaks when market conditions shift',
      'Builds dependency, not skill',
      'Zero macro or fundamental context',
      'You never learn why the market moved',
    ],
    ourItems: [
      'Tells you exactly why price is moving',
      'Works across any market condition',
      'You own the understanding, not the trade',
      'Macro to price signal, instantly',
      'Builds real trading edge over time',
    ],
  },

  footer: {
    tagline: 'Unlock smarter, faster trading with AI-powered market intelligence. Built for retail traders who want institutional clarity.',
    platform: 'Platform',
    platformLinks: ['Features', 'FAQ', 'Insights & Blog', 'Affiliates'],
    features: 'Features',
    featuresLinks: ['Daily Bias', 'Capital Flows', 'Economic Calendar', 'COT Data', 'Price Forecasts'],
    markets: 'Markets',
    marketsLinks: ['Forex Fundamentals', 'Crypto Analysis', 'Futures Trading', 'Stock Analysis', 'Indices'],
    copyright: (year: number) => `© ${year} Fiper Intelligence. All rights reserved.`,
    disclaimer: 'Fiper Intelligence is a market intelligence and data analytics platform. We are not a brokerage, investment advisor, or financial institution. The platform provides AI-powered analysis of market events for informational purposes only. Trading CFDs involves a high level of risk and may not be suitable for all investors.',
  },
};

export const ar: typeof en = {
  navbar: {
    features: 'المزايا',
    howItWorks: 'كيف يعمل',
    faq: 'الأسئلة الشائعة',
    resources: 'الموارد',
    signIn: 'تسجيل الدخول',
    getAccess: 'احصل على الوصول',
  },

  hero: {
    eyebrow: 'استخبارات سوقية مدعومة بالذكاء الاصطناعي',
    headlineStart: 'اعرف ما يوشك السوق على فعله — ',
    headlineEm: 'قبل أن يتفاعل معظم المتداولين',
    sub: 'إشارات الاقتصاد الكلي والأخبار والسوق تتحول إلى اتجاه تداول واضح. فورًا. دون الحاجة لشهادة اقتصاد. ودون تردد.',
    getAccessNow: 'احصل على الوصول الآن',
    seeHowItWorks: 'شاهد كيف يعمل',
    proofBold: 'أكثر من 10,000 متداول',
    proofRest: ' يتداولون بوضوح بالفعل',
  },

  heroDemo: {
    highImpact: 'تأثير مرتفع',
    justNow: 'الآن',
    swingTrading: 'تداول التأرجح',
    dayTrading: 'التداول اليومي',
    slightlyBullish: 'صعودي طفيف',
    target: 'الهدف',
    targetReached: 'تم بلوغ الهدف',
    pullbackArea: 'منطقة الارتداد',
  },

  problem: {
    eyebrow: 'المشكلة',
    headline1: 'السوق لا ينقصه المعلومات.',
    headline2: 'ما ينقصه هو الوضوح.',
    sub: 'كل متداول يرى نفس البيانات. الأخبار تصدر. المؤشرات تتحرك. الرسوم البيانية تتفاعل. لكن معرفة ما تعنيه — وكيفية التصرف بناءً عليها — هي حيث يعاني معظم المتداولين ويخسرون ميزتهم.',
    cta: 'أرني الحل',
  },

  beforeAfter: {
    eyebrow: 'الفرق',
    headline: 'الأسواق تتحرك بالتفسير لا بالخبر',
    sub: 'الجميع يرى نفس الإصدار. الميزة هي فهم ما يعنيه قبل أن يسعّره السوق.',
    beforeLabel: '❌ بيانات خام — ما كان لديك سابقًا',
    afterLabel: '✅ فايبر إنتليجنس — رؤية قابلة للتنفيذ',
    tableHeaders: { time: 'الوقت', event: 'الحدث', prev: 'سابق', fore: 'متوقع' },
    zeroContext: '↑ أرقام دون أي سياق. ماذا تعني نسبة 0.3% لصفقتك؟',
    event1Name: 'مؤشر أسعار المستهلك الشهري — 08:30 بتوقيت شرق أمريكا',
    event1Bias: 'هبوطي للدولار',
    event1Context: 'النتيجة الفعلية 0.4% مقابل توقع 0.2% — مفاجأة ساخنة. قوة الدولار مرجحة. راقب اليورو دولار لفرصة بيع، والذهب تحت ضغط.',
    event2Name: 'محضر اجتماع الفيدرالي — 14:00 بتوقيت شرق أمريكا',
    event2Bias: 'صعودي للناسداك',
    event2Context: 'المحضر يظهر ميلًا تيسيريًا — 3 أعضاء عارضوا رفع الفائدة. بيئة إقبال على المخاطرة متوقعة. القطاع التقني مرجح أن يرتفع قبل الإغلاق.',
  },

  howItWorks: {
    eyebrow: 'كيف يعمل',
    headline: 'من البيانات الخام إلى اتجاه واضح خلال ثوانٍ',
    sub: 'دون حلقة تحليل. دون تردد. مجرد خطة واضحة في اللحظة التي تهم فيها.',
    steps: [
      {
        title: 'يجمع بيانات السوق العالمية',
        desc: 'الأخبار والإصدارات الاقتصادية وإشارات البنوك المركزية ونشاط الأسواق المتقاطعة، مسحوبة لحظيًا من رويترز وبلومبرغ و LSEG و CME.',
      },
      {
        title: 'الذكاء الاصطناعي يفسر التأثير والمعنويات',
        desc: 'يحدد ما يهم، وما كان متوقعًا مقابل ما فاجأ السوق، وكيف يُرجَّح أن يتفاعل السعر — مربوطًا بأصول محددة — قبل أن يتحرك السوق.',
      },
      {
        title: 'تحصل على اتجاه واضح',
        desc: 'التحيز والسيناريوهات ومناطق المخاطرة تصلك فورًا. دون تحليل إضافي. أنت من يملك الفهم — لا اعتمادًا على إشارة شخص آخر.',
      },
    ],
  },

  testimonials: {
    eyebrow: 'إثبات اجتماعي',
    headline: 'آلاف المتداولين يستخدمون هذه الميزة بالفعل',
  },

  compare: {
    eyebrow: 'لماذا فايبر إنتليجنس',
    headline1: 'الإشارات تُبقيك معتمدًا على غيرك.',
    headline2: 'نحن نمنحك الميزة التي تملكها أنت.',
    sub: 'اتّباع صفقات شخص آخر ليس استراتيجية. فهم السوق هو الاستراتيجية.',
    signalsTitle: 'خدمات الإشارات',
    signalsSub: 'دون سياق. دون فهم. مجرد تعليمات.',
    oursTitle: 'فايبر إنتليجنس',
    oursSub: 'سياق. اتجاه. ميزة تبقى لك.',
    recommended: 'موصى به',
    signalItems: [
      'دون شرح — مجرد تعليمات يجب اتباعها',
      'تتعطل عند تغير ظروف السوق',
      'تبني اعتمادًا لا مهارة',
      'دون سياق اقتصادي كلي أو أساسي',
      'لن تتعلم أبدًا لماذا تحرك السوق',
    ],
    ourItems: [
      'يخبرك بالضبط لماذا يتحرك السعر',
      'يعمل في أي ظرف سوقي',
      'أنت تملك الفهم، لا مجرد الصفقة',
      'من الاقتصاد الكلي إلى إشارة السعر، فورًا',
      'يبني ميزة تداول حقيقية بمرور الوقت',
    ],
  },

  footer: {
    tagline: 'افتح الباب لتداول أذكى وأسرع مع استخبارات سوقية مدعومة بالذكاء الاصطناعي. مصممة لمتداولي التجزئة الباحثين عن وضوح بمستوى المؤسسات.',
    platform: 'المنصة',
    platformLinks: ['المزايا', 'الأسئلة الشائعة', 'رؤى ومدونة', 'الشراكات'],
    features: 'المزايا',
    featuresLinks: ['التحيز اليومي', 'التدفقات الرأسمالية', 'التقويم الاقتصادي', 'بيانات لجنة العقود الآجلة', 'توقعات الأسعار'],
    markets: 'الأسواق',
    marketsLinks: ['أساسيات الفوركس', 'تحليل العملات الرقمية', 'تداول العقود الآجلة', 'تحليل الأسهم', 'المؤشرات'],
    copyright: (year: number) => `© ${year} فايبر إنتليجنس. جميع الحقوق محفوظة.`,
    disclaimer: 'فايبر إنتليجنس منصة استخبارات سوقية وتحليل بيانات. نحن لسنا شركة وساطة أو مستشارًا استثماريًا أو مؤسسة مالية. توفر المنصة تحليلًا مدعومًا بالذكاء الاصطناعي لأحداث السوق لأغراض إعلامية فقط. تداول عقود الفروقات ينطوي على مستوى مرتفع من المخاطرة وقد لا يكون مناسبًا لجميع المستثمرين.',
  },
};
