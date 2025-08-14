import { KPI } from "@/components/KPI";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AfterLight — Вайрфреймы',
  description: 'Навигация по разделам прототипа',
};

export default function Wireframes() {
  return (
    <main className="container-narrow py-8">
      <h1 className="text-2xl font-semibold mb-4">Вайрфреймы</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KPI label="Сейфов" value="2" />
        <KPI label="Верификаторов" value="3" />
        <KPI label="Блоков" value="3" />
        <KPI label="Событий верификации" value="1" />
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <a className="card p-6 hover:shadow-lg transition" href="/wireframes/owner">
          <h3 className="font-semibold mb-1">Кабинет владельца</h3>
          <p className="text-sm text-slate-600">Список сейфов, мастер создания, настройка порогов и верификаторов</p>
        </a>
        <a className="card p-6 hover:shadow-lg transition" href="/wireframes/verifier">
          <h3 className="font-semibold mb-1">Кабинет верификатора</h3>
          <p className="text-sm text-slate-600">Подтверждение/опровержение события, прогресс кворума</p>
        </a>
        <a className="card p-6 hover:shadow-lg transition" href="/wireframes/recipient">
          <h3 className="font-semibold mb-1">Вид получателя</h3>
          <p className="text-sm text-slate-600">Список блоков и дата их обновления, инструкция по расшифровке</p>
        </a>
        <a className="card p-6 hover:shadow-lg transition" href="/wireframes/demo">
          <h3 className="font-semibold mb-1">Демо‑сценарий</h3>
          <p className="text-sm text-slate-600">Сымитировать подтверждения, спор и переходы состояний</p>
        </a>
      </div>
    </main>
  );
}
