"use client";

import { motion } from "framer-motion";
import { useCopy } from "../hooks/useCopy";

export default function AfterlightLanding() {
  const copy = useCopy();

  return (
    <div className="flex flex-col items-center space-y-8 py-12 text-center">
      <div className="max-w-2xl space-y-4">
        <h1 className="text-4xl font-bold tracking-tight">
          {copy.heroTitle}
        </h1>
        <p className="text-lg text-slate-300">{copy.heroSubtitle}</p>
      </div>

      <motion.div
        className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.6 }}
      >
        <img
          src="/logo.jpg"
          alt="Логотип Afterlight"
          className="h-auto w-full object-contain"
          loading="eager"
          decoding="async"
          width={467}
          height={312}
          style={{ background: "transparent" }}
        />
      </motion.div>

      <ul className="mt-6 max-w-xl space-y-2 text-left">
        {copy.bullets.map((b) => (
          <li key={b} className="flex items-start gap-2">
            <span className="mt-2 h-2 w-2 rounded-full bg-sky-400" />
            <span>{b}</span>
          </li>
        ))}
      </ul>

      <div className="mt-8 flex flex-col gap-4 sm:flex-row">
        <a
          href="#"
          className="rounded-lg bg-sky-500 px-6 py-3 font-semibold text-slate-900 transition-colors hover:bg-sky-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300 active:bg-sky-600"
        >
          {copy.ctaPrimary}
        </a>
        <a
          href="#"
          className="rounded-lg bg-white/10 px-6 py-3 font-semibold text-slate-100 transition-colors hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/50 active:bg-white/30"
        >
          {copy.ctaSecondary}
        </a>
      </div>
    </div>
  );
}

