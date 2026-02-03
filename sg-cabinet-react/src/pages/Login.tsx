import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../app/auth';
import { apiFetch } from '../lib/api';
import { Button, Card, Input, Label } from '../components/ui';

export default function Login(){
  const { me, refresh } = useAuth();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  if (me?.authenticated) return <Navigate to="/" replace />;

  async function onSubmit(e: React.FormEvent){
    e.preventDefault();
    setError(null);
    setLoading(true);
    try{
      await apiFetch<any>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      await refresh();
    }catch(err: any){
      setError(err?.message || 'Login failed');
    }finally{
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight:'100vh', display:'grid', placeItems:'center', padding: 16 }}>
      <Card style={{ width:'100%', maxWidth: 420, padding: 18 }}>
        <div style={{ fontWeight: 1000, fontSize: 18 }}>Вход в кабинет</div>
        <div style={{ color:'var(--muted)', fontWeight: 800, marginTop: 4 }}>Используй email + пароль (как в текущем auth.html).</div>

        <form onSubmit={onSubmit} style={{ display:'grid', gap: 10, marginTop: 14 }}>
          <div style={{ display:'grid', gap: 6 }}>
            <Label>Email</Label>
            <Input value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@company.com" />
          </div>
          <div style={{ display:'grid', gap: 6 }}>
            <Label>Пароль</Label>
            <Input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" />
          </div>

          {error && <div style={{ color: '#ef4444', fontWeight: 900 }}>{error}</div>}

          <Button variant="primary" type="submit" disabled={loading}>
            {loading ? 'Входим…' : 'Войти'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
