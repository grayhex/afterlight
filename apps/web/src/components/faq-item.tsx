'use client';

import { motion, useReducedMotion } from 'framer-motion';

interface Props {
  question: string;
  answer: string;
  delay?: number;
}

export default function FaqItem({ question, answer, delay = 0 }: Props) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.details
      className="card-fade py-2"
      initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
      whileInView={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={reduceMotion ? undefined : { duration: 0.4, delay }}
    >
      <summary className="cursor-pointer text-bodaghee-accent">{question}</summary>
      <p className="mt-1 text-white">{answer}</p>
    </motion.details>
  );
}
