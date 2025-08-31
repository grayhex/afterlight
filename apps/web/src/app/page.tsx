"use client";

import { useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import FeatureCard from '@/components/feature-card';
import FaqItem from '@/components/faq-item';
import {
  motion,
  useReducedMotion,
  useMotionValue,
  useSpring,
} from 'framer-motion';
import { Lock, Users, Activity, Link as LinkIcon } from 'lucide-react';

const ParticlesBackground = dynamic(() => import('../components/particles-background'), { ssr: false });

export default function Home() {
  const reduceMotion = useReducedMotion();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 100, damping: 20 });
  const springY = useSpring(y, { stiffness: 100, damping: 20 });

  useEffect(() => {
    if (reduceMotion) return;
    const handleMove = (e: MouseEvent) => {
      const rect = headingRef.current?.getBoundingClientRect();
      if (!rect) return;
      const dx = e.clientX - (rect.left + rect.width / 2);
      const dy = e.clientY - (rect.top + rect.height / 2);
      x.set(dx * 0.05);
      y.set(dy * 0.05);
    };
    window.addEventListener('mousemove', handleMove);
    return () => window.removeEventListener('mousemove', handleMove);
  }, [reduceMotion, x, y]);
  const features = [
    {
      icon: <Lock className="h-6 w-6" />,
      title: 'Клиентское шифрование',
      text: 'Данные шифруются на устройстве.',
    },
    {
      icon: <Users className="h-6 w-6" />,
      title: 'Кворум 2/3',
      text: 'Двое из трёх подтверждают событие.',
    },
    {
      icon: <Activity className="h-6 w-6" />,
      title: 'Heartbeat 365 дней',
      text: 'Год без входа запускает вручение.',
    },
    {
      icon: <LinkIcon className="h-6 w-6" />,
      title: '24 часа на доступ',
      text: 'Публичные ссылки живут сутки.',
    },
  ];

  const faqs = [
    {
      q: 'Как обеспечивается безопасность?',
      a: 'Содержимое шифруется на вашем устройстве. Мы храним только зашифрованные данные и технические метаданные.',
    },
    {
      q: 'Как подтверждается событие?',
      a: 'Двое из трёх доверенных людей подтверждают событие. После этого запускается раскрытие сейфа.',
    },
    {
      q: 'Есть ли контроль времени?',
      a: 'У вас сутки на финальные действия, а окно «я на связи» длится год.',
    },
    {
      q: 'Какие события поддерживаются?',
      a: 'На старте доступны события: смерть и недееспособность.',
    },
    {
      q: 'Сколько длится grace-период?',
      a: 'После подтверждения события есть 24 часа до раскрытия сейфа.',
    },
    {
      q: 'Сколько живёт публичная ссылка?',
      a: 'Ссылка активна 24 часа, защищена CAPTCHA и удаляется после истечения срока.',
    },
  ];

  return (
    <div className="flex flex-col">
      <section className="container mx-auto grid items-center gap-6 px-4 py-12 sm:px-8 md:grid-cols-2">
        <div className="flex flex-col items-center text-center md:items-start md:text-left">
          <motion.h1
            ref={headingRef}
            style={reduceMotion ? undefined : { x: springX, y: springY }}
            className="mb-4 text-5xl font-heading text-white sm:text-7xl md:text-[120px]"
          >
            Afterlight
          </motion.h1>
          <p className="mb-4 text-lg text-bodaghee-accent">Цифровое завещание</p>

        </div>
        <div className="relative h-64 w-full md:h-[650px]">
          <ParticlesBackground />
        </div>
      </section>

      <motion.section
        className="container mx-auto px-4 py-12 sm:px-8"
        initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
        whileInView={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={reduceMotion ? undefined : { duration: 0.4 }}
    >
        <p className="mb-4 text-lg">
          Afterlight помогает заранее упорядочить доступы, инструкции и файлы в
          «сейфах», назначить получателей и верификаторов и раскрывать
          информацию только при наступлении заданных событий.
        </p>
        <h2 className="mb-4 text-2xl font-semibold">Преимущества</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f, i) => (
            <FeatureCard key={i} icon={f.icon} title={f.title} text={f.text} delay={i * 0.1} />
          ))}
        </div>
      </motion.section>

      <motion.section
        className="container mx-auto px-4 py-12 sm:px-8"
        initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
        whileInView={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={reduceMotion ? undefined : { duration: 0.4 }}
      >
        <h2 className="mb-4 text-2xl font-semibold">FAQ</h2>
        <div className="space-y-2">
          {faqs.map((f, i) => (
            <FaqItem key={i} question={f.q} answer={f.a} delay={i * 0.1} />
          ))}
        </div>
      </motion.section>
    </div>
  );
}

