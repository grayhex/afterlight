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

    const nodes = Array.from({ length: 120 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.2,
      vy: (Math.random() - 0.5) * 0.2,
    }));

    let hovered: number | null = null;

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
        const radius = hovered === idx ? 1.5 : 0.8;
        ctx.beginPath();
        ctx.arc(n.x, n.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = hovered === idx ? 'rgba(146,203,219,0.4)' : 'rgba(146,203,219,0.2)';
        ctx.fill();
        for (let j = idx + 1; j < nodes.length; j++) {
          const m = nodes[j];
          const d = Math.hypot(n.x - m.x, n.y - m.y);
          if (d < 120) {
            const highlight = hovered !== null && (idx === hovered || j === hovered);
            ctx.strokeStyle = highlight
              ? 'rgba(146,203,219,0.4)'
              : 'rgba(146,203,219,0.2)';
            ctx.lineWidth = highlight ? 0.8 : 0.4;
            ctx.beginPath();
            ctx.moveTo(n.x, n.y);
            ctx.lineTo(m.x, m.y);
            ctx.stroke();
          }
        }
      });
      ctx.save();
      ctx.globalCompositeOperation = 'destination-in';
      const fade = ctx.createRadialGradient(
        canvas.width / 2,
        canvas.height / 2,
        0,
        canvas.width / 2,
        canvas.height / 2,
        Math.max(canvas.width, canvas.height) / 2
      );
      fade.addColorStop(0.7, 'rgba(0,0,0,1)');
      fade.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = fade;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
      frame = requestAnimationFrame(draw);
    };
    draw();

    const handleMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      let nearest: number | null = null;
      let minDist = Infinity;
      nodes.forEach((n, i) => {
        const dist = Math.hypot(n.x - x, n.y - y);
        if (dist < 10 && dist < minDist) {
          minDist = dist;
          nearest = i;
        }
      });
      hovered = nearest;
    };
    const handleLeave = () => {
      hovered = null;
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

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full opacity-60" />;
}

