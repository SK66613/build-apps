import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

export function LoginPage(){
  const nav = useNavigate();
  const loc = useLocation() as any;
  const qc = useQueryClient();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const m = useMutation({
    mutationFn: () => api.auth.login(email, password),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['auth.me'] });
      nav(loc.state?.from || '/overview', { replace: true });
    }
  });

  return (
    <div className="sg-page-center">
      <div className="sg-card" style={{ width: 420 }}>
        <div className="sg-h1">Вход</div>
        <div className="sg-muted" style={{ marginBottom: 14 }}>Sales Genius cabinet</div>

        <div style={{ display:'grid', gap: 10 }}>
          <input className="sg-input" placeholder="email" value={email} onChange={(e)=>setEmail(e.target.value)} />
          <input className="sg-input" placeholder="password" type="password" value={password} onChange={(e)=>setPassword(e.target.value)} />
          <button className="sg-btn primary" onClick={()=>m.mutate()} disabled={m.isPending}>
            {m.isPending ? 'Входим…' : 'Войти'}
          </button>
          {m.isError && <div className="sg-muted">Ошибка: {(m.error as Error).message}</div>}
        </div>
      </div>
    </div>
  );
}
