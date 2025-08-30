
import FooterLinks from "@/components/footer-links";
import { getLandingConfig } from "@/lib/landing";
import { Lock, Users, Activity, Link as LinkIcon } from "lucide-react";
import { motion } from "framer-motion";


export const dynamic = 'force-dynamic';

export default function Home() {
  const config = getLandingConfig();
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
        <h2 className="mb-4 text-2xl font-semibold">Фичи</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {features.map((f, i) => (
            <motion.div
              key={i}
              className="feature-card card-fade"
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
            >
              <f.icon className="feature-icon mb-2 h-6 w-6 text-accent" />
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
        <h2 className="text-2xl font-semibold mb-4">FAQ</h2>
        <div className="space-y-4">
          <motion.div
            className="card-fade"
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
          >
            <h3 className="font-medium">Как обеспечивается безопасность?</h3>
            <p>
              Содержимое шифруется на вашем устройстве. Мы храним только
              зашифрованные данные и технические метаданные.
            </p>
          </motion.div>
          <motion.div
            className="card-fade"
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <h3 className="font-medium">Как подтверждается событие?</h3>
            <p>
              Двое из трёх доверенных людей подтверждают событие. После этого
              запускается раскрытие сейфа.
            </p>
          </motion.div>
          <motion.div
            className="card-fade"
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <h3 className="font-medium">Есть ли контроль времени?</h3>
            <p>
              У вас сутки на финальные действия, а окно «я на связи» длится
              год.
            </p>
          </motion.div>
        </div>
      </section>

      <p className="text-sm text-gray-500">
        Содержимое шифруется на вашем устройстве. Мы храним только
        зашифрованные данные и технические метаданные.
      </p>
      <FooterLinks links={config.links} />
    </div>
  );
}

