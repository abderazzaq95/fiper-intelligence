import type { Metadata } from 'next';
import { MarketDataProvider } from '@/lib/terminal/MarketDataProvider';
import { TerminalShell } from '@/components/terminal/TerminalShell';

export const metadata: Metadata = {
  title: 'Fiper Intelligence — Terminal',
};

/* Ported from fiper-terminal.html. Client-rendered SPA-feeling dashboard
   — MarketDataProvider owns the boot()-equivalent fetch/refresh cycle,
   TerminalShell owns which of the 12 always-mounted screens is visible. */
export default function TerminalPage() {
  return (
    <MarketDataProvider>
      <TerminalShell />
    </MarketDataProvider>
  );
}
