import React from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../lib/api';

type MsgType = 'error' | 'success' | '';

function mapError(code: string){
  switch(code){
    case 'EMAIL_EXISTS': return 'Этот e-mail уже зарегистрирован. Попробуй войти.';
    case 'BAD_EMAIL': return 'Некорректный e-mail.';
    case 'WEAK_PASSWORD': return 'Пароль слишком короткий.';
    case 'INVALID_CREDENTIALS':
    case 'BAD_CREDENTIALS': return 'Неверный e-mail или пароль.';
    case 'EMAIL_OR_PASSWORD_MISSING': return 'Заполни e-mail и пароль.';
    case 'BAD_INPUT': return 'Проверь e-mail и пароль (пароль минимум 6 символов).';
    case 'EMAIL_NOT_VERIFIED': return 'E-mail ещё не подтверждён.';
    default: return code ? `Ошибка: ${code}` : 'Ошибка';
  }
}

export default function Login(){
  const nav = useNavigate();
  const [mode, setMode] = React.useState<'login'|'register'>(() => {
    const sp = new URLSearchParams(window.location.search);
    return (sp.get('mode') === 'register') ? 'register' : 'login';
  });

  const [msg, setMsg] = React.useState<{text:string; type:MsgType}>({text:'', type:''});
  const [busy, setBusy] = React.useState(false);

  const [loginEmail, setLoginEmail] = React.useState('');
  const [loginPass, setLoginPass] = React.useState('');

  const [regName, setRegName] = React.useState('');
  const [regEmail, setRegEmail] = React.useState('');
  const [regPass, setRegPass] = React.useState('');

  // если уже залогинен — сразу в projects
  React.useEffect(()=>{
    (async ()=>{
      try{
        const me = await apiFetch<any>('/api/auth/me');
        if (me?.ok && me?.authenticated) nav('/projects', { replace:true });
      }catch(_){}
    })();
  }, [nav]);

  const apiPost = async (path: string, body: any) => {
    return apiFetch<any>(path, { method:'POST', body: JSON.stringify(body||{}) });
  };

  const doLogin = async () => {
    if (!loginEmail.trim() || !loginPass) {
      setMsg({text:'Заполни e-mail и пароль.', type:'error'});
      return;
    }
    setBusy(true);
    setMsg({text:'Проверяем данные…', type:''});
    try{
      const data = await apiPost('/api/auth/login', { email: loginEmail.trim(), password: loginPass });
      if (!data?.ok) throw { message: data?.error || 'LOGIN_FAILED' };
      try{ localStorage.setItem('sg_user_email', loginEmail.trim()); }catch(_){}
      setMsg({text:'Готово, заходим в кабинет…', type:'success'});
      setTimeout(()=> nav('/projects', { replace:true }), 250);
    }catch(e:any){
      setMsg({text: mapError(String(e?.message || e)), type:'error'});
    }finally{
      setBusy(false);
    }
  };

  const doRegister = async () => {
    if (!regEmail.trim() || !regPass) {
      setMsg({text:'Заполни e-mail и пароль.', type:'error'});
      return;
    }
    setBusy(true);
    setMsg({text:'Создаём аккаунт…', type:''});
    try{
      const data = await apiPost('/api/auth/register', { name: regName.trim(), email: regEmail.trim(), password: regPass });
      if (!data?.ok) throw { message: data?.error || 'REGISTER_FAILED' };
      // авто-логин
      setLoginEmail(regEmail.trim());
      setLoginPass(regPass);
      await apiPost('/api/auth/login', { email: regEmail.trim(), password: regPass });
      setMsg({text:'Аккаунт создан. Заходим…', type:'success'});
      setTimeout(()=> nav('/projects', { replace:true }), 250);
    }catch(e:any){
      setMsg({text: mapError(String(e?.message || e)), type:'error'});
    }finally{
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight:'100vh', display:'grid', placeItems:'center', padding:16 }}>
      <div style={{ width:'100%', maxWidth:420, borderRadius:18, border:'1px solid rgba(148,163,184,.35)', padding:18, background:'rgba(255,255,255,.92)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
          <div style={{ fontWeight:900 }}>Sales Genius</div>
          <div style={{ fontSize:12, opacity:.7 }}>Вход в кабинет</div>
        </div>

        <div style={{ display:'flex', gap:8, marginTop:14 }}>
          <button disabled={busy} onClick={()=>{setMode('login'); setMsg({text:'',type:''});}} style={{ flex:1, padding:10, borderRadius:12, border:'1px solid rgba(15,23,42,.12)', fontWeight:900, background: mode==='login' ? 'rgba(34,211,238,.16)' : 'transparent' }}>Вход</button>
          <button disabled={busy} onClick={()=>{setMode('register'); setMsg({text:'',type:''});}} style={{ flex:1, padding:10, borderRadius:12, border:'1px solid rgba(15,23,42,.12)', fontWeight:900, background: mode==='register' ? 'rgba(34,211,238,.16)' : 'transparent' }}>Регистрация</button>
        </div>

        {msg.text && (
          <div style={{ marginTop:12, padding:'10px 12px', borderRadius:12,
            background: msg.type==='error' ? 'rgba(239,68,68,.12)' : 'rgba(34,197,94,.12)',
            border: '1px solid rgba(15,23,42,.10)',
            fontWeight:700
          }}>
            {msg.text}
          </div>
        )}

        {mode==='login' ? (
          <form onSubmit={(e)=>{e.preventDefault(); doLogin();}} style={{ display:'grid', gap:10, marginTop:14 }}>
            <label style={{ fontSize:12, opacity:.7 }}>Email</label>
            <input value={loginEmail} onChange={e=>setLoginEmail(e.target.value)} className="sg-input" />
            <label style={{ fontSize:12, opacity:.7 }}>Пароль</label>
            <input value={loginPass} onChange={e=>setLoginPass(e.target.value)} type="password" className="sg-input" />
            <button disabled={busy} className="sg-btn" type="submit">Войти</button>
          </form>
        ) : (
          <form onSubmit={(e)=>{e.preventDefault(); doRegister();}} style={{ display:'grid', gap:10, marginTop:14 }}>
            <label style={{ fontSize:12, opacity:.7 }}>Имя</label>
            <input value={regName} onChange={e=>setRegName(e.target.value)} className="sg-input" />
            <label style={{ fontSize:12, opacity:.7 }}>Email</label>
            <input value={regEmail} onChange={e=>setRegEmail(e.target.value)} className="sg-input" />
            <label style={{ fontSize:12, opacity:.7 }}>Пароль</label>
            <input value={regPass} onChange={e=>setRegPass(e.target.value)} type="password" className="sg-input" />
            <button disabled={busy} className="sg-btn" type="submit">Создать аккаунт</button>
          </form>
        )}
      </div>
    </div>
  );
}
