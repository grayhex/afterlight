export function Step({n, title, children}:{n:number; title:string; children?:React.ReactNode}){
  return (
    <div className="card p-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-8 h-8 rounded-full bg-ink text-white flex items-center justify-center">{n}</div>
        <h3 className="font-semibold">{title}</h3>
      </div>
      <div className="text-sm text-slate-600">{children}</div>
    </div>
  )
}
