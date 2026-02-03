import { setTheme, useCabinetStore } from '../lib/store';

export function ThemeToggle(){
  const { theme } = useCabinetStore();
  return (
    <button
      className="sg-btn"
      onClick={()=> setTheme(theme === 'dark' ? 'light' : 'dark')}
      title="Theme"
    >
      {theme === 'dark' ? '🌙 Dark' : '☀️ Light'}
    </button>
  );
}
