import React from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import { setAppId } from '../lib/store';

type AppRow = { id: string; title: string; public_id?: string; publicId?: string; status?: string };
type TemplatesResp = { ok?: boolean; templates?: any[]; catalog?: any[]; items?: any[] };

export default function Projects(){
  const nav = useNavigate();
  const [apps, setApps] = React.useState<AppRow[]>([]);
  const [title, setTitle] = React.useState('');
  const [templateId, setTemplateId] = React.useState('blank');
  const [templates, setTemplates] = React.useState<any[]>([]);
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async ()=>{
    const a = await apiFetch<any>('/api/apps');
    setApps(a.apps || a.items || []);
    try{
      const t = await apiFetch<TemplatesResp>('/api/templates');
      setTemplates(t.templates || t.catalog || t.items || []);
    }catch(_){
      setTemplates([]);
    }
  }, []);

  React.useEffect(()=>{ load(); }, [load]);

  const createApp = async ()=>{
    const t = title.trim() || 'New mini-app';
    setBusy(true);
    try{
      const r = await apiFetch<any>('/api/app', { method:'POST', body: JSON.stringify({ title: t, template_id: templateId }) });
      await load();
      // сразу открыть студию
      setAppId(r.id);
      nav(`/constructor?app_id=${encodeURIComponent(r.id)}`);
    } finally {
      setBusy(false);
    }
  };

  const openApp = (id: string)=>{
    setAppId(id);
    nav(`/constructor?app_id=${encodeURIComponent(id)}`);
  };

  return (
    <div style={{ padding: 18 }}>
      <div style={{ display:'flex', gap: 10, alignItems:'center', justifyContent:'space-between', flexWrap:'wrap' }}>
        <div style={{ fontWeight: 900, fontSize: 22 }}>Проекты</div>
        <div style={{ display:'flex', gap: 10, alignItems:'center', flexWrap:'wrap' }}>
          <input className="sg-input" placeholder="Название mini-app" value={title} onChange={e=>setTitle(e.target.value)} style={{ minWidth: 260 }} />
          <select className="sg-input" value={templateId} onChange={e=>setTemplateId(e.target.value)} style={{ minWidth: 220 }}>
            <option value="blank">Blank</option>
            {templates.map((t:any)=>(
              <option key={String(t.id||t.key||t.template_id)} value={String(t.id||t.key||t.template_id)}>
                {String(t.title||t.name||t.id)}
              </option>
            ))}
          </select>
          <button className="sg-btn" disabled={busy} onClick={createApp}>Создать</button>
        </div>
      </div>

      <div style={{ marginTop: 14, display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
        {apps.map(a=>(
          <div key={a.id} style={{ border:'1px solid rgba(15,23,42,.12)', borderRadius: 16, padding: 14, background:'rgba(255,255,255,.92)' }}>
            <div style={{ fontWeight: 900 }}>{a.title}</div>
            <div style={{ fontSize: 12, opacity: .7, marginTop: 6 }}>id: {a.id}</div>
            <div style={{ display:'flex', gap: 10, marginTop: 12 }}>
              <button className="sg-btn" onClick={()=>openApp(a.id)}>Открыть Studio</button>
            </div>
          </div>
        ))}
        {!apps.length && (
          <div style={{ opacity:.7, padding: 14 }}>Проектов пока нет — создай первый.</div>
        )}
      </div>
    </div>
  );
}
