import React from "react";
import { apiFetch } from "../lib/api";
import { useI18n } from "../i18n";
import { LanguageSelect } from "../components/LanguageSelect";

type AppRow = { id: string; title: string; public_id?: string; status?: string };
type TemplateRow = { id?: string; key?: string; template_id?: string; title?: string; name?: string };

function getTplId(t: any){
  return String(t?.id || t?.key || t?.template_id || "blank");
}
function getTplTitle(t: any){
  return String(t?.title || t?.name || getTplId(t));
}

export default function Projects() {
  const { t } = useI18n();

  const [apps, setApps] = React.useState<AppRow[]>([]);
  const [templates, setTemplates] = React.useState<TemplateRow[]>([]);
  const [busy, setBusy] = React.useState(false);

  const [title, setTitle] = React.useState("");
  const [templateId, setTemplateId] = React.useState("blank");

  const load = React.useCallback(async () => {
    const a = await apiFetch<any>("/api/apps"); // alias на /api/my/apps
    setApps(a.apps || a.items || []);
    try {
      const tt = await apiFetch<any>("/api/templates");
      setTemplates(tt.templates || tt.catalog || tt.items || []);
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
    localStorage.setItem("sg_app_id", appId);
    window.location.href = "/panel-react/#/";
  }

  return (
    <div className="cab-page">
      <div className="cab-topbar">
        <div className="cab-brand">
          <div className="cab-logo">SG</div>
          <div className="cab-title">
            <div className="t1">Sales Genius</div>
            <div className="t2">{t("cabinet.title")}</div>
          </div>
        </div>

        <div className="cab-actions">
          <LanguageSelect disabled={busy} className="lang-select" />

          <button className="sg-btn ghost" onClick={load} disabled={busy}>
            {t("common.refresh")}
          </button>
          <button className="sg-btn" onClick={logout} disabled={busy}>
            {t("common.logout")}
          </button>
        </div>
      </div>

      <div className="cab-create">
        <input
          className="sg-input"
          placeholder={t("cabinet.projectName")}
          value={title}
          onChange={(e)=>setTitle(e.target.value)}
        />
        <select className="sg-input" value={templateId} onChange={(e)=>setTemplateId(e.target.value)}>
          <option value="blank">Blank</option>
          {templates.map((tt:any)=>(
            <option key={getTplId(tt)} value={getTplId(tt)}>{getTplTitle(tt)}</option>
          ))}
        </select>
        <button className="sg-btn" disabled={busy} onClick={createApp}>
          {t("cabinet.newProject")}
        </button>
      </div>

      <div className="cab-grid">
        {apps.map(a=>(
          <div key={a.id} className="cab-card">
            <div className="cab-card-title">{a.title}</div>
            <div className="cab-card-sub">id: {a.id}</div>
            <div className="cab-card-row">
              <button className="sg-btn" onClick={()=>openApp(a.id)}>
                {t("cabinet.open")}
              </button>
            </div>
          </div>
        ))}
        {!apps.length && (
          <div className="cab-empty">{t("cabinet.empty")}</div>
        )}
      </div>
    </div>
  );
}
