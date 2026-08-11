'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { dictionaries, type Dictionary } from './dictionaries';

export type Lang = 'en' | 'ar';
const STORAGE_KEY = 'fiper-lang';

interface LanguageContextValue {
  lang: Lang;
  dir: 'ltr' | 'rtl';
  setLang: (lang: Lang) => void;
  t: Dictionary;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function applyDom(lang: Lang) {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
}

/* Wraps the whole app (app/layout.tsx). The server always renders English
   (no access to localStorage), so the initial client render must also be
   English — reading localStorage inside the useState initializer would
   make the client's first render diverge from the server HTML and trigger
   a React hydration-mismatch (React then discards the SSR output and
   redoes the whole tree client-side). Instead, state starts at 'en' to
   match SSR exactly, and a mount-only effect below syncs it from
   localStorage right after hydration finishes — a one-frame swap to
   Arabic text on reload (if AR was persisted), not a hydration error. The
   anti-flash inline script in layout.tsx still sets the <html> dir/lang
   attributes before paint, so only the RTL/font/DOM-order layout is
   flash-free; the translated text itself briefly shows English on a hard
   refresh in Arabic mode, same tradeoff every theme/locale-persisting
   library without server-side cookies makes. */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'ar') setLangState('ar');
  }, []);

  useEffect(() => {
    applyDom(lang);
  }, [lang]);

  const setLang = (next: Lang) => {
    setLangState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
    applyDom(next);
  };

  const value = useMemo<LanguageContextValue>(
    () => ({ lang, dir: lang === 'ar' ? 'rtl' : 'ltr', setLang, t: dictionaries[lang] }),
    [lang]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within <LanguageProvider>');
  return ctx;
}
