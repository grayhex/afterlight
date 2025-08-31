'use client';

import { Lock, Users, Activity, Link as LinkIcon, Shield } from "lucide-react";
import { motion } from "framer-motion";
import FaqItem from "@/components/faq-item";

export default function LandingContent() {
  const features = [
    {
      icon: Lock,
      text: "Клиентское шифрование: мы не видим содержимое ваших сейфов.",
    },
    {
      icon: Users,
      text: "Кворум 2 из 3 верификаторов подтверждает событие.",
    },
    {
      icon: Activity,
      text: "Heartbeat: год без входа запускает процесс вручения.",
    },
    {
      icon: LinkIcon,
      text: "Публичные ссылки на блоки живут 24 часа и защищены CAPTCHA.",
    },
    {
      icon: Shield,
      text: "Содержимое шифруется на вашем устройстве. Мы храним только зашифрованные данные и технические метаданные.",
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
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-8">
      <h1 className="mb-4 text-3xl font-bold">
        Afterlight — цифровое завещание под вашим контролем
      </h1>
      <p className="mb-6 text-lg">
        Сохраните зашифрованные инструкции и файлы, которые увидят ваши
        доверенные люди после подтверждённого события.
      </p>

      <section className="mb-8">
        <h2 className="mb-4 text-2xl font-semibold">Ключевые возможности</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {features.map((f, i) => (
            <motion.div
              key={i}
              className="card-fade group rounded border border-bodaghee-accent/20 bg-bodaghee-bg p-4 text-white hover:border-bodaghee-accent"
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
            >
              <f.icon className="feature-icon mb-2 h-6 w-6 text-bodaghee-accent group-hover:scale-110" />
              <p className="text-sm">{f.text}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <h2 className="mb-4 text-2xl font-semibold">Как это работает (3 шага)</h2>
      <ol className="mb-6 list-decimal space-y-2 pl-5">
        <li>Создайте сейф и добавьте 3 верификаторов.</li>
        <li>Настройте блоки и получателей.</li>
        <li>
          При наступлении события два подтверждения запускают раскрытие. Через
          24 часа доступ будет открыт.
        </li>
      </ol>

      <section className="mb-6">
        <h2 className="mb-4 text-2xl font-semibold">FAQ</h2>
        <div className="space-y-4">
          {faqs.map((f, i) => (
            <FaqItem key={i} question={f.q} answer={f.a} delay={i * 0.1} />
          ))}
        </div>
      </section>
    </div>
  );
}

