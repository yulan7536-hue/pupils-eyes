import { useState, useEffect } from 'react';
import Header from './components/Header';
import OpeningVideo from './components/OpeningVideo';
import VineDoor from './components/VineDoor';
import ClayGlobe, { PinItem } from './components/ClayGlobe';
import PaperDetailModal from './components/PaperDetailModal';
import CreationModal, { SubmissionPayload } from './components/CreationModal';
import GalleryWall, { GalleryItem } from './components/GalleryWall';
import { 
  loadSavedWorks, 
  saveWorks, 
  loadSavedPins, 
  savePins,
  INITIAL_WORKS,
  INITIAL_PINS 
} from './data/initialWorks';
import { storySound } from './utils/sound';
import { Compass, Sparkles, MapPin, RefreshCw, CheckCircle2 } from 'lucide-react';

type SceneStep = 'BOOK_INTRO' | 'VINE_DOOR' | 'EXPLORE';

export default function App() {
  const [currentStep, setCurrentStep] = useState<SceneStep>('BOOK_INTRO');
  const [pins, setPins] = useState<PinItem[]>(() => loadSavedPins());
  const [works, setWorks] = useState<GalleryItem[]>(() => loadSavedWorks());
  const [selectedPin, setSelectedPin] = useState<PinItem | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [activeTargetCoord, setActiveTargetCoord] = useState<{ lat: number; lon: number } | null>(null);
  const [newlyDroppedPinId, setNewlyDroppedPinId] = useState<string | null>(null);
  const [highlightedWorkId, setHighlightedWorkId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);

  // 同步本地存储
  useEffect(() => {
    saveWorks(works);
  }, [works]);

  useEffect(() => {
    savePins(pins);
  }, [pins]);

  // 显示提示通知
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  // 1. 级联选择确定地点后触发：在 3D 地球表面实时渲染生成一枚新的 3D 泥塑图钉 Mesh，并平滑旋转对准
  const handlePinInserted = (coord: { lat: number; lon: number }, locationName: string) => {
    const previewPinId = `preview-${Date.now()}`;
    const previewPin: PinItem = {
      id: previewPinId,
      name: `童眼看${locationName.split('·').pop() || locationName}`,
      city: locationName,
      lat: coord.lat,
      lon: coord.lon,
      school: '新自然观察站',
      desc: `已在 3D 地球落钉！正在为【${locationName}】录入观察手记...`,
      role: 'STUDENT',
      date: '刚刚定格'
    };

    // 立即向 pins 数组推入新图钉，触发 ClayGlobe 动态渲染新 3D Mesh
    setPins((prev) => [previewPin, ...prev.filter(p => !p.id.startsWith('preview-'))]);
    setActiveTargetCoord(coord);
    setNewlyDroppedPinId(previewPinId);
    showToast(`📍 3D 地球表面已实时插上【${locationName}】泥塑图钉！`);
  };

  // 2. 表单完整提交后：将成果加入秘密花园画卷，并在 3D 地球上完成最终实体图钉定格
  const handleSubmitSuccess = (payload: SubmissionPayload) => {
    const finalPinId = `pin-${payload.id}`;
    const newPin: PinItem = {
      id: finalPinId,
      name: payload.title,
      city: `${payload.province}·${payload.city}·${payload.district}`,
      lat: payload.lat,
      lon: payload.lon,
      school: payload.school,
      role: payload.role,
      author: payload.author,
      date: payload.date,
      desc: payload.content.slice(0, 100) + (payload.content.length > 100 ? '...' : ''),
    };

    // 移除临时 preview，将正式图钉 Mesh 插入地球表面
    setPins((prev) => [newPin, ...prev.filter(p => !p.id.startsWith('preview-') && p.city !== newPin.city)]);
    setActiveTargetCoord({ lat: payload.lat, lon: payload.lon });
    setNewlyDroppedPinId(finalPinId);

    const newWork: GalleryItem = {
      ...payload,
      likes: 1,
      comments: [
        {
          id: `c-init-${Date.now()}`,
          user: '自然小助手',
          text: '欢迎加入童眼看自然共创网络！期待更多关于这里的自然发现。',
          time: '刚刚',
        },
      ],
    };

    setWorks((prev) => [newWork, ...prev]);
    setHighlightedWorkId(newWork.id);
    showToast(`🎉 3D 地球已定格【${newPin.city}】图钉，成果已入画卷！`);

    // 自动弹开选中的新图钉详情卡片，让用户在 3D 地球上立即翻阅
    setTimeout(() => {
      setSelectedPin(newPin);
    }, 600);
  };

  // 3. 点赞处理
  const handleItemLiked = (id: string) => {
    setWorks((prev) =>
      prev.map((item) => (item.id === id ? { ...item, likes: item.likes + 1 } : item))
    );
  };

  // 4. 提交便利贴评论
  const handleAddComment = (id: string, text: string) => {
    setWorks((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          return {
            ...item,
            comments: [
              ...item.comments,
              {
                id: `c-${Date.now()}`,
                user: '暖心访客',
                text,
                time: '刚刚',
              },
            ],
          };
        }
        return item;
      })
    );
    showToast('📝 手写便利贴已成功贴在作品下方！');
  };

  // 5. 从弹窗跳转到画卷
  const handleNavigateToGallery = (pinId: string) => {
    const matchedWork = works.find(
      (w) => w.id === pinId || pinId.includes(w.id) || w.title.includes(selectedPin?.name || '')
    );
    if (matchedWork) {
      setHighlightedWorkId(matchedWork.id);
      const el = document.getElementById(`work-${matchedWork.id}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } else {
      const el = document.getElementById('gallery-section');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  // 6. 重置回初始示例数据
  const handleResetData = () => {
    if (window.confirm('确认重置为初始演示数据吗？')) {
      setPins(INITIAL_PINS);
      setWorks(INITIAL_WORKS);
      showToast('已重置为初始示例数据');
    }
  };

  // 音效开关
  const handleToggleSound = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    storySound.setMuted(nextMuted);
    if (!nextMuted) {
      storySound.playChime();
    }
  };

  return (
    <div className="min-h-screen paper-bg font-serif text-[#1A3320] flex flex-col relative selection:bg-[#85A98F]/30">
      
      {/* 阶段 1：真视频立体书开幕 */}
      {currentStep === 'BOOK_INTRO' && (
        <OpeningVideo onComplete={() => setCurrentStep('VINE_DOOR')} />
      )}

      {/* 阶段 2：藤蔓之门与好奇之眼眨眼穿透 */}
      {currentStep === 'VINE_DOOR' && (
        <VineDoor onZoomThrough={() => setCurrentStep('EXPLORE')} />
      )}

      {/* 阶段 3：3D 定格地球与师生共创空间主界面 */}
      {currentStep === 'EXPLORE' && (
        <>
          {/* 顶部导航 */}
          <Header
            onOpenCreate={() => {
              storySound.playPaperTurn();
              setIsCreateModalOpen(true);
            }}
            onScrollToExplore={() => {
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onScrollToGallery={() => {
              const el = document.getElementById('gallery-section');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
            isMuted={isMuted}
            onToggleSound={handleToggleSound}
            pinCount={pins.length}
          />

          {/* 上半部：3D 泥塑小王子定格地球探索区 */}
          <section className="relative w-full h-[76vh] md:h-[80vh] border-b-2 border-[#1E3824] bg-[#EAEFE6] overflow-hidden">
            {/* 左上角手捏黏土标题说明卡片 */}
            <div className="absolute top-5 left-5 z-20 max-w-sm pointer-events-auto">
              <div className="clay-card p-5">
                <div className="flex items-center gap-2 text-xs text-[#52796F] font-black uppercase tracking-wider mb-1">
                  <Compass size={15} className="text-[#6E9277]" />
                  <span>Stop-Motion Clay Planet</span>
                </div>
                <h1 className="text-xl md:text-2xl font-black tracking-tight text-[#1E3824] font-serif">
                  童眼看世界 · 定格星体探索
                </h1>
                <p className="text-xs text-[#52796F] mt-2 leading-relaxed font-serif">
                  拖拽旋转定格黏土打造的绿色星球，轻触中国区域的陶土图钉翻开各地区师生的自然观察手记。
                </p>
                
                {/* 快捷点位切换胶囊 */}
                <div className="mt-3.5 pt-3 border-t-2 border-[#1E3824]/15 flex flex-wrap gap-1.5 items-center">
                  <span className="text-[11px] font-black text-[#52796F]">热点坐标：</span>
                  {pins.slice(0, 4).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setActiveTargetCoord({ lat: p.lat, lon: p.lon });
                        setSelectedPin(p);
                      }}
                      className="px-2.5 py-0.5 text-[11px] font-bold bg-[#FAF5E8] hover:bg-[#6E9277] hover:text-[#FAF5E8] border-2 border-[#1E3824] rounded-full transition-colors shadow-xs"
                    >
                      {p.city.split('·').pop()}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 右上角创建按钮悬浮辅助 */}
            <div className="absolute top-5 right-5 z-20 hidden sm:block">
              <button
                type="button"
                onClick={() => {
                  storySound.playPaperTurn();
                  setIsCreateModalOpen(true);
                }}
                className="clay-btn px-5 py-2.5 font-black text-xs md:text-sm flex items-center gap-2"
              >
                <Sparkles size={16} className="text-[#E6B84A]" />
                <span>童眼看 ______ (上传成果)</span>
              </button>
            </div>

            {/* 核心 3D 地球 Canvas */}
            <ClayGlobe
              pins={pins}
              onSelectPin={(pin) => setSelectedPin(pin)}
              activeTargetCoord={activeTargetCoord}
              newlyDroppedPinId={newlyDroppedPinId}
            />

            {/* 纸质图钉详情卡片弹窗 */}
            <PaperDetailModal
              pin={selectedPin}
              onClose={() => setSelectedPin(null)}
              onNavigateToGallery={handleNavigateToGallery}
            />
          </section>

          {/* 下半部：秘密花园师生手记画卷瀑布流 */}
          <section id="gallery-section" className="w-full bg-[#FAF7EE]/60 border-t border-[#1A3320]/15 py-6">
            <GalleryWall
              items={works}
              onItemLiked={handleItemLiked}
              onAddComment={handleAddComment}
              targetHighlightId={highlightedWorkId}
            />
          </section>

          {/* 阶段二：定制化上传与级联选择模态框 */}
          <CreationModal
            isOpen={isCreateModalOpen}
            onClose={() => setIsCreateModalOpen(false)}
            onSubmitSuccess={handleSubmitSuccess}
            onPinInserted={handlePinInserted}
          />

          {/* 底部极简版权与回放开幕序章入口 */}
          <footer className="w-full parchment-sheet border-t border-[#1A3320]/20 py-6 px-4 text-center text-xs text-[#52796F] select-none">
            <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span>🍃</span>
                <span>童眼看世界 · 电影《小王子》定格纸质美学教育展示网站</span>
              </div>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => {
                    storySound.playPaperTurn();
                    setCurrentStep('BOOK_INTRO');
                  }}
                  className="hover:text-[#1A3320] underline text-[11px]"
                >
                  重温开场立体书与藤蔓门
                </button>
                <button
                  type="button"
                  onClick={handleResetData}
                  className="hover:text-[#1A3320] underline text-[11px] flex items-center gap-1"
                >
                  <RefreshCw size={11} />
                  <span>重置演示点位</span>
                </button>
              </div>
            </div>
          </footer>

          {/* 手绘撕纸 Toast 提示条 */}
          {toastMessage && (
            <div className="fixed bottom-6 right-6 z-50 parchment-sheet px-4 py-2.5 hand-drawn-border hand-drawn-box flex items-center gap-2 text-xs md:text-sm font-bold text-[#1A3320] shadow-lg animate-in slide-in-from-bottom-3 duration-200">
              <CheckCircle2 size={16} className="text-[#85A98F] shrink-0" />
              <span>{toastMessage}</span>
            </div>
          )}
        </>
      )}

    </div>
  );
}
