import styles from './landing.module.css';
import Navbar from './Navbar';
import Hero from './Hero';
import PartnersMarquee from './PartnersMarquee';
import Problem from './Problem';
import BeforeAfter from './BeforeAfter';
import HowItWorks from './HowItWorks';
import Testimonials from './Testimonials';
import Compare from './Compare';
import Footer from './Footer';
import ScrollReveal from './ScrollReveal';
import { AuthModalProvider } from '@/components/auth/AuthModalContext';
import { AuthModal } from '@/components/auth/AuthModal';

export default function LandingPage() {
  return (
    <AuthModalProvider>
      <div className={styles.landingRoot}>
        <ScrollReveal />
        <Navbar />
        <Hero />
        <PartnersMarquee />
        <Problem />
        <BeforeAfter />
        <HowItWorks />
        <Testimonials />
        <Compare />
        <Footer />
      </div>
      <AuthModal />
    </AuthModalProvider>
  );
}
