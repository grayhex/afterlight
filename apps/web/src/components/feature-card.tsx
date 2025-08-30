'use client';

import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

interface Props {
  icon: ReactNode;
  text: string;
  delay?: number;
}

export default function FeatureCard({ icon, text, delay = 0 }: Props) {
  return (
    <motion.div
      className="card-fade group rounded border border-bodaghee-navy/20 bg-bodaghee-teal p-4 text-bodaghee-navy hover:border-bodaghee-lime"
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay }}
    >
      <div className="feature-icon mb-2 text-bodaghee-lime group-hover:scale-110">{icon}</div>
      <p className="text-sm">{text}</p>
    </motion.div>
  );
}
