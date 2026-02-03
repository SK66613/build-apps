import { useEffect } from 'react';
import { AppRow } from '../lib/api';
import { setAppId, useCabinetStore } from '../lib/store';

export function AppPicker({ apps }: { apps: AppRow[] }){
  const { appId } = useCabinetStore();

  useEffect(()=>{
    // auto-pick first app if none chosen
    if (!appId && apps && apps.length) setAppId(apps[0].id);
  }, [appId, apps]);

  return (
    <select
      className="sg-input"
      value={appId ?? ''}
      onChange={(e)=> setAppId(e.target.value || null)}
      style={{ minWidth: 280 }}
    >
      {!apps.length && <option value="">Нет проектов</option>}
      {apps.map(a=> (
        <option key={a.id} value={a.id}>{a.title} ({a.id})</option>
      ))}
    </select>
  );
}
