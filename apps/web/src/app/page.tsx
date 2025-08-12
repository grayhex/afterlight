export default function Home() {
  return (
    <main className="container-narrow py-10">
      <div className="card p-10">
        <h1 className="text-3xl font-semibold mb-4">AfterLight — прототип вайрфреймов</h1>
        <p className="text-slate-600 mb-6">
          Это кликабельные экраны без реального бэкенда, чтобы проверить UX и логику
          (онбординг, создание сейфа, верификаторы, подтверждение события, демо‑режим).
        </p>
        <div className="flex gap-3">
          <a className="btn btn-primary" href="/wireframes">Открыть вайрфреймы</a>
          <a className="btn" href="/wireframes/demo">Запустить демо‑сценарий</a>
        </div>
      </div>
    </main>
  );
}
