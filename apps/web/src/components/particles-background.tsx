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
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    window.particlesJS('particles-background', {
      particles: {
        number: { value: 100 },
        color: { value: '#92cbdb' },
        opacity: { value: 0.4 },
        size: { value: 2, random: true },
        line_linked: {
          enable: true,
          distance: 120,
          color: '#92cbdb',
          opacity: 0.2,
          width: 1,
        },
        move: {
          enable: !prefersReduced,
          speed: 1,
        },
      },
      interactivity: {
        events: {
          onhover: { enable: true, mode: 'grab' },
          resize: true,
        },
        modes: {
          grab: { distance: 150, line_linked: { opacity: 0.4 } },
        },
      },
      retina_detect: true,
    });
  };

  useEffect(() => {
    if (window.particlesJS) initParticles();
  }, []);

  return (
    <>
      <Script
        src="https://cdn.jsdelivr.net/npm/particles.js@2.0.0/particles.min.js"
        strategy="afterInteractive"
        onLoad={initParticles}
      />
      <div id="particles-background" className="absolute inset-0 h-full w-full opacity-60" />
    </>
  );
}

