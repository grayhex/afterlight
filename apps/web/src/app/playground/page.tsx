'use client';

import ClientOnly from '../lib/ClientOnly';
import React, { useEffect, useState } from 'react';

type Json = any;
function useLocalStorage(key: string, initial: string) {
  const [val, setVal] = useState<string>(() => {
    if (typeof window === 'undefined') return initial;
    try { return window.localStorage.getItem(key) ?? initial; } catch { return initial; }
  });
  useEffect(() => { try { window.localStorage.setItem(key, val); } catch {} }, [key, val]);
  return [val, setVal] as const;
}
function Section({title, children}: {title: string, children: React.ReactNode}) {
  return (<section style={{border:'1px solid #e5e7eb', borderRadius:12, padding:16, marginBottom:16}}><h2 style={{fontWeight:600, fontSize:18, marginBottom:12}}>{title}</h2>{children}</section>);
}
function Field({label, children}: {label: string, children: React.ReactNode}) {
  return (<label style={{display:'flex', flexDirection:'column', gap:6, marginBottom:12}}><span style={{fontSize:12, color:'#6b7280'}}>{label}</span>{children}</label>);
}
function Btn(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const {children, ...rest} = props;
  return <button {...rest} style={{padding:'8px 12px', border:'1px solid #e5e7eb', borderRadius:8, background:'white'}}>{children}</button>;
}
function JsonView({data}: {data: Json}) { if (data == null) return null; return <pre style={{fontSize:12, background:'#f9fafb', borderRadius:8, padding:12, maxHeight:300, overflow:'auto'}}>{JSON.stringify(data, null, 2)}</pre>; }
function trimTrailingSlash(u: string) { return u.endsWith('/') ? u.slice(0, -1) : u; }

export default function Playground() {
  const defaultBase = process.env.NEXT_PUBLIC_API_BASE || 'https://api.afterl.ru';
  const defaultUser = process.env.NEXT_PUBLIC_DEFAULT_USER_ID || '00000000-0000-4000-8000-000000000001';
  const [baseUrl, setBaseUrl] = useLocalStorage('al.baseUrl', defaultBase);
  const [userId, setUserId] = useLocalStorage('al.userId', defaultUser);
  const [vaultId, setVaultId] = useLocalStorage('al.vaultId', '');
  const [blockId, setBlockId] = useLocalStorage('al.blockId', '');
  const [recipientId, setRecipientId] = useLocalStorage('al.recipientId', '');
  const [verifierId, setVerifierId] = useLocalStorage('al.verifierId', '');
  const [out, setOut] = useState<Json>(null);
  const [busy, setBusy] = useState(false);

  async function api(path: string, init: RequestInit & { formData?: FormData } = {}) {
    const url = trimTrailingSlash(baseUrl) + path;
    const headers: Record<string,string> = { 'x-user-id': userId };
    if (!init.formData) headers['Content-Type'] = 'application/json';
    const res = await fetch(url, { method: 'GET', ...init, headers: { ...(init.headers as any), ...headers }, body: init.formData ? init.formData : init.body });
    const text = await res.text(); let data: any = null;
    try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
    if (!res.ok) throw { status: res.status, data }; return data;
  }

  return (
    <ClientOnly>
      <div style={{maxWidth:960, margin:'0 auto', padding:16}}>
        <h1 style={{fontSize:24, fontWeight:700, marginBottom:16}}>AfterLight — Playground (MVP)</h1>

        <Section title="Настройки сессии">
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16}}>
            <Field label="API Base URL"><input style={{border:'1px solid #e5e7eb', borderRadius:8, padding:'8px 12px'}} value={baseUrl} onChange={e=>setBaseUrl(e.target.value)} placeholder="https://api.afterl.ru"/></Field>
            <Field label="User ID (x-user-id)"><input style={{border:'1px solid #e5e7eb', borderRadius:8, padding:'8px 12px'}} value={userId} onChange={e=>setUserId(e.target.value)} placeholder="uuid"/></Field>
          </div>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:16}}>
            <Field label="vaultId"><input style={{border:'1px solid #e5e7eb', borderRadius:8, padding:'8px 12px'}} value={vaultId} onChange={e=>setVaultId(e.target.value)} placeholder="uuid"/></Field>
            <Field label="blockId"><input style={{border:'1px solid #e5e7eb', borderRadius:8, padding:'8px 12px'}} value={blockId} onChange={e=>setBlockId(e.target.value)} placeholder="uuid"/></Field>
            <Field label="recipientId"><input style={{border:'1px solid #e5e7eb', borderRadius:8, padding:'8px 12px'}} value={recipientId} onChange={(e)=>setRecipientId(e.target.value)} placeholder="uuid"/></Field>
            <Field label="verifierId"><input style={{border:'1px solid #e5e7eb', borderRadius:8, padding:'8px 12px'}} value={verifierId} onChange={(e)=>setVerifierId(e.target.value)} placeholder="uuid"/></Field>
          </div>
        </Section>

        <Section title="Health">
          <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
            <Btn disabled={busy} onClick={async ()=>{ setBusy(true); try { setOut(await api('/healthz')); } catch(e:any){ setOut(e); } finally { setBusy(false); } }}>GET /healthz</Btn>
            <Btn disabled={busy} onClick={async ()=>{ setBusy(true); try { setOut(await api('/readyz')); } catch(e:any){ setOut(e); } finally { setBusy(false); } }}>GET /readyz</Btn>
          </div>
        </Section>

        <Section title="Vaults">
          <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
            <Btn disabled={busy} onClick={async ()=>{ setBusy(true); try {
              const data = await api('/vaults', { method: 'POST', body: JSON.stringify({ is_demo: true, quorum_threshold: 3, max_verifiers: 5, heartbeat_timeout_days: 60, grace_hours: 24 })});
              setOut(data); if (data?.id) setVaultId(data.id);
            } catch(e:any){ setOut(e); } finally { setBusy(false); } }}>POST /vaults (Create)</Btn>
            <Btn disabled={busy || !vaultId} onClick={async ()=>{ setBusy(true); try { setOut(await api(`/vaults/${vaultId}`)); } catch(e:any){ setOut(e); } finally { setBusy(false); } }}>GET /vaults/{'{vaultId}'}</Btn>
          </div>
        </Section>

        <Section title="Recipients">
          <div style={{display:'flex', gap:8, alignItems:'end', flexWrap:'wrap'}}>
            <Field label="contact (email/phone)"><input id="rec-contact" style={{border:'1px solid #e5e7eb', borderRadius:8, padding:'8px 12px'}} defaultValue="recipient@example.com"/></Field>
            <Field label="pubkey (optional)"><input id="rec-pubkey" style={{border:'1px solid #e5e7eb', borderRadius:8, padding:'8px 12px'}} placeholder="base64"/></Field>
            <Btn disabled={busy} onClick={async ()=>{ setBusy(true); try {
              const contact = (document.getElementById('rec-contact') as HTMLInputElement).value;
              const pubkey = (document.getElementById('rec-pubkey') as HTMLInputElement).value || null;
              const data = await api('/recipients', { method: 'POST', body: JSON.stringify({ contact, pubkey })});
              setOut(data); if (data?.id) setRecipientId(data.id);
            } catch(e:any){ setOut(e); } finally { setBusy(false); } }}>POST /recipients (Create)</Btn>
          </div>
        </Section>

        <Section title="Blocks (multipart)">
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16}}>
            <Field label="type"><select id="blk-type" style={{border:'1px solid #e5e7eb', borderRadius:8, padding:'8px 12px'}} defaultValue="text"><option value="text">text</option><option value="file">file</option><option value="url">url</option></select></Field>
            <Field label="tags (comma-separated)"><input id="blk-tags" style={{border:'1px solid #e5e7eb', borderRadius:8, padding:'8px 12px'}} defaultValue="pets,care"/></Field>
            <Field label="metadata (JSON string)"><textarea id="blk-meta" style={{border:'1px solid #e5e7eb', borderRadius:8, padding:'8px 12px'}} defaultValue='{"category":"pets","title":"Инструкции по питомцу"}'/></Field>
            <Field label="content (file)"><input id="blk-file" type="file" style={{border:'1px solid #e5e7eb', borderRadius:8, padding:'8px 12px'}}/></Field>
          </div>
          <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
            <Btn disabled={busy || !vaultId} onClick={async ()=>{ setBusy(true); try {
              const fd = new FormData();
              fd.append('vault_id', vaultId);
              fd.append('type', (document.getElementById('blk-type') as HTMLSelectElement).value);
              fd.append('tags', (document.getElementById('blk-tags') as HTMLInputElement).value);
              fd.append('metadata', (document.getElementById('blk-meta') as HTMLTextAreaElement).value);
              const fileIn = (document.getElementById('blk-file') as HTMLInputElement);
              if (fileIn?.files && fileIn.files.length > 0) fd.append('content', fileIn.files[0]);
              const data = await api('/blocks', { method: 'POST', formData: fd });
              setOut(data); if (data?.id) setBlockId(data.id);
            } catch(e:any){ setOut(e); } finally { setBusy(false); } }}>POST /blocks (Create)</Btn>
            <Btn disabled={busy || !blockId} onClick={async ()=>{ setBusy(true); try { setOut(await api(`/blocks/${blockId}`)); } catch(e:any){ setOut(e); } finally { setBusy(false); } }}>GET /blocks/{'{blockId}'}</Btn>
          </div>
        </Section>

        <Section title="Block → Recipients">
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16}}>
            <Field label="recipient_id"><input id="br-recipient" style={{border:'1px solid #e5e7eb', borderRadius:8, padding:'8px 12px'}} value={recipientId} onChange={(e)=>setRecipientId(e.target.value)}/></Field>
            <Field label="dek_wrapped_for_recipient"><input id="br-dek" style={{border:'1px solid #e5e7eb', borderRadius:8, padding:'8px 12px'}} placeholder="base64:WRAPPED_DEK"/></Field>
          </div>
          <Btn disabled={busy || !blockId || !recipientId} onClick={async ()=>{ setBusy(true); try {
            const dek = (document.getElementById('br-dek') as HTMLInputElement).value || 'base64:ENVELOPE_KEY_FOR_RECIPIENT';
            const data = await api(`/blocks/${blockId}/recipients`, { method: 'POST', body: JSON.stringify({ recipient_id: recipientId, dek_wrapped_for_recipient: dek })});
            setOut(data);
          } catch(e:any){ setOut(e); } finally { setBusy(false); } }}>POST /blocks/{'{blockId}'}/recipients</Btn>
        </Section>

        <Section title="Public Link for Block">
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:16}}>
            <Field label="enabled"><select id="pl-enabled" style={{border:'1px solid #e5e7eb', borderRadius:8, padding:'8px 12px'}} defaultValue="true"><option value="true">true</option><option value="false">false</option></select></Field>
            <Field label="publish_from (ISO)"><input id="pl-from" style={{border:'1px solid '#e5e7eb', borderRadius:8, padding:'8px 12px'}} defaultValue={new Date().toISOString()}/></Field>
            <Field label="publish_until (ISO or empty)"><input id="pl-until" style={{border:'1px solid #e5e7eb', borderRadius:8, padding:'8px 12px'}} placeholder=""/></Field>
            <Field label="max_views (optional)"><input id="pl-max" style={{border:'1px solid #e5e7eb', borderRadius:8, padding:'8px 12px'}} placeholder="10"/></Field>
          </div>
          <Btn disabled={busy || !blockId} onClick={async ()=>{ setBusy(true); try {
            const enabled = (document.getElementById('pl-enabled') as HTMLSelectElement).value === 'true';
            const publish_from = (document.getElementById('pl-from') as HTMLInputElement).value;
            const publish_until = (document.getElementById('pl-until') as HTMLInputElement).value || null;
            const max_viewsStr = (document.getElementById('pl-max') as HTMLInputElement).value;
            const max_views = max_viewsStr ? Number(max_viewsStr) : null;
            const data = await api(`/blocks/${blockId}/public`, { method: 'PUT', body: JSON.stringify({ enabled, publish_from, publish_until, max_views })});
            setOut(data);
          } catch(e:any){ setOut(e); } finally { setBusy(false); } }}>PUT /blocks/{'{blockId}'}/public</Btn>
        </Section>

        <Section title="Verifiers & Orchestrator">
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:16}}>
            <Field label="Invite verifier (contact)"><input id="inv-contact" style={{border:'1px solid #e5e7eb', borderRadius:8, padding:'8px 12px'}} defaultValue="verifier1@example.com"/></Field>
            <Field label="channel"><select id="inv-channel" style={{border:'1px solid #e5e7eb', borderRadius:8, padding:'8px 12px'}} defaultValue="email"><option value="email">email</option><option value="sms">sms</option></select></Field>
            <Field label="expires_in_hours"><input id="inv-expires" style={{border:'1px solid #e5e7eb', borderRadius:8, padding:'8px 12px'}} defaultValue="168"/></Field>
          </div>
          <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
            <Btn disabled={busy || !vaultId} onClick={async ()=>{ setBusy(true); try {
              const contact = (document.getElementById('inv-contact') as HTMLInputElement).value;
              const channel = (document.getElementById('inv-channel') as HTMLSelectElement).value;
              const expires_in_hours = Number((document.getElementById('inv-expires') as HTMLInputElement).value || '168');
              const data = await api('/verifiers/invitations', { method: 'POST', body: JSON.stringify({ vault_id: vaultId, contact, channel, expires_in_hours })});
              setOut(data);
            } catch(e:any){ setOut(e); } finally { setBusy(false); } }}>POST /verifiers/invitations</Btn>
            <Btn disabled={busy || !vaultId} onClick={async ()=>{ setBusy(true); try { setOut(await api('/orchestration/start', { method: 'POST', body: JSON.stringify({ vault_id: vaultId }) })); } catch(e:any){ setOut(e); } finally { setBusy(false); } }}>POST /orchestration/start</Btn>
            <Btn disabled={busy || !vaultId || !verifierId} onClick={async ()=>{ setBusy(true); try {
              const data = await api('/orchestration/decision', { method: 'POST', body: JSON.stringify({ vault_id: vaultId, verifier_id: verifierId, decision: 'Confirm' }) });
              setOut(data);
            } catch(e:any){ setOut(e); } finally { setBusy(false); } }}>POST decision Confirm</Btn>
            <Btn disabled={busy || !vaultId || !verifierId} onClick={async ()=>{ setBusy(true); try {
              const data = await api('/orchestration/decision', { method: 'POST', body: JSON.stringify({ vault_id: vaultId, verifier_id: verifierId, decision: 'Deny' }) });
              setOut(data);
            } catch(e:any){ setOut(e); } finally { setBusy(false); } }}>POST decision Deny</Btn>
          </div>
        </Section>

        <Section title="Heartbeat">
          <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
            <Btn disabled={busy || !vaultId} onClick={async ()=>{ setBusy(true); try { setOut(await api(`/vaults/${vaultId}/heartbeat`)); } catch(e:any){ setOut(e); } finally { setBusy(false); } }}>GET /vaults/{'{vaultId}'}/heartbeat</Btn>
            <Btn disabled={busy || !vaultId} onClick={async ()=>{ setBusy(true); try { setOut(await api(`/vaults/${vaultId}/heartbeat`, { method: 'PATCH', body: JSON.stringify({ method: 'manual', timeout_days: 60 }) })); } catch(e:any){ setOut(e); } finally { setBusy(false); } }}>PATCH /vaults/{'{vaultId}'}/heartbeat</Btn>
            <Btn disabled={busy || !vaultId} onClick={async ()=>{ setBusy(true); try { setOut(await api('/heartbeats/ping', { method: 'POST', body: JSON.stringify({ vault_id: vaultId, method: 'manual' }) })); } catch(e:any){ setOut(e); } finally { setBusy(false); } }}>POST /heartbeats/ping</Btn>
          </div>
        </Section>

        <Section title="Вывод">
          <JsonView data={out} />
        </Section>

        <p style={{fontSize:12, color:'#6b7280', marginTop:16}}>
          Playground — вспомогательный UI для ручного теста API. Использует заголовок <code>x-user-id</code>; авторизации нет.
        </p>
      </div>
    </ClientOnly>
  );
}
