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
        number: {
          value: 150,
          density: { enable: true, value_area: 1500 },
        },
        color: { value: '#00e5ff' },
        opacity: { value: 0.8 },
        size: { value: 3, random: true },
        line_linked: {
          enable: true,
          distance: 120,
          color: '#00e5ff',
          opacity: 0.2,
          width: 1,
          shadow: { enable: true, color: '#00e5ff', blur: 4 },
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
          grab: { distance: 180, line_linked: { opacity: 0.8 } },
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
      <div id="particles-background" className="absolute inset-0 h-full w-full" />
    </>
  );
}

