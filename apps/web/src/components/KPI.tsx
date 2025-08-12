export function KPI({label, value}:{label:string; value:string}){
  return (
    <div className="card p-4 text-center">
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  )
}
