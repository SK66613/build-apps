import React from 'react';
import { apiFetch } from '../../lib/api';
import { useConstructorStore } from '../state/constructorStore';

export function TopBar(){
  const appId = useConstructorStore(s=>s.appId);
  const dirty = useConstructorStore(s=>s.dirty);
  const saveState = useConstructorStore(s=>s.saveState);
  const setSaveState = useConstructorStore(s=>s.setSaveState);
  const markSaved = useConstructorStore(s=>s.markSaved);
  const bp = useConstructorStore(s=>s.blueprint);

  const onSave = async () => {
    if (!appId) return;
    setSaveState('saving');
    try{
      await apiFetch<any>(`/api/app/${encodeURIComponent(appId)}/config`, {
        method: 'PUT',
        body: JSON.stringify({ config: bp }),
      });
      markSaved();
    }catch(e){
      console.warn('[ctor] save failed', e);
      setSaveState('error');
    }
  };

  const stText = saveState === 'saving'
    ? 'Сохраняю…'
    : saveState === 'saved'
      ? 'Сохранено'
      : saveState === 'error'
        ? 'Ошибка сохранения'
        : (dirty ? 'Есть несохранённые изменения' : 'Готово');

  return (
    <div className="sg-card" style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap: 12 }}>
      <div>
        <div className="sg-h1" style={{ margin: 0 }}>Конструктор</div>
        <div className="sg-muted">{appId ? `App: ${appId} • ${stText}` : 'Выбери проект слева'}</div>
      </div>

      <div style={{ display:'flex', gap: 10, alignItems:'center' }}>
        <button
          className={`sg-btn ${dirty ? 'primary' : ''}`}
          onClick={onSave}
          disabled={!appId || saveState === 'saving'}
        >
          {saveState === 'saving' ? 'Сохраняю…' : 'Сохранить'}
        </button>
      </div>
    </div>
  );
}
