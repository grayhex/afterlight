import { Github, Code2, Send } from 'lucide-react';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="flex flex-col items-center gap-6 text-center">
        <h1 className="text-5xl font-bold text-[#10a37f]">Afterlight</h1>
        <p className="text-base text-neutral-300">
          Идёт разработка с&nbsp;помощью искусственного интеллекта
        </p>
        <p className="text-sm text-neutral-500">
          Скоро здесь появится серьёзный проект.
        </p>
        <div className="mt-4 flex gap-6">
          <a
            href="https://github.com/retrotink/afterlight"
            className="flex items-center gap-2 text-[#10a37f] hover:underline"
          >
            <Github className="h-5 w-5" />
            <span>GitHub</span>
          </a>
          <a href="/dev" className="flex items-center gap-2 text-[#10a37f] hover:underline">
            <Code2 className="h-5 w-5" />
            <span>/dev</span>
          </a>
          <a
            href="https://t.me/retrotink"
            className="flex items-center gap-2 text-[#10a37f] hover:underline"
          >
            <Send className="h-5 w-5" />
            <span>@retrotink</span>
          </a>
        </div>
      </div>
    </main>
  );
}
