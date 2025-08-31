'use client';

import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';

interface Props {
  icon: ReactNode;
  title: string;
  text: string;
  delay?: number;
}

export default function FeatureCard({ icon, title, text, delay = 0 }: Props) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      className="card-fade group rounded border border-bodaghee-accent/20 bg-bodaghee-bg p-3 text-white hover:border-bodaghee-accent"
      initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
      whileInView={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={reduceMotion ? undefined : { duration: 0.4, delay }}
    >
      <div className="feature-icon mb-1 text-bodaghee-accent group-hover:scale-110">{icon}</div>
      <h3 className="mb-0.5 font-semibold text-white">{title}</h3>
      <p className="text-xs text-white">{text}</p>
    </motion.div>
  );
}
