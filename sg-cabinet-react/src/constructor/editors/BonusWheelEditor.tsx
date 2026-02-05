import React from 'react';
import { Button, Input } from '../../components/ui';

type Prize = {
  code: string;
  name: string;
  coins: number;
  weight: number;
  img?: string;
};

function num(v:any, d:number){
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

export function BonusWheelEditor({
  value,
  onChange,
}:{
  value: any;
  onChange: (next:any)=>void;
}){
  const props = value || {};
  const prizes: Prize[] = Array.isArray(props.prizes) ? props.prizes : [];

  const set = (patch: any)=> onChange({ ...props, ...patch });

  const updPrize = (i:number, patch: Partial<Prize>)=>{
    const next = prizes.map((p, idx)=> idx === i ? ({ ...p, ...patch }) : p);
    set({ prizes: next });
  };

  const addPrize = ()=>{
    const next: Prize = { code:'prize', name:'Приз', coins: 0, weight: 1, img:'' };
    set({ prizes: [...prizes, next] });
  };

  const delPrize = (i:number)=>{
    const next = prizes.filter((_, idx)=>idx!==i);
    set({ prizes: next });
  };

  return (
    <div className="be">
      <div className="beGrid">
        <div className="beField">
          <div className="beLab">Заголовок</div>
          <Input value={props.title ?? 'Колесо бонусов'} onChange={e=>set({ title: e.target.value })} />
        </div>

        <div className="beField">
          <div className="beLab">Стоимость прокрутки (монеты)</div>
          <Input
            type="number"
            min={0}
            step={1}
            value={num(props.spin_cost, 10)}
            onChange={e=>set({ spin_cost: Math.max(0, Math.floor(num(e.target.value, 10))) })}
          />
          <div className="beHint">
            Важно: стоимость используется воркером из <b>app_config.wheel.spin_cost</b>.
          </div>
        </div>
      </div>

      <div className="beSep" />

      <div className="beHdrRow">
        <div className="beHdr">Сектора / призы</div>
        <Button onClick={addPrize}>+ Добавить приз</Button>
      </div>

      <div className="beList">
        {prizes.map((p, i)=>(
          <div key={i} className="beCard">
            <div className="beCardTop">
              <div className="beCardTitle">Приз #{i+1}</div>
              <button className="beDanger" type="button" onClick={()=>delPrize(i)}>Удалить</button>
            </div>

            <div className="beGrid2">
              <div className="beField">
                <div className="beLab">Код</div>
                <Input value={p.code ?? ''} onChange={e=>updPrize(i,{ code:e.target.value })} />
                <div className="beHint">Код должен совпадать с тем, что вернёт сервер (prize.code).</div>
              </div>

              <div className="beField">
                <div className="beLab">Название</div>
                <Input value={p.name ?? ''} onChange={e=>updPrize(i,{ name:e.target.value })} />
              </div>

              <div className="beField">
                <div className="beLab">Монеты</div>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={num(p.coins, 0)}
                  onChange={e=>updPrize(i,{ coins: Math.max(0, Math.floor(num(e.target.value, 0))) })}
                />
              </div>

              <div className="beField">
                <div className="beLab">Вес (шанс)</div>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={num(p.weight, 1)}
                  onChange={e=>updPrize(i,{ weight: Math.max(0, Math.floor(num(e.target.value, 1))) })}
                />
              </div>

              <div className="beField beSpan2">
                <div className="beLab">Картинка (URL)</div>
                <Input value={p.img ?? ''} onChange={e=>updPrize(i,{ img:e.target.value })} />
                <div className="beHint">Загрузку файла прикрутим следующим шагом (как в старом).</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default BonusWheelEditor;
