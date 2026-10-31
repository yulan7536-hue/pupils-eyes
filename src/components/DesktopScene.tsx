import { useState } from 'react';
import { PinItem } from './ClayGlobe';
import ClayGlobe from './ClayGlobe';
import TeacherJournalDrawer from './TeacherJournalDrawer';
import StudentPhotoScatter from './StudentPhotoScatter';
import PopUpDetailCard from './PopUpDetailCard';
import FloralVineFrame from './FloralVineFrame';
import { GalleryItem } from './GalleryWall';
import AudioDiscWidget from './AudioDiscWidget';
import { PlusCircle, MapPin, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { storySound } from '../utils/sound';

interface DesktopSceneProps {
  pins: PinItem[];
  works: GalleryItem[];
  selectedPin: PinItem | null;
  onSelectPin: (pin: PinItem) => void;
  activeTargetCoord: { lat: number; lon: number } | null;
  newlyDroppedPinId: string | null;
  onOpenCreate: () => void;
  onItemLiked: (id: string) => void;
  onAddComment: (id: string, text: string) => void;
  isMuted: boolean;
  onToggleSound: () => void;
  onResetIntro: () => void;
}

export default function DesktopScene({
  pins,
  works,
  selectedPin,
  onSelectPin,
  activeTargetCoord,
  newlyDroppedPinId,
  onOpenCreate,
  onItemLiked,
  onAddComment,
  isMuted,
  onToggleSound,
  onResetIntro,
}: DesktopSceneProps) {
  const [activePopupWork, setActivePopupWork] = useState<GalleryItem | null>(null);
  const [isGlobeZoomed, setIsGlobeZoomed] = useState<boolean>(false);

  // 当地球上点击某个图钉时，自动对应到该成果并以 3D 立体书形式翻起
  const handlePinSelected = (pin: PinItem) => {
    onSelectPin(pin);
    const matchedWork = works.find(
      (w) => w.id === pin.id || pin.id.includes(w.id) || w.title.includes(pin.name)
    );
    if (matchedWork) {
      setActivePopupWork(matchedWork);
    }
  };

  const toggleGlobeZoom = () => {
    setIsGlobeZoomed((prev) => !prev);
  };

  return (
    <div className="relative w-full h-screen overflow-hidden select-none bg-[#244E32] flex flex-col justify-between">
      
      {/* 
        【阶段 3：主场景“魔法草坪（秘密小空间）”背景氛围】
        底部是绿草坪，像秘密基地一样的小空间，温润阳光穿透林隙，柔和光斑
      */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 50% 30%, #E8F5E9 0%, #A5D6A7 30%, #438A5E 70%, #204C30 100%)'
        }}
      />

      {/* 底部茂盛魔法绿草坪地表层 */}
      <div 
        className="absolute bottom-0 inset-x-0 h-48 sm:h-64 pointer-events-none"
        style={{
          background: 'linear-gradient(to top, #1B3F27 0%, #2B5E3A 40%, rgba(43,94,58,0.7) 75%, transparent 100%)'
        }}
      />

      {/* 
        【画框式生态装饰】：屏幕【上方、左侧、右侧】边缘都被长满鲜花的藤蔓包裹环绕（纯画框装饰，不是门）
      */}
      <FloralVineFrame />

      {/* 
        【顶部 UI 导航栏】：
        - 左上角图标与标题：童眼看世界 · 行智开物 成果展示（行动的行、智力的智、天工开物的开物）
        - 右上角按钮：上传课题
      */}
      <header className="relative z-30 w-full px-6 md:px-12 pt-5 pb-2 flex items-center justify-between pointer-events-none">
        
        {/* 左上角：童眼看世界 · 行智开物 成果展示 */}
        <div className="pointer-events-auto flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#1E4D2B] text-white flex items-center justify-center text-xl shadow-md border border-white/20">
            🌱
          </div>
          <div className="flex flex-col">
            <h1 className="font-serif font-black text-lg md:text-xl text-[#0F2917] tracking-wider leading-tight drop-shadow-xs">
              童眼看世界 · 行智开物 成果展示
            </h1>
            <span className="text-[11px] text-[#1E4D2B] font-serif font-medium tracking-wide">
              行动实践 · 智力启发 · 天工开物
            </span>
          </div>
        </div>

        {/* 右上角按钮：上传课题 */}
        <div className="pointer-events-auto flex items-center gap-3">
          <button
            type="button"
            onClick={onOpenCreate}
            className="group cursor-pointer flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#1E4D2B] hover:bg-[#2A663A] text-white shadow-xl border border-white/25 transition-all duration-300 hover:scale-105 active:scale-95"
          >
            <PlusCircle size={16} className="text-[#FFE066] group-hover:rotate-90 transition-transform duration-300" />
            <span className="font-serif font-bold text-xs md:text-sm tracking-wider">
              上传课题
            </span>
          </button>
        </div>
      </header>

      {/* 
        【阶段 3 中央核心区域：课桌与三件套】
        草坪正中央放着一张课桌，上面摆放三样物品：
        1. 左侧（教案本）：一本普通的红色笔记本（Notebook），封面上写着《教案实录手账》。
        2. 中间（黏土地球仪）：一个黏土质感（Clay）的地球仪，处于持续自转状态，表面钉着图钉。点击放大到屏幕中央。
        3. 右侧（成果相册）：一本厚重的精装相册，四个角有铁片/金属包角装饰，封面上写着《学生成果展示》。
      */}
      <main className="relative flex-1 w-full flex items-center justify-center px-4 sm:px-8 md:px-14 overflow-hidden">
        
        {/* 
          草坪中央的实木课桌基座表面 
        */}
        <div className={`relative w-full max-w-5xl h-[70vh] flex items-center justify-between transition-all duration-500 ${isGlobeZoomed ? 'scale-95' : 'scale-100'}`}>
          
          {/* 实木课桌桌面投影与木纹板面 */}
          <div 
            className="absolute inset-x-4 inset-y-8 rounded-3xl pointer-events-none shadow-2xl border border-[#2B1B10]/20"
            style={{
              background: 'linear-gradient(135deg, #E6D2B5 0%, #D8BE9A 40%, #C4A47C 100%)',
              boxShadow: '0 25px 50px -12px rgba(18, 40, 24, 0.45), inset 0 2px 4px rgba(255, 255, 255, 0.4)',
            }}
          >
            {/* 木质倒角边框 */}
            <div className="absolute inset-2 rounded-2xl border border-[#8C6239]/20 pointer-events-none" />
            {/* 课桌上的刻度尺与手绘铅笔装饰 */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4 text-[#8C6239]/40 text-[10px] font-mono tracking-widest pointer-events-none">
              <span>—— 10cm ——</span>
              <span>行智开物工作台</span>
              <span>—— 20cm ——</span>
            </div>
          </div>

          {/* 
            【三件套 1：左侧（教案本）】
            一本普通的红色笔记本（Notebook），封面上写着《教案实录手账》
          */}
          <div className={`z-20 shrink-0 ml-4 sm:ml-8 transition-all duration-500 ${isGlobeZoomed ? 'opacity-40 pointer-events-none scale-90 -translate-x-8' : 'opacity-100 pointer-events-auto scale-100'}`}>
            <TeacherJournalDrawer
              items={works}
              onSelectWork={(w) => setActivePopupWork(w)}
            />
          </div>

          {/* 
            【三件套 2：中间（黏土地球仪）】
            黏土质感地球仪，处于持续自转状态，表面钉着图钉。
            点击课桌中间的“黏土地球仪”，地球仪会放大到屏幕中央（放大后依然保持自转），清晰看图钉。
          */}
          <div className={`absolute inset-0 flex items-center justify-center z-10 transition-all duration-500 pointer-events-auto`}>
            {/* 地球仪底座托盘 */}
            <div className={`absolute bottom-12 w-48 h-8 rounded-full bg-[#3E2723]/30 blur-sm pointer-events-none transition-opacity duration-500 ${isGlobeZoomed ? 'opacity-0' : 'opacity-100'}`} />

            <div className="w-full h-full">
              <ClayGlobe
                pins={pins}
                selectedPin={selectedPin}
                onSelectPin={handlePinSelected}
                activeTargetCoord={activeTargetCoord}
                newlyDroppedPinId={newlyDroppedPinId}
                isZoomed={isGlobeZoomed}
                onToggleZoom={toggleGlobeZoom}
              />
            </div>
          </div>

          {/* 
            【三件套 3：右侧（成果相册）】
            一本厚重的精装相册，四个角有铁片/金属包角装饰，封面上写着《学生成果展示》
          */}
          <div className={`z-20 shrink-0 mr-4 sm:mr-8 transition-all duration-500 ${isGlobeZoomed ? 'opacity-40 pointer-events-none scale-90 translate-x-8' : 'opacity-100 pointer-events-auto scale-100'}`}>
            <StudentPhotoScatter
              items={works}
              onSelectWork={(w) => setActivePopupWork(w)}
            />
          </div>

        </div>

      </main>

      {/* 底部课桌控制栏 */}
      <footer className="relative z-30 w-full px-6 md:px-12 py-3 flex items-center justify-between text-xs text-[#1E4D2B] pointer-events-none">
        
        {/* 左下角：已定格的代表性区县坐标 */}
        <div className="pointer-events-auto hidden sm:flex items-center gap-2">
          <span className="font-bold flex items-center gap-1 text-[#0F2917] text-[11px]">
            <MapPin size={13} className="text-[#1E4D2B]" />
            <span>快速聚焦：</span>
          </span>
          {pins.slice(0, 4).map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                storySound.playPinDrop();
                handlePinSelected(p);
              }}
              className="px-2.5 py-0.5 rounded-full bg-white/85 hover:bg-[#1E4D2B] hover:text-white text-[11px] font-bold text-[#0F2917] transition-all cursor-pointer shadow-xs"
            >
              童眼看 {p.city.split('·').pop()}
            </button>
          ))}
        </div>

        {/* 右下角：放大切换与开场重温 */}
        <div className="pointer-events-auto flex items-center gap-4">
          <button
            type="button"
            onClick={toggleGlobeZoom}
            className="px-3 py-1 rounded-full bg-white/80 hover:bg-white text-[11px] font-bold text-[#0F2917] flex items-center gap-1 cursor-pointer transition-all shadow-xs"
          >
            {isGlobeZoomed ? <ZoomOut size={12} /> : <ZoomIn size={12} />}
            <span>{isGlobeZoomed ? '恢复全景课桌' : '放大黏土地球仪'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              storySound.playPaperTurn();
              onResetIntro();
            }}
            className="hover:text-[#0F2917] underline text-[11px] flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw size={11} />
            <span>重温开场流程</span>
          </button>
        </div>
      </footer>

      {/* 成果 3D 立体卡片弹窗 */}
      {activePopupWork && (
        <PopUpDetailCard
          item={activePopupWork}
          onClose={() => setActivePopupWork(null)}
          onLike={onItemLiked}
          onAddComment={onAddComment}
        />
      )}

      {/* 悬浮八音盒音乐转盘 */}
      <AudioDiscWidget 
        isMuted={isMuted} 
        onToggleSound={onToggleSound} 
      />

    </div>
  );
}
