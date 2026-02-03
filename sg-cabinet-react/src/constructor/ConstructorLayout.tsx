import { TopBar } from './ui/TopBar';
import { PagesTree } from './ui/PagesTree';
import { BlocksPalette } from './ui/BlocksPalette';
import { Inspector } from './ui/Inspector';
import { PreviewFrame } from './preview/PreviewFrame';

export function ConstructorLayout(){
  return (
    <div className="sg-grid" style={{ gap: 14 }}>
      <TopBar />

      <div style={{ minHeight: 0, display: 'grid', gridTemplateColumns: '360px 1fr 360px', gap: 14 }}>
        <div style={{ minHeight: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <PagesTree />
          <BlocksPalette />
        </div>

        <div style={{ minHeight: 0 }}>
          <PreviewFrame />
        </div>

        <div style={{ minHeight: 0 }}>
          <Inspector />
        </div>
      </div>
    </div>
  );
}
