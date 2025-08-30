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
    <motion.div
      className="card-fade rounded bg-bodaghee-teal p-4 text-bodaghee-navy"
      initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
      whileInView={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={reduceMotion ? undefined : { duration: 0.4, delay }}
    >
      <h3 className="mb-2">{question}</h3>
      <p>{answer}</p>
    </motion.div>
  );
}
