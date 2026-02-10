import React from "react";
import { apiFetch } from "../lib/api";

type AppRow = { id: string; title: string; public_id?: string; status?: string };
type TemplateRow = { id?: string; key?: string; template_id?: string; title?: string; name?: string };

function getTplId(t: any){
  return String(t?.id || t?.key || t?.template_id || "blank");
}
function getTplTitle(t: any){
  return String(t?.title || t?.name || getTplId(t));
}

export default function Projects() {
  const [apps, setApps] = React.useState<AppRow[]>([]);
  const [templates, setTemplates] = React.useState<TemplateRow[]>([]);
  const [busy, setBusy] = React.useState(false);

  const [title, setTitle] = React.useState("");
  const [templateId, setTemplateId] = React.useState("blank");

  const load = React.useCallback(async () => {
    const a = await apiFetch<any>("/api/apps"); // alias на /api/my/apps
    setApps(a.apps || a.items || []);
    try {
      const t = await apiFetch<any>("/api/templates");
      setTemplates(t.templates || t.catalog || t.items || []);
    } catch (_) {
      setTemplates([]);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  async function logout(){
    try{ await apiFetch<any>("/api/auth/logout", { method:"POST" }); }catch(_){}
    window.location.href = "/panel-react/#/login";
  }

  async function createApp(){
    setBusy(true);
    try{
      const body = { title: (title.trim() || "New mini-app"), template_id: templateId };
      const r = await apiFetch<any>("/api/app", { method:"POST", body: JSON.stringify(body) });
      await load();
      if (r?.id) openApp(r.id);
    } finally {
      setBusy(false);
    }
  }

  function openApp(appId: string){
    // сохраняем выбранный проект так, как удобно твоей панели
    localStorage.setItem("sg_app_id", appId);
    // переход в панель (как ты попросил)
    window.location.href = "/panel-react/#/";
  }

  return (
    <div className="cab-page">
      <div className="cab-topbar">
        <div className="cab-brand">
          <div className="cab-logo">SG</div>
          <div className="cab-title">
            <div className="t1">Sales Genius</div>
            <div className="t2">Кабинет проектов</div>
          </div>
        </div>

        <div className="cab-actions">
          <button className="sg-btn ghost" onClick={load} disabled={busy}>Обновить</button>
          <button className="sg-btn" onClick={logout} disabled={busy}>Выйти</button>
        </div>
      </div>

      <div className="cab-create">
        <input
          className="sg-input"
          placeholder="Название mini-app"
          value={title}
          onChange={(e)=>setTitle(e.target.value)}
        />
        <select className="sg-input" value={templateId} onChange={(e)=>setTemplateId(e.target.value)}>
          <option value="blank">Blank</option>
          {templates.map((t:any)=>(
            <option key={getTplId(t)} value={getTplId(t)}>{getTplTitle(t)}</option>
          ))}
        </select>
        <button className="sg-btn" disabled={busy} onClick={createApp}>Создать проект</button>
      </div>

      <div className="cab-grid">
        {apps.map(a=>(
          <div key={a.id} className="cab-card">
            <div className="cab-card-title">{a.title}</div>
            <div className="cab-card-sub">id: {a.id}</div>
            <div className="cab-card-row">
              <button className="sg-btn" onClick={()=>openApp(a.id)}>Открыть</button>
            </div>
          </div>
        ))}
        {!apps.length && (
          <div className="cab-empty">Проектов пока нет — создай первый.</div>
        )}
      </div>
    </div>
  );
}
