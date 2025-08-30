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
      className="feature-card card-fade"
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay }}
    >
      {icon}
      <p className="text-sm">{text}</p>
    </motion.div>
  );
}
