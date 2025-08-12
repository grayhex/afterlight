'use client';
import { useState } from 'react';

export default function Demo(){
  const [confirms, setConfirms] = useState(2);
  const [denies, setDenies] = useState(0);
  const quorum = 3;

  const state = (() => {
    if (confirms >= quorum) return 'QuorumReached';
    if (confirms > 0 && denies > 0) return 'Disputed (24h lock)';
    if (confirms > 0) return 'Confirming';
    return 'Submitted';
  })();

  const pct = Math.min(100, Math.round((confirms / quorum) * 100));

  return (
    <main className="container-narrow py-8 space-y-4">
      <div className="card p-6">
        <h3 className="font-semibold mb-2">Демо‑сценарий подтверждения события</h3>
        <div className="text-sm text-slate-600 mb-4">Поиграй ползунками и посмотри как меняется статус.</div>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="card p-4">
            <label className="text-sm">Подтверждений: {confirms}</label>
            <input className="w-full" type="range" min={0} max={5} value={confirms} onChange={e=>setConfirms(Number(e.target.value))} />
          </div>
          <div className="card p-4">
            <label className="text-sm">Опровержений: {denies}</label>
            <input className="w-full" type="range" min={0} max={5} value={denies} onChange={e=>setDenies(Number(e.target.value))} />
          </div>
          <div className="card p-4">
            <div className="text-sm mb-1">Кворум: {quorum}</div>
            <div className="text-sm mb-2">Состояние: <b>{state}</b></div>
            <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
              <div className="h-full bg-ink" style={{width:`${pct}%`}}></div>
            </div>
          </div>
        </div>
        <div className="mt-4">
          <a className="btn" href="/wireframes/owner/wizard">Открыть мастер создания сейфа</a>
        </div>
      </div>
    </main>
  )
}
