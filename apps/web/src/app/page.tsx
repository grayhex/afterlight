export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <img src="/logo.jpg" alt="AfterLight" className="h-20 w-20 rounded-full opacity-80" />
        <h1 className="text-2xl md:text-3xl font-semibold">
          Идёт разработка с&nbsp;помощью искусственного интеллекта
        </h1>
        <p className="text-sm text-neutral-400">
          Скоро здесь появится серьёзный проект.
        </p>
      </div>
    </main>
  );
}
