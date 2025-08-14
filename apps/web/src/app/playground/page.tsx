'use client';

import { useState, useRef } from "react";
import ClientOnly from "src/components/ClientOnly";

type Json = any;

function JsonView({data}:{data:Json}) {
  if (data == null) return null;
  return <pre>{JSON.stringify(data, null, 2)}</pre>;
}
function trim(u:string){ return u.endsWith("/") ? u.slice(0,-1) : u; }

export default function Playground() {
  const [baseUrl, setBaseUrl] = useState<string>(process.env.NEXT_PUBLIC_API_BASE || "https://api.afterl.ru");
  const [userId, setUserId]   = useState<string>(process.env.NEXT_PUBLIC_DEFAULT_USER_ID || "00000000-0000-4000-8000-000000000001");
  const [vaultId, setVaultId] = useState<string>("");
  const [blockId, setBlockId] = useState<string>("");
  const [out, setOut] = useState<Json>(null);
  const [busy, setBusy] = useState(false);

  const typeRef = useRef<HTMLSelectElement>(null);
  const metaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function api(path:string, init: RequestInit & {formData?: FormData} = {}){
    const url = trim(baseUrl) + path;
    const headers: Record<string,string> = { "x-user-id": userId };
    if (!init.formData) headers["Content-Type"] = "application/json";
    const res = await fetch(url, { method: "GET", ...init, headers: { ...(init.headers as any), ...headers }, body: init.formData ? init.formData : init.body });
    const text = await res.text(); let data:any = null;
    try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
    if (!res.ok) throw { status: res.status, data };
    return data;
  }

  return (
    <ClientOnly fallback={<main className="container">Loading…</main>}>
      <main className="container">
      <h1>Playground (MVP)</h1>

      <div className="card">
        <h3>Сессия</h3>
        <div className="grid grid-2">
          <label>API Base URL<input className="input" value={baseUrl} onChange={e=>setBaseUrl(e.target.value)} placeholder="https://api.afterl.ru" /></label>
          <label>User ID (x-user-id)<input className="input" value={userId} onChange={e=>setUserId(e.target.value)} placeholder="uuid" /></label>
        </div>
      </div>

      <div className="card">
        <h3>Health</h3>
        <button disabled={busy} className="btn" onClick={async()=>{ setBusy(true); try{ setOut(await api("/healthz")); } catch(e:any){ setOut(e); } finally{ setBusy(false);} }}>GET /healthz</button>
        <span style={{marginLeft:8}}></span>
        <button disabled={busy} className="btn" onClick={async()=>{ setBusy(true); try{ setOut(await api("/readyz")); } catch(e:any){ setOut(e); } finally{ setBusy(false);} }}>GET /readyz</button>
      </div>

      <div className="card">
        <h3>Vaults</h3>
        <div className="grid grid-2">
          <button disabled={busy} className="btn" onClick={async()=>{
            setBusy(true);
            try {
              const v = await api("/vaults", { method: "POST", body: JSON.stringify({ is_demo: true, quorum_threshold: 3, max_verifiers: 5, heartbeat_timeout_days: 60, grace_hours: 24 }) });
              setOut(v);
              if (v?.id) setVaultId(v.id);
            } catch(e:any){ setOut(e); } finally { setBusy(false); }
          }}>POST /vaults (Create)</button>

          <button disabled={busy || !vaultId} className="btn" onClick={async()=>{
            setBusy(true);
            try { setOut(await api(`/vaults/${vaultId}`)); } catch(e:any){ setOut(e); } finally { setBusy(false); }
          }}>GET /vaults/{'{vaultId}'}</button>
        </div>
        <p className="small">vaultId: {vaultId || '—'}</p>
      </div>

      <div className="card">
        <h3>Blocks (multipart)</h3>
        <div className="grid grid-2">
          <label>vaultId<input className="input" value={vaultId} onChange={e=>setVaultId(e.target.value)} /></label>
          <label>type<select id="blk-type" ref={typeRef} className="input" defaultValue="text"><option value="text">text</option><option value="file">file</option><option value="url">url</option></select></label>
          <label>metadata (JSON)<textarea id="blk-meta" ref={metaRef} className="input">{'{"category":"pets"}'}</textarea></label>
          <label>file<input id="blk-file" ref={fileRef} type="file" className="input" /></label>
        </div>
        <div style={{marginTop:8}}>
          <button disabled={busy || !vaultId} className="btn" onClick={async()=>{
            setBusy(true);
            try {
              const fd = new FormData();
              fd.append("vault_id", vaultId);
              fd.append("type", typeRef.current?.value || "");
              fd.append("metadata", metaRef.current?.value || "");
              const fin = fileRef.current;
              if (fin?.files && fin.files.length) fd.append("content", fin.files[0]);
              const b = await api("/blocks", { method: "POST", formData: fd });
              setOut(b); if (b?.id) setBlockId(b.id);
            } catch(e:any){ setOut(e); } finally { setBusy(false); }
          }}>POST /blocks (Create)</button>
          <span className="small" style={{marginLeft:8}}>blockId: {blockId || '—'}</span>
        </div>
      </div>

      <div className="card">
        <h3>Вывод</h3>
        <JsonView data={out} />
      </div>

      <p className="small">Playground — упрощённый интерфейс для ручного теста API. Авторизации нет; используется заголовок <code>x-user-id</code>.</p>
      </main>
    </ClientOnly>
  );
}
