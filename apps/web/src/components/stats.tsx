'use client';

import { motion, useReducedMotion } from 'framer-motion';
import CountUp from 'react-countup';

interface Stat {
  value: number;
  suffix?: string;
  label: string;
}

export default function Stats({ items }: { items: Stat[] }) {
  const reduceMotion = useReducedMotion();
  return (
    <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
      {items.map((s, i) => (
        <motion.div
          key={i}
          className="text-center"
          initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
          whileInView={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={reduceMotion ? undefined : { duration: 0.4, delay: i * 0.1 }}
        >
          <div className="font-numeric text-3xl font-bold text-bodaghee-lime">
            {reduceMotion ? (
              <span>
                {s.value}
                {s.suffix}
              </span>
            ) : (
              <CountUp end={s.value} suffix={s.suffix} duration={1.2} />
            )}
          </div>
          <p className="text-sm text-bodaghee-navy">{s.label}</p>
        </motion.div>
      ))}
    </div>
  );
}

