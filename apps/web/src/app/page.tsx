import React from "react";
import { motion } from "framer-motion";
import { Shield, HeartPulse, Users, Share2, FileLock, Link2, Github, Play, KeyRound, Sparkles, Mail, Settings, ShieldCheck, User } from "lucide-react";

/**
 * AfterLight Landing (FINAL)
 * - Серый фон, контрастный текст
 * - Лого из /logo.svg (если файла нет — текст)
 * - DEV‑раздел с Playground/healthz/Swagger
 * - Главное меню: Владелец / Верификатор / Админка
 * 
 * Пути:
 *   apps/web/src/app/page.tsx  ← этот файл
 *   apps/web/public/logo.svg   ← логотип
 */

const bg = "bg-gradient-to-b from-[#111418] via-[#151a20] to-[#1b2129]";
const ctn = "max-w-6xl mx-auto px-4 sm:px-6";
const btn =
  "inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-medium shadow-sm transition hover:shadow md:active:scale-[.98]";

function Logo({ className = "h-9 w-auto" }: { className?: string }) {
  return (
    <div className="flex items-center gap-3 select-none">
      <img src="/logo.svg" alt="AfterLight" className={className}
           onError={(e)=>{ (e.currentTarget as HTMLImageElement).style.display='none'; }} />
      <span className="text-2xl md:text-3xl font-semibold tracking-tight text-slate-100">AfterLight</span>
    </div>
  );
}

function Nav() {
  const link =
    "group inline-flex items-center gap-2 rounded-xl px-3 py-2 text-slate-300 hover:text-white transition-colors";
  const ico = "h-4 w-4 opacity-60 group-hover:opacity-100 transition-opacity";
  return (
    <nav className="sticky top-0 z-40 backdrop-blur supports-[backdrop-filter]:bg-slate-900/60 bg-slate-900/80 border-b border-white/5">
      <div className={`${ctn} flex items-center justify-between py-2`}>
        <a href="/" className="flex items-center gap-2"><Logo/></a>
        <div className="hidden lg:flex items-center gap-1">
          <a className={link} href="#how"><Sparkles className={ico}/>Как это работает</a>
          <a className={link} href="#features"><Shield className={ico}/>Функции</a>
          <a className={link} href="#security"><FileLock className={ico}/>Безопасность</a>
          <a className={link} href="#docs"><Link2 className={ico}/>Документация</a>
          <a className={link} href="/wireframes/owner"><User className={ico}/>Кабинет владельца</a>
          <a className={link} href="/wireframes/verifier"><ShieldCheck className={ico}/>Кабинет верификатора</a>
          <a className={link} href="/admin"><Settings className={ico}/>Админка</a>
        </div>
        <div className="flex items-center gap-2">
          <a className={`${btn} bg-white/10 text-white hover:bg-white/20`} href="#dev">
            <Play className="h-4 w-4"/> Dev / Playground
          </a>
        </div>
      </div>
    </nav>
  );
}

function Hero(){
  return (
    <section className={`${bg} text-slate-100 relative overflow-hidden`}> 
      <div className={`${ctn} py-16 md:py-24`}> 
        <motion.h1 initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} transition={{duration:.6}} className="text-3xl md:text-5xl font-semibold tracking-tight">
          Цифровой «сейф на случай непредвиденного»
        </motion.h1>
        <motion.p initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} transition={{delay:.1, duration:.6}} className="mt-4 max-w-2xl text-slate-300">
          Храните инструкции и материалы, назначайте получателей и верификаторов. 
          Раскрытие — только по правилу N‑из‑M + heartbeat и grace‑period.
        </motion.p>
        <motion.div initial={{opacity:0}} animate={{opacity:1}} transition={{delay:.2}} className="mt-8 flex flex-wrap gap-3">
          <a href="#how" className={`${btn} bg-indigo-500 text-white hover:bg-indigo-400`}>
            Узнать больше
          </a>
          <a href="#docs" className={`${btn} bg-white/10 text-slate-100 hover:bg-white/20`}>
            Документация
          </a>
        </motion.div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 -bottom-40 h-80 bg-gradient-to-b from-transparent to-black/10"/>
    </section>
  );
}

function HowItWorks(){
  const steps = [
    {icon: <Users className="h-5 w-5"/>, title: "Роли", text: "Назначьте получателей и 3–5 верификаторов (N‑из‑M)."},
    {icon: <FileLock className="h-5 w-5"/>, title: "Блоки", text: "Создавайте блоки (текст/файл/url), назначайте адресатов."},
    {icon: <HeartPulse className="h-5 w-5"/>, title: "Триггеры", text: "Heartbeat таймаут + подтверждения верификаторов."},
    {icon: <Share2 className="h-5 w-5"/>, title: "Раскрытие", text: "Grace‑окно, затем адресная выдача и/или публичная ссылка."},
  ];
  return (
    <section id="how" className="bg-slate-950 text-slate-100 border-t border-white/5">
      <div className={`${ctn} py-14`}>
        <h2 className="text-2xl md:text-3xl font-semibold">Как это работает</h2>
        <p className="text-slate-300 mt-2 max-w-2xl">Простой путь от создания сейфа до контролируемого раскрытия.</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i)=> (
            <motion.div key={i} initial={{opacity:0, y:8}} whileInView={{opacity:1, y:0}} viewport={{once:true}} transition={{delay:i*0.05}} className="rounded-2xl bg-white/5 p-4 hover:bg-white/10 transition">
              <div className="flex items-center gap-2 text-indigo-300">{s.icon}<span className="font-medium">{s.title}</span></div>
              <p className="mt-2 text-sm text-slate-300">{s.text}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Features(){
  const feats = [
    {icon:<Shield className="h-5 w-5"/>, title:"N‑из‑M политики", text:"Порог подтверждений на уровне сейфа, Primary Verifier (опция)."},
    {icon:<KeyRound className="h-5 w-5"/>, title:"Клиентское шифрование", text:"Контент шифруется на стороне клиента (сервер видит метаданные)."},
    {icon:<HeartPulse className="h-5 w-5"/>, title:"Heartbeat & Grace", text:"Таймаут неактивности + финальное окно ожидания."},
    {icon:<Share2 className="h-5 w-5"/>, title:"Публичные блоки", text:"Перссылки с окном публикации и отзывом."},
  ];
  return (
    <section id="features" className="bg-slate-900 text-slate-100 border-t border-white/5">
      <div className={`${ctn} py-14`}>
        <h2 className="text-2xl md:text-3xl font-semibold">Основные функции</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {feats.map((f,i)=> (
            <motion.div key={i} initial={{opacity:0, y:8}} whileInView={{opacity:1, y:0}} viewport={{once:true}} transition={{delay:i*0.05}} className="rounded-2xl bg-white/5 p-4 hover:bg-white/10">
              <div className="flex items-center gap-2 text-emerald-300">{f.icon}<span className="font-medium">{f.title}</span></div>
              <p className="mt-2 text-sm text-slate-300">{f.text}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Security(){
  return (
    <section id="security" className="bg-slate-950 text-slate-100 border-t border-white/5">
      <div className={`${ctn} py-14`}>
        <h2 className="text-2xl md:text-3xl font-semibold">Безопасность</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          <li className="card"><b>Шифрование</b>: клиентская сторона (AES‑GCM/ChaCha, Ed25519 для подписей). Сервер хранит метаданные.</li>
          <li className="card"><b>Роли и права</b>: N‑из‑M подтверждений, Primary Verifier (опционально), аудит событий.</li>
          <li className="card"><b>Опубликование</b>: контролируемые публичные ссылки с окнами действия и отзывом.</li>
          <li className="card"><b>Инфраструктура</b>: контейнеры, изолированное хранилище, мониторинг.</li>
        </ul>
      </div>
    </section>
  );
}

function Docs(){
  return (
    <section id="docs" className="bg-slate-950 text-slate-100 border-t border-white/5">
      <div className={`${ctn} py-14`}>
        <h2 className="text-2xl md:text-3xl font-semibold">Документация и исходники</h2>
        <p className="text-slate-300 mt-2">Спецификации, архитектура, API и планы релизов в репозитории.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a className={`${btn} bg-white/10 text-slate-100 hover:bg-white/20`} href="https://github.com/grayhex/afterlight/tree/main/docs" target="_blank" rel="noreferrer">
            <Github className="h-4 w-4"/> Документы в GitHub
          </a>
          <a className={`${btn} bg-white/10 text-slate-100 hover:bg-white/20`} href="/wireframes">
            <Users className="h-4 w-4"/> Вайрфреймы
          </a>
        </div>
      </div>
    </section>
  );
}

function Dev(){
  return (
    <section id="dev" className="bg-slate-900 text-slate-100 border-t border-white/5">
      <div className={`${ctn} py-14`}>
        <h2 className="text-2xl md:text-3xl font-semibold">Отладка и системные страницы</h2>
        <p className="text-slate-300 mt-2">Служебные разделы для тестов и мониторинга.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a className={`${btn} bg-indigo-500 text-white hover:bg-indigo-400`} href="/playground"><Play className="h-4 w-4"/> Playground</a>
          <a className={`${btn} bg-white/10 text-slate-100 hover:bg-white/20`} href="https://api.afterl.ru/healthz" target="_blank" rel="noreferrer">Healthz</a>
          <a className={`${btn} bg-white/10 text-slate-100 hover:bg-white/20`} href="https://api.afterl.ru/docs" target="_blank" rel="noreferrer">Swagger (если включён)</a>
        </div>
      </div>
    </section>
  );
}

function Footer(){
  return (
    <footer className="bg-slate-950 text-slate-400 border-t border-white/5">
      <div className={`${ctn} py-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between`}>
        <Logo className="h-7"/>
        <div className="text-sm">© {new Date().getFullYear()} AfterLight. Все права защищены.</div>
        <div className="flex items-center gap-2">
          <a className="inline-flex items-center gap-2 text-slate-300 hover:text-white transition" href="mailto:hello@afterl.ru"><Mail className="h-4 w-4"/>hello@afterl.ru</a>
        </div>
      </div>
    </footer>
  );
}

export default function Landing(){
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-indigo-500/30">
      <Nav/>
      <Hero/>
      <HowItWorks/>
      <Features/>
      <Security/>
      <Docs/>
      <Dev/>
      <Footer/>
      <style>{`
        .container{max-width:72rem;margin-left:auto;margin-right:auto;padding:0 1rem}
        .card{border-radius:1rem;border:1px solid rgba(255,255,255,.06);background:rgba(255,255,255,.03);padding:1rem}
        .grid{display:grid;gap:.75rem}
        .grid-2{grid-template-columns:repeat(2,minmax(0,1fr))}
        @media (max-width:640px){.grid-2{grid-template-columns:1fr}}
      `}</style>
    </div>
  );
}
