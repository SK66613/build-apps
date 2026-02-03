import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export function SettingsPage(){
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: () => api.auth.logout(),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['auth.me'] });
      location.href = '/login';
    }
  });

  return (
    <div>
      <h1 className="sg-h1">Settings</h1>
      <div className="sg-muted">Выход, настройки проекта, runtime overrides</div>

      <div className="sg-card" style={{ marginTop: 14 }}>
        <button className="sg-btn" onClick={()=>m.mutate()} disabled={m.isPending}>
          {m.isPending ? 'Выходим…' : 'Logout'}
        </button>
      </div>
    </div>
  );
}
