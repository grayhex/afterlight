'use client';

import { useRef, useEffect } from 'react';

export default function NetworkMesh() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();

    const nodes = Array.from({ length: 200 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.2,
      vy: (Math.random() - 0.5) * 0.2,
    }));

    const mouse = { x: 0, y: 0, active: false };

    let frame: number;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      nodes.forEach((n, idx) => {
        if (!prefersReduced) {
          n.x += n.vx;
          n.y += n.vy;
          if (n.x < 0 || n.x > canvas.width) n.vx *= -1;
          if (n.y < 0 || n.y > canvas.height) n.vy *= -1;
        }
        const dist = mouse.active ? Math.hypot(n.x - mouse.x, n.y - mouse.y) : Infinity;
        const radius = dist < 50 ? 1.5 : 1;
        ctx.beginPath();
        ctx.arc(n.x, n.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = '#92CBDB';
        ctx.fill();
        for (let j = idx + 1; j < nodes.length; j++) {
          const m = nodes[j];
          const d = Math.hypot(n.x - m.x, n.y - m.y);
          if (d < 150) {
            const nearMouse =
              mouse.active &&
              (Math.hypot(n.x - mouse.x, n.y - mouse.y) < 80 ||
                Math.hypot(m.x - mouse.x, m.y - mouse.y) < 80);
            ctx.strokeStyle = nearMouse
              ? 'rgba(146,203,219,1)'
              : 'rgba(146,203,219,0.5)';
            ctx.lineWidth = 0.3;
            ctx.beginPath();
            ctx.moveTo(n.x, n.y);
            ctx.lineTo(m.x, m.y);
            ctx.stroke();
          }
        }
      });
      frame = requestAnimationFrame(draw);
    };
    draw();

    const handleMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
      mouse.active = true;
      const offsetX = (mouse.x - rect.width / 2) / 20;
      const offsetY = (mouse.y - rect.height / 2) / 20;
      canvas.style.transform = `translate3d(${offsetX}px, ${offsetY}px, 0)`;
    };
    const handleLeave = () => {
      mouse.active = false;
      canvas.style.transform = 'translate3d(0,0,0)';
    };

    canvas.addEventListener('mousemove', handleMove);
    canvas.addEventListener('mouseleave', handleLeave);
    window.addEventListener('resize', resize);

    return () => {
      cancelAnimationFrame(frame);
      canvas.removeEventListener('mousemove', handleMove);
      canvas.removeEventListener('mouseleave', handleLeave);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />;
}

