'use client';

import { useEffect } from 'react';
import Script from 'next/script';

declare global {
  interface Window {
    particlesJS?: (
      tagId: string,
      params: any
    ) => void;
  }
}

export default function ParticlesBackground() {
  const initParticles = () => {
    if (!window.particlesJS) return;

    const config = {
      particles: {

        number: { value: 100 },
        color: { value: '#ffffff' },
        opacity: { value: 0.9 },
        size: { value: 3, random: true },

        line_linked: {
          enable: true,
          distance: 120,
          color: '#ffffff',
          opacity: 0.8,
          width: 2,
        },
        move: {
          enable: true,
          speed: 1.5,
          random: true,
        },
      },
      interactivity: {
        events: {
          onhover: { enable: true, mode: 'grab' },
          resize: true,
        },
        modes: {
          grab: { distance: 150, line_linked: { opacity: 0.8, color: '#ffffff' } },
        },
      },
      retina_detect: true,
    };

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      config.particles.move.enable = false;
    }

    window.particlesJS('particles-js', config);
  };

  useEffect(() => {
    initParticles();
  }, []);

  return (
    <>
      <Script src="https://cdn.jsdelivr.net/npm/particles.js" strategy="afterInteractive" onLoad={initParticles} />
      <div id="particles-js" className="absolute inset-0" />
    </>
  );
}

