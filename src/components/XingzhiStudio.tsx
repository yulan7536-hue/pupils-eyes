/**
 * 童眼工作台 · 主页面容器
 * 对应方案 4.6（原 App.vue）：父子品牌导航栏 + 标语 + 两块工作台并排。
 * 在「童眼看世界」里它不是一个独立站点，而是覆盖在 3D 课桌之上的一层工作区，
 * 关掉就回到课桌，场景状态不受影响。
 */
import HeaderNav from './HeaderNav';
import SensoryHarvest from './SensoryHarvest';
import FourDimRefine from './FourDimRefine';

type Props = {
  onClose: () => void;
  onSync: (filled: number) => void;
};

export default function XingzhiStudio({ onClose, onSync }: Props) {
  return (
    <div className="xzs" role="dialog" aria-modal="true" aria-label="童眼工作台">
      {/* 顶部柔光与纸纹：和课桌场景的黏土质感接上，不让浅色页面显得突兀 */}
      <div className="xzs__aura" aria-hidden="true" />

      <HeaderNav onClose={onClose} />

      <main className="xzs__main">
        <div className="xzs__banner">
          <h1 className="xzs__h1">用第一手感官，看透世界的真实细节</h1>
          <p className="xzs__p">让每一次创作都扎根于真实体验，在人机协同中看见童眼视角的无限可能。</p>
        </div>

        <div className="xzs__grid">
          <SensoryHarvest />
          <FourDimRefine onSync={onSync} />
        </div>
      </main>
    </div>
  );
}
