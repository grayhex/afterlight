export default function HowPage() {
  return (
    <div className="p-6 space-y-8">
      <section>
        <h1 className="text-2xl font-bold mb-4">Как это работает</h1>
        <ol className="list-decimal space-y-2 pl-6">
          <li>Создайте сейф и добавьте 3 верификаторов.</li>
          <li>Настройте блоки и получателей.</li>
          <li>
            При наступлении события два подтверждения запускают раскрытие. Через 24
            часа доступ будет открыт.
          </li>
        </ol>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">FAQ</h2>
        <div className="space-y-4">
          <div>
            <h3 className="font-medium">Как обеспечивается безопасность?</h3>
            <p>
              Содержимое шифруется на вашем устройстве. Мы храним только
              зашифрованные данные и технические метаданные.
            </p>
          </div>
          <div>
            <h3 className="font-medium">Как подтверждается событие?</h3>
            <p>
              Двое из трёх доверенных людей подтверждают событие. После этого
              запускается раскрытие сейфа.
            </p>
          </div>
          <div>
            <h3 className="font-medium">Есть ли контроль времени?</h3>
            <p>
              У вас сутки на финальные действия, а окно «я на связи» длится год.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
