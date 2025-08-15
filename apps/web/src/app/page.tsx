export const revalidate = false;
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

import Link from "next/link";

export default function Home() {
  return (
    <div className="space-y-8">
      <section>
        <h1>AfterLight — Web</h1>
        <p className="small">Заглушка будущего лендинга.</p>
        <nav>
          <ul className="list-disc pl-5">
            <li><Link href="/wireframes/owner">Кабинет владельца</Link></li>
            <li><Link href="/wireframes/verifier">Кабинет верификатора</Link></li>
            <li><Link href="/wireframes/recipient">Вид получателя</Link></li>
          </ul>
        </nav>
      </section>
      <section>
        <h2 className="text-lg font-semibold">Отладка и тестирование</h2>
        <ul className="list-disc pl-5">
          <li><Link href="/playground">Playground</Link></li>
          <li>
            <a
              href="http://localhost:3000/docs"
              target="_blank"
              rel="noopener noreferrer"
            >
              Swagger
            </a>
          </li>
        </ul>
      </section>
    </div>
  );
}
