"use client";

import dynamic from 'next/dynamic';
import Link from 'next/link';
import FeatureCard from '@/components/feature-card';
import FaqItem from '@/components/faq-item';
import Stats from '@/components/stats';
import { motion, useReducedMotion } from 'framer-motion';
import { Lock, Users, Activity, Link as LinkIcon } from 'lucide-react';

const NetworkMesh = dynamic(() => import('@/components/network-mesh'), { ssr: false });

export default function Home() {
  const reduceMotion = useReducedMotion();
  const features = [
    {
      icon: <Lock className="feature-icon mb-2 h-6 w-6 text-bodaghee-lime" />,
      text: 'Клиентское шифрование: мы не видим содержимое ваших сейфов.',
    },
    {
      icon: <Users className="feature-icon mb-2 h-6 w-6 text-bodaghee-lime" />,
      text: 'Кворум 2 из 3 верификаторов подтверждает событие.',
    },
    {
      icon: <Activity className="feature-icon mb-2 h-6 w-6 text-bodaghee-lime" />,
      text: 'Heartbeat: год без входа запускает процесс вручения.',
    },
    {
      icon: <LinkIcon className="feature-icon mb-2 h-6 w-6 text-bodaghee-lime" />,
      text: 'Публичные ссылки на блоки живут 24 часа и защищены CAPTCHA.',
    },
  ];

  const stats = [
    { value: 2, suffix: '/3', label: 'кворум' },
    { value: 365, suffix: ' дней', label: 'heartbeat' },
    { value: 24, suffix: ' часа', label: 'grace-период' },
    { value: 24, suffix: ' часа', label: 'жизнь ссылки' },
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
      <section className="container mx-auto flex flex-col items-center gap-8 px-4 py-16 sm:px-8 md:flex-row">
        <div className="w-full text-center md:w-1/2 md:text-left">
          <h1 className="mb-4 text-4xl font-bold">Afterlight — цифровое завещание</h1>
          <p className="mb-6 text-lg">
            Сохраните зашифрованные инструкции и файлы, которые увидят ваши
            доверенные люди после подтверждённого события.
          </p>
          <Link
            href="/register"
            className="inline-block rounded bg-bodaghee-lime px-6 py-3 font-medium text-bodaghee-navy hover:bg-bodaghee-lime/90"
          >
            Создать сейф
          </Link>
        </div>
        <div className="h-64 w-full md:h-80 md:w-1/2">
          <NetworkMesh />
        </div>
      </section>

      <motion.section
        className="container mx-auto px-4 py-16 sm:px-8"
        initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
        whileInView={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={reduceMotion ? undefined : { duration: 0.4 }}
      >
        <h2 className="mb-4 text-2xl font-semibold">Преимущества</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f, i) => (
            <FeatureCard key={i} icon={f.icon} text={f.text} delay={i * 0.1} />
          ))}
        </div>
      </motion.section>

      <motion.section
        className="container mx-auto px-4 py-16 sm:px-8"
        initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
        whileInView={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={reduceMotion ? undefined : { duration: 0.4 }}
      >
        <Stats items={stats} />
      </motion.section>

      <motion.section
        className="container mx-auto px-4 py-16 sm:px-8"
        initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
        whileInView={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={reduceMotion ? undefined : { duration: 0.4 }}
      >
        <h2 className="mb-4 text-2xl font-semibold">FAQ</h2>
        <div className="max-h-64 space-y-4 overflow-y-auto rounded border border-bodaghee-navy/20 bg-bodaghee-teal p-4 text-bodaghee-navy">
          {faqs.map((f, i) => (
            <FaqItem key={i} question={f.q} answer={f.a} delay={i * 0.1} />
          ))}
        </div>
      </motion.section>

      <p className="mx-auto mb-16 max-w-2xl px-4 text-sm text-bodaghee-navy/70 sm:px-8">
        Содержимое шифруется на вашем устройстве. Мы храним только зашифрованные данные и технические метаданные.
      </p>
    </div>
  );
}

