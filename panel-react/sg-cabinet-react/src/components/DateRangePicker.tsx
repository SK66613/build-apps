import { addDays, formatISO } from 'date-fns';
import { setRange, useCabinetStore } from '../lib/store';

function iso(d: Date){
  return formatISO(d, { representation: 'date' });
}

export function DateRangePicker(){
  const { range } = useCabinetStore();

  const quick = (days: number)=>{
    const to = new Date();
    const from = addDays(to, -days);
    setRange({ from: iso(from), to: iso(to), tz: 'Europe/Berlin' });
  };

  return (
    <div style={{ display:'flex', gap:10, alignItems:'center' }}>
      <input
        className="sg-input"
        type="date"
        value={range.from}
        onChange={(e)=> setRange({ ...range, from: e.target.value })}
      />
      <span className="sg-muted">—</span>
      <input
        className="sg-input"
        type="date"
        value={range.to}
        onChange={(e)=> setRange({ ...range, to: e.target.value })}
      />
      <button className="sg-btn" onClick={()=> quick(0)}>Today</button>
      <button className="sg-btn" onClick={()=> quick(7)}>7d</button>
      <button className="sg-btn" onClick={()=> quick(30)}>30d</button>
    </div>
  );
}
