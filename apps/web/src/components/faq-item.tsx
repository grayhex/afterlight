'use client';

import { motion } from 'framer-motion';

interface Props {
  question: string;
  answer: string;
  delay?: number;
}

export default function FaqItem({ question, answer, delay = 0 }: Props) {
  return (
    <motion.div
      className="card-fade"
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay }}
    >
      <h3 className="font-medium">{question}</h3>
      <p>{answer}</p>
    </motion.div>
  );
}
