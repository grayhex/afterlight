import { events, verifiers } from '@/mock/data';

export default function Verifier(){
  const me = verifiers[0];
  const ev = events[0];
  const progress = Math.round((ev.confirms/ev.quorum_required)*100);
  return (
    <main className="container-narrow py-8 space-y-4">
      <div className="card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Событие #{ev.id}</h3>
            <div className="text-xs text-slate-500">Состояние: {ev.state}</div>
          </div>
          <div className="badge">Кворум: {ev.confirms}/{ev.quorum_required}</div>
        </div>
        <div className="mt-4 h-2 bg-slate-200 rounded-full overflow-hidden">
          <div className="h-full bg-ink" style={{width:`${progress}%`}}></div>
        </div>
        <div className="mt-4 flex gap-2">
          <button className="btn btn-primary">Подтвердить</button>
          <button className="btn">Опровергнуть</button>
        </div>
      </div>

      <div className="card p-6">
        <h3 className="font-semibold mb-2">Мои доверители</h3>
        <ul className="space-y-2">
          <li className="flex items-center justify-between">
            <div>Vault v1</div>
            <span className="badge">2 из 3 подтверждений</span>
          </li>
        </ul>
      </div>
    </main>
  )
}
