import { useState, useEffect } from 'react';
import OpeningVideo from './components/OpeningVideo';
import LightChaseScene from './components/LightChaseScene';
import DesktopScene from './components/DesktopScene';
import RegionPickerModal from './components/RegionPickerModal';
import PinDropOverlay from './components/PinDropOverlay';
import CreationModal, { SubmissionPayload } from './components/CreationModal';
import { PinItem } from './components/ClayGlobe';
import { GalleryItem } from './components/GalleryWall';
import { 
  loadSavedWorks, 
  saveWorks, 
  loadSavedPins, 
  savePins, 
} from './data/initialWorks';
import { storySound } from './utils/sound';
import { extractInterdisciplinaryTags } from './utils/aiTags';
import { CheckCircle2 } from 'lucide-react';

// 4阶段完整交互流程
type SceneStep = 'STAGE_1_INTRO' | 'STAGE_2_LIGHT_CHASE' | 'STAGE_3_MAIN_LAWN';

export default function App() {
  // 当前处于的流程阶段
  const [currentStep, setCurrentStep] = useState<SceneStep>('STAGE_1_INTRO');

  // 数据状态
  const [pins, setPins] = useState<PinItem[]>(() => loadSavedPins());
  const [works, setWorks] = useState<GalleryItem[]>(() => loadSavedWorks());
  const [selectedPin, setSelectedPin] = useState<PinItem | null>(null);

  // 阶段 4：“上传课题”工作流控制
  const [isRegionPickerOpen, setIsRegionPickerOpen] = useState(false);
  const [isPinDroppingAnim, setIsPinDroppingAnim] = useState(false);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);

  // 临时暂存正在选定的地区数据
  const [selectedLocation, setSelectedLocation] = useState<{
    province: string;
    city: string;
    district: string;
    lat: number;
    lon: number;
    locationString: string;
  } | null>(null);

  const [activeTargetCoord, setActiveTargetCoord] = useState<{ lat: number; lon: number } | null>(null);
  const [newlyDroppedPinId, setNewlyDroppedPinId] = useState<string | null>(null);
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

  /**
   * 阶段 4 上传课题流程步骤 1 & 2：
   * 点击确认坐标后，这个小的地区选择框自动关闭，触发钉图钉动画
   */
  const handleConfirmLocation = (
    coord: { lat: number; lon: number },
    locationString: string,
    details: { province: string; city: string; district: string }
  ) => {
    setIsRegionPickerOpen(false);
    setSelectedLocation({
      ...details,
      lat: coord.lat,
      lon: coord.lon,
      locationString,
    });

    // 旋转地球仪使坐标对准正前方视野
    setActiveTargetCoord(coord);

    // 步骤 3：紧接着播放钉图钉动画——“啪”地一下把图钉钉在地球仪刚刚选好的位置上
    setIsPinDroppingAnim(true);
  };

  /**
   * 阶段 4 上传课题流程步骤 3 动画结束：
   * 钉图钉动画结束后，在地球上挂上新图钉并立刻弹出【身份选择】窗口
   */
  const handlePinDropAnimComplete = () => {
    setIsPinDroppingAnim(false);

    if (selectedLocation) {
      const previewPinId = `preview-${Date.now()}`;
      const previewPin: PinItem = {
        id: previewPinId,
        name: `童眼看${selectedLocation.district}`,
        city: selectedLocation.locationString,
        lat: selectedLocation.lat,
        lon: selectedLocation.lon,
        school: '行智开物工作站',
        desc: `已在 3D 地球落钉！正在为【${selectedLocation.locationString}】录入成果...`,
        role: 'STUDENT',
        date: '刚刚落钉'
      };

      setPins((prev) => [previewPin, ...prev.filter(p => !p.id.startsWith('preview-'))]);
      setNewlyDroppedPinId(previewPinId);
    }

    // 步骤 4：立刻弹出【身份选择】窗口
    setIsRoleModalOpen(true);
  };

  /**
   * 阶段 4 上传课题流程步骤 5：
   * 表单完整提交后：归档成果至学生相册/教师手账，并正式定格图钉
   */
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

    // 移除临时 preview，插入正式图钉
    setPins((prev) => [newPin, ...prev.filter(p => !p.id.startsWith('preview-') && p.city !== newPin.city)]);
    setActiveTargetCoord({ lat: payload.lat, lon: payload.lon });
    setNewlyDroppedPinId(finalPinId);

    const tags = extractInterdisciplinaryTags(payload.content, payload.title);

    const newWork: GalleryItem = {
      ...payload,
      likes: 1,
      comments: [
        {
          id: `c-init-${Date.now()}`,
          user: '行智开物导师',
          text: `欢迎加入童眼看世界共创网络！已自动归档至【${tags.join(' / ')}】实践库。`,
          time: '刚刚',
        },
      ],
    };

    setWorks((prev) => [newWork, ...prev]);
    showToast(`🎉 3D 地球已定格【童眼看 ${newPin.city.split('·').pop()}】图钉，成果已放入魔法课桌！`);
  };

  // 点赞处理
  const handleItemLiked = (id: string) => {
    setWorks((prev) =>
      prev.map((item) => (item.id === id ? { ...item, likes: item.likes + 1 } : item))
    );
  };

  // 评论便签
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
                user: '同行学者',
                text,
                time: '刚刚',
              },
            ],
          };
        }
        return item;
      })
    );
    showToast('📝 读者便签已成功贴在成果下方！');
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
    <div className="w-full h-screen overflow-hidden bg-[#000000] font-serif text-[#122818] relative selection:bg-[#327346]/20">
      
      {/* 
        【阶段 1：10秒开场动画（必须完整保留，不可省去！）】
        播完后无藤蔓门，直接平滑淡出切换至阶段 2
      */}
      {currentStep === 'STAGE_1_INTRO' && (
        <OpeningVideo onComplete={() => setCurrentStep('STAGE_2_LIGHT_CHASE')} />
      )}

      {/* 
        【阶段 2：黑屏追光与白光转场】
        全黑背景、光点逃逸、2.5秒定格稳住、白色发光楷体字“点击灵感之光”、白光铺满转场进入主场景
      */}
      {currentStep === 'STAGE_2_LIGHT_CHASE' && (
        <LightChaseScene onComplete={() => setCurrentStep('STAGE_3_MAIN_LAWN')} />
      )}

      {/* 
        【阶段 3 & 4：主场景“魔法草坪（秘密小空间）”与课桌】
        四周鲜花藤蔓画框式环绕、课桌三件套（红色教案本、自转黏土地球仪、金属包角精装相册）、放大与上传课题
      */}
      {currentStep === 'STAGE_3_MAIN_LAWN' && (
        <>
          <DesktopScene
            pins={pins}
            works={works}
            selectedPin={selectedPin}
            onSelectPin={(pin) => setSelectedPin(pin)}
            activeTargetCoord={activeTargetCoord}
            newlyDroppedPinId={newlyDroppedPinId}
            onOpenCreate={() => {
              storySound.playPaperTurn();
              setIsRegionPickerOpen(true);
            }}
            onItemLiked={handleItemLiked}
            onAddComment={handleAddComment}
            isMuted={isMuted}
            onToggleSound={handleToggleSound}
            onResetIntro={() => setCurrentStep('STAGE_1_INTRO')}
          />

          {/* 阶段 4 工作流 1：点击右上角“上传课题”弹出的地区选择小框 */}
          <RegionPickerModal
            isOpen={isRegionPickerOpen}
            onClose={() => setIsRegionPickerOpen(false)}
            onConfirm={handleConfirmLocation}
          />

          {/* 阶段 4 工作流 3：钉图钉动画（“啪”地一下把图钉钉在地球仪刚刚选好的位置上） */}
          {isPinDroppingAnim && selectedLocation && (
            <PinDropOverlay
              locationName={selectedLocation.locationString}
              onComplete={handlePinDropAnimComplete}
            />
          )}

          {/* 阶段 4 工作流 4：身份选择弹窗（修正主题文案）与成果提交 */}
          <CreationModal
            isOpen={isRoleModalOpen}
            onClose={() => setIsRoleModalOpen(false)}
            locationData={selectedLocation}
            onSubmitSuccess={handleSubmitSuccess}
          />

          {/* 纯净 Toast 提示条 */}
          {toastMessage && (
            <div className="fixed bottom-6 right-6 z-50 bg-[#14281A] text-white px-5 py-3 rounded-full flex items-center gap-2.5 text-xs md:text-sm font-medium shadow-2xl animate-in slide-in-from-bottom-3 duration-200 border border-white/10">
              <CheckCircle2 size={16} className="text-[#81C784] shrink-0" />
              <span>{toastMessage}</span>
            </div>
          )}
        </>
      )}

    </div>
  );
}
