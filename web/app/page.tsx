import type { Metadata } from 'next';
import LandingPage from '@/components/landing/LandingPage';

export const metadata: Metadata = {
  title: 'Fiper Intelligence — Trade With Market Clarity',
};

export default function Home() {
  return <LandingPage />;
}
