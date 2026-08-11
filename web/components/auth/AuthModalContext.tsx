'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export type AuthTab = 'signin' | 'register';

interface AuthModalContextValue {
  isOpen: boolean;
  tab: AuthTab;
  open: (tab?: AuthTab) => void;
  close: () => void;
  setTab: (tab: AuthTab) => void;
}

const AuthModalContext = createContext<AuthModalContextValue | null>(null);

/* Wraps the landing page. Any descendant — Navbar's "Sign In"/"Get
   Access", Hero's "Get Access Now", any future CTA — calls useAuthModal()
   to open the shared modal on a given tab, instead of navigating to a
   /login or /register page (those routes still exist but just redirect
   to / now, see app/login/page.tsx and app/register/page.tsx). */
export function AuthModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [tab, setTab] = useState<AuthTab>('signin');

  const open = useCallback((initialTab: AuthTab = 'signin') => {
    setTab(initialTab);
    setIsOpen(true);
  }, []);
  const close = useCallback(() => setIsOpen(false), []);

  const value = useMemo(() => ({ isOpen, tab, open, close, setTab }), [isOpen, tab, open, close]);

  return <AuthModalContext.Provider value={value}>{children}</AuthModalContext.Provider>;
}

export function useAuthModal(): AuthModalContextValue {
  const ctx = useContext(AuthModalContext);
  if (!ctx) throw new Error('useAuthModal must be used within <AuthModalProvider>');
  return ctx;
}
