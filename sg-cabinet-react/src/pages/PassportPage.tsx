import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useCabinetStore } from '../lib/store';

export function PassportPage(){
  const { appId, range } = useCabinetStore();
  const q = useQuery({
    queryKey: ['passport.stats', appId, range],
    enabled: !!appId,
    queryFn: () => api.passport.stats(appId!, range) as Promise<any>,
  });

  return (
    <div>
      <h1 className="sg-h1">Passport</h1>
      <div className="sg-muted">Штампы/стили: прогресс, награды, подтверждения</div>
      <div className="sg-card" style={{ marginTop: 14 }}>
        {q.isLoading && <div className="sg-muted">Загрузка…</div>}
        {q.isError && <div className="sg-muted">Ошибка: {(q.error as Error).message}</div>}
        {q.data && <pre style={{ margin:0, whiteSpace:'pre-wrap' }}>{JSON.stringify(q.data, null, 2)}</pre>}
      </div>
    </div>
  );
}
