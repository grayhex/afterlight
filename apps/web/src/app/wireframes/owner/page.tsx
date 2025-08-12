'use client';
import { useState } from 'react';
import { vaults, blocks, verifiers } from '@/mock/data';

export default function Owner() {
  const [selectedVault, setSelectedVault] = useState(vaults[0]?.id || '');

  return (
    <div className="container-narrow py-8 grid md:grid-cols-[260px,1fr] gap-6">
      <aside className="card p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold">Мои сейфы</h3>
          <a className="btn btn-primary" href="/wireframes/owner/wizard">Создать</a>
        </div>
        <ul className="space-y-1">
          {vaults.map(v => (
            <li key={v.id}>
              <button className={`w-full text-left px-3 py-2 rounded-lg ${selectedVault===v.id?'bg-slate-100':''}`}
                onClick={() => setSelectedVault(v.id)}>
                #{v.id} — <span className="text-xs badge">{v.status}</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <main className="space-y-6">
        <section className="card p-6">
          <h3 className="font-semibold mb-4">Блоки сейфа</h3>
          <div className="grid md:grid-cols-2 gap-4">
            {blocks.filter(b => b.vault_id===selectedVault).map(b => (
              <div className="card p-4" key={b.id}>
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium">Блок #{b.id}</div>
                  <span className="badge">{b.type}</span>
                </div>
                <div className="text-xs text-slate-500 mb-2">Теги: {b.tags.join(', ')}</div>
                <div className="text-xs text-slate-500">Обновлён: {new Date(b.updated_at).toLocaleString()}</div>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <a className="btn" href="/wireframes/owner/wizard?step=2">Добавить блок</a>
          </div>
        </section>

        <section className="card p-6">
          <h3 className="font-semibold mb-4">Верификаторы</h3>
          <div className="grid md:grid-cols-2 gap-4">
            {verifiers.map(v => (
              <div key={v.id} className="card p-4 flex items-center justify-between">
                <div>
                  <div className="font-medium">{v.contact}</div>
                  <div className="text-xs text-slate-500">{v.role_status}</div>
                </div>
                {v.is_primary && <span className="badge">Primary</span>}
              </div>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <a className="btn" href="/wireframes/owner/wizard?step=3">Пригласить</a>
            <a className="btn" href="/wireframes/owner/wizard?step=4">Настроить пороги</a>
          </div>
        </section>
      </main>
    </div>
  );
}
