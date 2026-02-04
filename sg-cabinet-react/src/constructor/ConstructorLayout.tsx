import { TopBar } from './ui/TopBar';
import { PagesTree } from './ui/PagesTree';
import { BlocksPalette } from './ui/BlocksPalette';
import { Inspector } from './ui/Inspector';
import { PreviewFrame } from './preview/PreviewFrame';

export function ConstructorLayout(){
  return (
    <div className="ctor">
      <TopBar />

      <div className="ctor__body">
        {/* LEFT */}
        <div className="ctor__left">
          <PagesTree />
          <BlocksPalette />
        </div>

        {/* CENTER */}
        <div className="ctor__center">
          <PreviewFrame />
        </div>

        {/* RIGHT */}
        <div className="ctor__right">
          <Inspector />
        </div>
      </div>
    </div>
  );
}
