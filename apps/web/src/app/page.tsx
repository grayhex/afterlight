"use client";

import dynamic from 'next/dynamic';
import FeatureCard from '@/components/feature-card';
import FaqItem from '@/components/faq-item';
import Stats from '@/components/stats';
import {
  motion,
  useReducedMotion,
  useMotionValue,
  useSpring,
} from 'framer-motion';
import { Lock, Users, Activity, Link as LinkIcon, Shield } from 'lucide-react';

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
      icon: <Lock className="feature-icon mb-2 h-6 w-6 text-bodaghee-accent" />,
      text: 'Клиентское шифрование: мы не видим содержимое ваших сейфов.',
    },
    {
      icon: <Users className="feature-icon mb-2 h-6 w-6 text-bodaghee-accent" />,
      text: 'Кворум 2 из 3 верификаторов подтверждает событие.',
    },
    {
      icon: <Activity className="feature-icon mb-2 h-6 w-6 text-bodaghee-accent" />,
      text: 'Heartbeat: год без входа запускает процесс вручения.',
    },
    {
      icon: <LinkIcon className="feature-icon mb-2 h-6 w-6 text-bodaghee-accent" />,
      text: 'Публичные ссылки на блоки живут 24 часа и защищены CAPTCHA.',
    },
    {
      icon: <Shield className="feature-icon mb-2 h-6 w-6 text-bodaghee-accent" />,
      text: 'Содержимое шифруется на вашем устройстве. Мы храним только зашифрованные данные и технические метаданные.',
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
      <section className="container mx-auto grid items-center gap-8 px-4 py-16 sm:px-8 md:grid-cols-2">
        <div className="flex flex-col items-center text-center md:items-start md:text-left">
          <motion.h1
            ref={headingRef}
            style={reduceMotion ? undefined : { x: springX, y: springY }}
            className="mb-4 text-[120px] font-heading text-white"
          >
            Afterlight
          </motion.h1>
          <p className="mb-6 text-xl text-bodaghee-accent">Цифровое завещание</p>
          
        </div>
        <div className="relative h-96 w-full md:h-[650px]">
          <ParticlesBackground />
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
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
        <div className="space-y-4">
          {faqs.map((f, i) => (
            <FaqItem key={i} question={f.q} answer={f.a} delay={i * 0.1} />
          ))}
        </div>
      </motion.section>
    </div>
  );
}

