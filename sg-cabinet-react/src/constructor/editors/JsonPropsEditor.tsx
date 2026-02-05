import React from 'react';
import { Button } from '../../components/ui';

export function JsonPropsEditor({
  value,
  onChange,
}:{
  value: any;
  onChange: (next:any)=>void;
}){
  const [text, setText] = React.useState(()=>JSON.stringify(value || {}, null, 2));
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(()=>{
    setText(JSON.stringify(value || {}, null, 2));
    setErr(null);
  }, [value]);

  const apply = ()=>{
    try{
      const obj = JSON.parse(text || '{}');
      setErr(null);
      onChange(obj);
    }catch(e:any){
      setErr(e?.message || 'bad json');
    }
  };

  return (
    <div className="be">
      <div className="beHint">Нет спец-редактора для этого блока. Можно править props JSON.</div>
      <textarea className="beTa" rows={16} value={text} onChange={e=>setText(e.target.value)} />
      {err ? <div className="beErr">{err}</div> : null}
      <div style={{display:'flex', justifyContent:'flex-end', gap:10}}>
        <Button onClick={apply}>Применить</Button>
      </div>
    </div>
  );
}

export default JsonPropsEditor;
