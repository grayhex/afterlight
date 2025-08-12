import { blocks } from '@/mock/data';

export default function Recipient(){
  return (
    <main className="container-narrow py-8 space-y-4">
      <div className="card p-6">
        <h3 className="font-semibold mb-2">Доступные мне блоки</h3>
        <div className="grid md:grid-cols-2 gap-4">
          {blocks.map(b => (
            <div key={b.id} className="card p-4">
              <div className="flex items-center justify-between mb-1">
                <div className="font-medium">Блок #{b.id}</div>
                <span className="badge">{b.type}</span>
              </div>
              <div className="text-xs text-slate-500 mb-1">Теги: {b.tags.join(', ')}</div>
              <div className="text-xs text-slate-500">Дата обновления: {new Date(b.updated_at).toLocaleString()}</div>
              <div className="mt-3">
                <button className="btn btn-primary">Скачать запакованный контент</button>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="card p-6">
        <h3 className="font-semibold mb-1">Как расшифровать</h3>
        <ol className="list-decimal pl-5 text-sm text-slate-600 space-y-1">
          <li>Скачайте файл и откройте страницу расшифровки.</li>
          <li>Вставьте свой приватный ключ/кастодиальный токен.</li>
          <li>Нажмите «Расшифровать» — результат сохранится локально.</li>
        </ol>
      </div>
    </main>
  )
}
