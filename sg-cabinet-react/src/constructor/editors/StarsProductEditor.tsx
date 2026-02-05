import React from 'react';
import { Input } from '../../components/ui';

function num(v:any, d:number){
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

export function StarsProductEditor({
  value,
  onChange,
}:{
  value: any;
  onChange: (next:any)=>void;
}){
  const props = value || {};
  const set = (patch:any)=> onChange({ ...props, ...patch });

  return (
    <div className="be">
      <div className="beGrid">
        <div className="beField">
          <div className="beLab">Название</div>
          <Input value={props.title ?? 'Товар'} onChange={e=>set({ title: e.target.value })} />
        </div>

        <div className="beField">
          <div className="beLab">Описание</div>
          <textarea
            className="beTa"
            rows={3}
            value={props.description ?? ''}
            onChange={(e)=>set({ description: e.target.value })}
          />
        </div>

        <div className="beField">
          <div className="beLab">Product ID (внутренний)</div>
          <Input value={props.product_id ?? ''} onChange={e=>set({ product_id: e.target.value })} />
        </div>

        <div className="beField">
          <div className="beLab">Фото (URL)</div>
          <Input value={props.photo_url ?? ''} onChange={e=>set({ photo_url: e.target.value })} />
        </div>

        <div className="beField">
          <div className="beLab">Цена (Stars)</div>
          <Input
            type="number"
            min={1}
            step={1}
            value={num(props.stars, 50)}
            onChange={e=>set({ stars: Math.max(1, Math.floor(num(e.target.value, 50))) })}
          />
        </div>

        <div className="beField">
          <div className="beLab">Количество (qty)</div>
          <Input
            type="number"
            min={1}
            step={1}
            value={num(props.qty, 1)}
            onChange={e=>set({ qty: Math.max(1, Math.floor(num(e.target.value, 1))) })}
          />
        </div>

        <div className="beField">
          <div className="beLab">Текст кнопки</div>
          <Input value={props.btn_text ?? 'Купить'} onChange={e=>set({ btn_text: e.target.value })} />
        </div>

        <div className="beField">
          <div className="beLab">Текст успеха</div>
          <Input value={props.success_text ?? 'Оплата успешна ✅'} onChange={e=>set({ success_text: e.target.value })} />
        </div>

        <div className="beField">
          <div className="beLab">Текст отмены</div>
          <Input value={props.cancel_text ?? 'Платёж отменён'} onChange={e=>set({ cancel_text: e.target.value })} />
        </div>

        <div className="beField">
          <div className="beLab">Текст ошибки</div>
          <Input value={props.fail_text ?? 'Ошибка оплаты'} onChange={e=>set({ fail_text: e.target.value })} />
        </div>
      </div>

      <div className="beHint">
        Оплата Stars выставляется от бота приложения. Stars зачисляются ему.
      </div>
    </div>
  );
}

export default StarsProductEditor;
