'use client';

import { useEffect } from 'react';
import styles from './landing.module.css';

/**
 * Ported from the original's global "SCROLL REVEAL" script: scans the DOM
 * for every `.reveal` element already rendered and fades each one in the
 * first time it crosses the viewport. Mounted once by LandingPage.
 */
export default function ScrollReveal() {
  useEffect(() => {
    const revealEls = document.querySelectorAll(`.${styles.reveal}`);
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add(styles.visible);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    revealEls.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return null;
}
