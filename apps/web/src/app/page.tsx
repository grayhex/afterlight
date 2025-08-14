export const revalidate = false;
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

import Link from "next/link";

export default function Home() {
  return (
    <main className="container">
      <h1>AfterLight — Web</h1>
      <p className="small">Это минимальный корень приложения. Для ручного теста API откройте Playground.</p>
      <p><Link className="btn" href="/playground">Открыть Playground</Link></p>
    </main>
  );
}
