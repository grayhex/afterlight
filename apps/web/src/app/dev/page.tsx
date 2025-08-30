import Link from "next/link";

export default function DevHome() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-8">
      <h1 className="mb-4 text-3xl font-bold">
        Afterlight — цифровой сейф на случай непредвидимого
      </h1>
      <p className="mb-6 text-lg">
        Подготовьте важные данные заранее. Доступ к ним откроется вашим близким
        только при подтверждённом событии.
      </p>
      <ul className="mb-8 list-disc space-y-2 pl-5">
        <li>Клиентское шифрование: мы не видим содержимое ваших сейфов.</li>
        <li>Простой кворум: 2 из 3 доверенных людей подтверждают событие.</li>
        <li>
          Контроль времени: сутки на финальные действия, год — окно «я на
          связи».
        </li>
        <li>
          Публичное «послание миру»: опционально, по ссылке на 24 часа с
          CAPTCHA.
        </li>
      </ul>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row">
        <Link
          href="/dev/owner"
          className="rounded bg-blue-600 px-4 py-2 text-center text-white"
        >
          Создать сейф
        </Link>
        <Link
          href="/dev/how"
          className="rounded border border-blue-600 px-4 py-2 text-center text-blue-600"
        >
          Как это работает
        </Link>
      </div>
      <h2 className="mb-4 text-2xl font-semibold">Как это работает (3 шага)</h2>
      <ol className="mb-6 list-decimal space-y-2 pl-5">
        <li>Создайте сейф и добавьте 3 верификаторов.</li>
        <li>Настройте блоки и получателей.</li>
        <li>
          При наступлении события два подтверждения запускают раскрытие. Через
          24 часа доступ будет открыт.
        </li>
      </ol>
      <p className="text-sm text-gray-600">
        Содержимое шифруется на вашем устройстве. Мы храним только
        зашифрованные данные и технические метаданные.
      </p>
    </div>
  );
}

