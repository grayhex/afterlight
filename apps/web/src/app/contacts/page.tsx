export default function ContactsPage() {
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Контакты</h1>
      <p>
        По вопросам поддержки пишите на{' '}
        <a className="text-blue-600 underline" href="mailto:support@afterl.ru">
          support@afterl.ru
        </a>
        .
      </p>
    </div>
  );
}
