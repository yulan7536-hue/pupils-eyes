import { useState } from 'react';
import { X, Check, MapPin, Sparkles, Upload, Video, FileText, Image as ImageIcon, ArrowLeft, School } from 'lucide-react';
import { REGION_TREE, getRegionCoordinates } from '../data/regions';
import { storySound } from '../utils/sound';

export interface SubmissionPayload {
  id: string;
  region: string;
  province: string;
  city: string;
  district: string;
  lat: number;
  lon: number;
  title: string;
  role: 'TEACHER' | 'STUDENT';
  school: string;
  author: string;
  content: string; // 教案 或 学生心得
  imageUrl?: string;
  videoUrl?: string;
  date: string;
}

interface CreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitSuccess: (data: SubmissionPayload) => void;
  onPinInserted: (coord: { lat: number; lon: number }, name: string) => void;
}

export default function CreationModal({ isOpen, onClose, onSubmitSuccess, onPinInserted }: CreationModalProps) {
  // 步骤导航：'LOCATION' -> 'ROLE' -> 'FORM'
  const [step, setStep] = useState<'LOCATION' | 'ROLE' | 'FORM'>('LOCATION');

  // 级联地区状态
  const [country] = useState('中国');
  const [province, setProvince] = useState('浙江省');
  const [city, setCity] = useState('湖州市');
  const [district, setDistrict] = useState('安吉县');
  const [customDistrict, setCustomDistrict] = useState('');
  const [isCustomMode, setIsCustomMode] = useState(false);

  // 身份状态
  const [role, setRole] = useState<'TEACHER' | 'STUDENT' | null>(null);

  // 表单状态
  const [title, setTitle] = useState('');
  const [school, setSchool] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [authorAge, setAuthorAge] = useState('8');
  const [content, setContent] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  if (!isOpen) return null;

  // 省份切换
  const handleProvinceChange = (p: string) => {
    setProvince(p);
    const cities = Object.keys(REGION_TREE[p] || {});
    const firstCity = cities[0] || '';
    setCity(firstCity);
    const districts = REGION_TREE[p]?.[firstCity] || [];
    setDistrict(districts[0] || '');
    storySound.playPaperTurn();
  };

  // 城市切换
  const handleCityChange = (c: string) => {
    setCity(c);
    const districts = REGION_TREE[province]?.[c] || [];
    setDistrict(districts[0] || '');
    storySound.playPaperTurn();
  };

  // 确定地点：触发 3D 地球插钉动效并进入身份选择
  const handleConfirmLocation = () => {
    const finalDistrict = isCustomMode && customDistrict.trim() ? customDistrict.trim() : district;
    const coord = getRegionCoordinates(province, city, finalDistrict);
    
    // 触发声音与地球旋转落钉
    storySound.playPinDrop();
    onPinInserted(coord, `${province}·${finalDistrict}`);
    
    setStep('ROLE');
  };

  // 选择身份
  const handleSelectRole = (selectedRole: 'TEACHER' | 'STUDENT') => {
    storySound.playPaperTurn();
    setRole(selectedRole);
    setStep('FORM');
  };

  // 模拟或真实图片选择
  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setImagePreview(url);
      storySound.playPaperTurn();
    }
  };

  // 最终提交
  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!role) return;

    const finalDistrict = isCustomMode && customDistrict.trim() ? customDistrict.trim() : district;
    const coord = getRegionCoordinates(province, city, finalDistrict);

    const payload: SubmissionPayload = {
      id: Date.now().toString(),
      region: `${province} · ${city} · ${finalDistrict}`,
      province,
      city,
      district: finalDistrict,
      lat: coord.lat,
      lon: coord.lon,
      title: title.trim() || `童眼看${finalDistrict}`,
      role,
      school: school.trim() || (role === 'TEACHER' ? `${finalDistrict}自然实验学堂` : `${finalDistrict}第一实验小学`),
      author: authorName.trim() || (role === 'TEACHER' ? '自然导师' : `探索者 (${authorAge}岁)`),
      content: content.trim(),
      imageUrl: imagePreview || undefined,
      videoUrl: videoUrl.trim() || undefined,
      date: '刚刚',
    };

    storySound.playPinDrop();
    onSubmitSuccess(payload);
    onClose();
  };

  const finalDisplayDistrict = isCustomMode && customDistrict ? customDistrict : district;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-[#1A3320]/45 backdrop-blur-[2px] select-none">
      <div className="relative w-full max-w-xl parchment-sheet p-5 md:p-7 hand-drawn-border hand-drawn-box max-h-[92vh] overflow-y-auto no-scrollbar">
        
        {/* 顶部胶带 */}
        <div className="absolute -top-3 left-10 px-4 py-0.5 bg-[#FAF3D1] border border-[#1A3320] text-xs font-bold text-[#1A3320] rotate-[-1deg] shadow-sm">
          🌱 师生共创记 · 课题画纸
        </div>

        {/* 关闭按钮 */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-[#1A3320] hover:scale-110 p-1 transition-transform"
        >
          <X size={20} />
        </button>

        {/* 步骤 1：填空式级联地区选择 */}
        {step === 'LOCATION' && (
          <div className="space-y-5 pt-3">
            <div>
              <div className="text-xs text-[#52796F] font-bold tracking-wider mb-1">
                第一步 / 观察站定格
              </div>
              <h2 className="text-2xl md:text-3xl font-bold tracking-wide text-[#1A3320]">
                童眼看 <span className="underline decoration-wavy decoration-[#85A98F] text-[#52796F] px-1 font-handwriting">
                  {finalDisplayDistrict || '______'}
                </span>
              </h2>
              <p className="text-xs text-[#52796F] mt-1.5">
                请依次选择国家、省份、市州与区县（精准到县），点击确定后将在 3D 地球对应坐标落钉：
              </p>
            </div>

            {/* 级联选择器框 */}
            <div className="p-4 bg-[#F3F7F0] hand-drawn-border space-y-3 text-xs md:text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* 国家 */}
                <div>
                  <label className="block text-[11px] font-bold text-[#52796F] mb-1">国家 / Region</label>
                  <input
                    type="text"
                    disabled
                    value={country}
                    className="w-full px-3 py-1.5 bg-[#FAF7EE] border border-[#1A3320] rounded font-medium text-[#1A3320]"
                  />
                </div>

                {/* 省份 */}
                <div>
                  <label className="block text-[11px] font-bold text-[#52796F] mb-1">省份 / Province *</label>
                  <select
                    value={province}
                    onChange={(e) => handleProvinceChange(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-[#1A3320] rounded font-medium text-[#1A3320] focus:outline-none"
                  >
                    {Object.keys(REGION_TREE).map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                {/* 城市 */}
                <div>
                  <label className="block text-[11px] font-bold text-[#52796F] mb-1">地市 / City *</label>
                  <select
                    value={city}
                    onChange={(e) => handleCityChange(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-[#1A3320] rounded font-medium text-[#1A3320] focus:outline-none"
                  >
                    {Object.keys(REGION_TREE[province] || {}).map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                {/* 区县（精确到县） */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-bold text-[#52796F]">区/县 / County *</label>
                    <button
                      type="button"
                      onClick={() => setIsCustomMode(!isCustomMode)}
                      className="text-[10px] text-[#52796F] underline"
                    >
                      {isCustomMode ? '从预设列表选' : '手写自定义县'}
                    </button>
                  </div>
                  {isCustomMode ? (
                    <input
                      type="text"
                      placeholder="输入具体区县名..."
                      value={customDistrict}
                      onChange={(e) => setCustomDistrict(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-[#1A3320] rounded font-medium text-[#1A3320] focus:outline-none"
                    />
                  ) : (
                    <select
                      value={district}
                      onChange={(e) => {
                        setDistrict(e.target.value);
                        storySound.playPaperTurn();
                      }}
                      className="w-full px-3 py-1.5 bg-white border border-[#1A3320] rounded font-medium text-[#1A3320] focus:outline-none"
                    >
                      {(REGION_TREE[province]?.[city] || []).map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            </div>

            {/* 即时位置预览 */}
            <div className="p-3 bg-[#FAF7EE] border border-dashed border-[#1A3320]/40 rounded text-center text-xs md:text-sm">
              <span className="text-[#52796F]">已定位观察主题：</span>
              <span className="font-bold text-[#1A3320] ml-1">
                童眼看 {province} · {city} · {finalDisplayDistrict}
              </span>
            </div>

            <button
              type="button"
              onClick={handleConfirmLocation}
              className="w-full py-2.5 bg-[#85A98F] hover:bg-[#52796F] text-[#FAF7EE] text-sm font-bold rounded-full hand-drawn-border hand-drawn-box hand-drawn-box-pressed transition-all flex items-center justify-center gap-2"
            >
              <span>“吧嗒”插钉并选择身份</span>
              <Sparkles size={16} />
            </button>
          </div>
        )}

        {/* 步骤 2：泥塑简笔身份分流 */}
        {step === 'ROLE' && (
          <div className="space-y-5 pt-3">
            <div className="flex items-center justify-between border-b border-[#1A3320]/15 pb-2">
              <div className="flex items-center gap-1.5 text-xs text-[#52796F]">
                <MapPin size={13} />
                <span>{province} · {city} · {finalDisplayDistrict}</span>
              </div>
              <button 
                onClick={() => setStep('LOCATION')} 
                className="text-xs text-[#52796F] flex items-center gap-1 hover:underline"
              >
                <ArrowLeft size={12} />
                <span>重选地区</span>
              </button>
            </div>

            <div className="text-center pt-2">
              <h2 className="text-2xl font-bold tracking-wide text-[#1A3320]">
                你的身份是？
              </h2>
              <p className="text-xs text-[#52796F] mt-1">
                我们将为你铺开定制的教学手记画纸或童趣观察笔记
              </p>
            </div>

            {/* 老师 / 学生双重大按钮 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <button
                type="button"
                onClick={() => handleSelectRole('TEACHER')}
                className="p-6 bg-[#F3F7F0] hover:bg-[#E3EFE5] hand-drawn-border hand-drawn-box hand-drawn-box-pressed transition-all text-left flex flex-col items-center sm:items-start group"
              >
                <div className="w-14 h-14 rounded-full bg-[#FAF7EE] border border-[#1A3320] flex items-center justify-center text-3xl mb-3 shadow-sm group-hover:scale-105 transition-transform">
                  👨‍🏫
                </div>
                <h3 className="font-bold text-base text-[#1A3320] mb-1">我是老师</h3>
                <p className="text-xs text-[#52796F] leading-relaxed">
                  沉淀教案反思、教学实施现场实录剪影，可附带示范课视频链接与学生成果。
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleSelectRole('STUDENT')}
                className="p-6 bg-[#F3F7F0] hover:bg-[#E3EFE5] hand-drawn-border hand-drawn-box hand-drawn-box-pressed transition-all text-left flex flex-col items-center sm:items-start group"
              >
                <div className="w-14 h-14 rounded-full bg-[#FAF7EE] border border-[#1A3320] flex items-center justify-center text-3xl mb-3 shadow-sm group-hover:scale-105 transition-transform">
                  👧
                </div>
                <h3 className="font-bold text-base text-[#1A3320] mb-1">我是学生</h3>
                <p className="text-xs text-[#52796F] leading-relaxed">
                  分享亲手捏的泥塑小鸟、捡拾的落叶标本、自然观察心得小诗与童心发现。
                </p>
              </button>
            </div>
          </div>
        )}

        {/* 步骤 3：差异化提交表单 */}
        {step === 'FORM' && role && (
          <form onSubmit={handleSubmitForm} className="space-y-4 pt-2">
            <div className="flex items-center justify-between border-b border-[#1A3320]/15 pb-2">
              <div className="flex items-center gap-1.5 text-xs text-[#52796F] font-bold">
                <MapPin size={13} className="text-[#85A98F]" />
                <span>{finalDisplayDistrict} · {role === 'TEACHER' ? '园丁教研档案' : '小小探索者画卷'}</span>
              </div>
              <button 
                type="button" 
                onClick={() => setStep('ROLE')} 
                className="text-xs text-[#52796F] underline"
              >
                切换身份
              </button>
            </div>

            {/* 标题 */}
            <div>
              <label className="block text-xs font-bold mb-1">
                课题 / 作品名称 *
              </label>
              <input
                type="text"
                required
                placeholder={role === 'TEACHER' ? '例如：在安吉竹林里聆听春笋破土的第一声' : '例如：我画的像星星一样的洱海花'}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 bg-white hand-drawn-border text-xs md:text-sm text-[#1A3320] focus:outline-none"
              />
            </div>

            {/* 基础身份信息 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold mb-1 flex items-center gap-1">
                  <School size={12} /> 所属学校 / 机构
                </label>
                <input
                  type="text"
                  placeholder="如：安吉生态实验小学"
                  value={school}
                  onChange={(e) => setSchool(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white hand-drawn-border text-xs text-[#1A3320] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">
                  {role === 'TEACHER' ? '执教老师姓名' : '作者姓名与年龄'}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder={role === 'TEACHER' ? '如：林老师' : '如：林木木'}
                    value={authorName}
                    onChange={(e) => setAuthorName(e.target.value)}
                    className="flex-1 px-3 py-1.5 bg-white hand-drawn-border text-xs text-[#1A3320] focus:outline-none"
                  />
                  {role === 'STUDENT' && (
                    <input
                      type="number"
                      min="4"
                      max="18"
                      value={authorAge}
                      onChange={(e) => setAuthorAge(e.target.value)}
                      className="w-16 px-2 py-1.5 bg-white hand-drawn-border text-xs text-center text-[#1A3320] focus:outline-none"
                      title="年龄"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* 教师专属必填与选填 */}
            {role === 'TEACHER' ? (
              <>
                <div>
                  <label className="block text-xs font-bold mb-1 flex items-center gap-1">
                    <FileText size={13} className="text-[#85A98F]" />
                    <span>教学设计与教案反思 (必填) *</span>
                  </label>
                  <textarea
                    rows={3}
                    required
                    placeholder="详述本课的观察目标、户外自然引导策略，以及如何用定格泥塑和手绘让孩子们表达观察..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="w-full px-3 py-2 bg-white hand-drawn-border text-xs leading-relaxed text-[#1A3320] focus:outline-none"
                  />
                </div>

                {/* 照片上传 */}
                <div className="p-3 bg-[#F3F7F0] hand-drawn-border space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold flex items-center gap-1">
                      <ImageIcon size={13} className="text-[#85A98F]" />
                      <span>现场教学剪影 / 学生实践照片 (推荐)</span>
                    </label>
                    {imagePreview && (
                      <button 
                        type="button" 
                        onClick={() => setImagePreview(null)}
                        className="text-[10px] text-red-600 underline"
                      >
                        清空照片
                      </button>
                    )}
                  </div>

                  {imagePreview ? (
                    <div className="relative w-full h-32 rounded overflow-hidden border border-[#1A3320]">
                      <img src={imagePreview} alt="现场照片" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <label className="border-2 border-dashed border-[#1A3320]/40 p-3 text-center rounded bg-white hover:bg-[#FAF7EE] flex flex-col items-center justify-center cursor-pointer transition-colors">
                      <Upload size={18} className="text-[#52796F] mb-1" />
                      <span className="text-xs font-bold text-[#1A3320]">点此选择或拍照上传现场照片</span>
                      <span className="text-[10px] text-[#52796F]">支持 JPG, PNG, WEBP 图片</span>
                      <input type="file" accept="image/*" onChange={handleImageFile} className="hidden" />
                    </label>
                  )}
                </div>

                {/* 选填录课视频链接 */}
                <div>
                  <label className="block text-xs font-bold mb-1 flex items-center gap-1 text-[#52796F]">
                    <Video size={13} />
                    <span>示范课录像链接 (选填)</span>
                  </label>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white hand-drawn-border text-xs text-[#1A3320] focus:outline-none"
                  />
                </div>
              </>
            ) : (
              /* 学生专属表单 */
              <>
                <div>
                  <label className="block text-xs font-bold mb-1 flex items-center gap-1">
                    <Sparkles size={13} className="text-[#85A98F]" />
                    <span>童心观察日记 / 发现心得 (必填) *</span>
                  </label>
                  <textarea
                    rows={4}
                    required
                    placeholder="我今天在树底下发现了一只迷路的小甲虫，它身上有彩虹的光..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="w-full px-3 py-2 bg-white hand-drawn-border text-xs leading-relaxed text-[#1A3320] focus:outline-none"
                  />
                </div>

                <div className="p-3 bg-[#F3F7F0] hand-drawn-border space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold flex items-center gap-1">
                      <ImageIcon size={13} className="text-[#85A98F]" />
                      <span>上传我的自然泥塑 / 手绘画作</span>
                    </label>
                    {imagePreview && (
                      <button 
                        type="button" 
                        onClick={() => setImagePreview(null)}
                        className="text-[10px] text-red-600 underline"
                      >
                        清除
                      </button>
                    )}
                  </div>

                  {imagePreview ? (
                    <div className="relative w-full h-32 rounded overflow-hidden border border-[#1A3320]">
                      <img src={imagePreview} alt="学生作品" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <label className="border-2 border-dashed border-[#1A3320]/40 p-3 text-center rounded bg-white hover:bg-[#FAF7EE] flex flex-col items-center justify-center cursor-pointer transition-colors">
                      <Upload size={18} className="text-[#52796F] mb-1" />
                      <span className="text-xs font-bold text-[#1A3320]">把我的画作或泥塑拍照放进来</span>
                      <input type="file" accept="image/*" onChange={handleImageFile} className="hidden" />
                    </label>
                  )}
                </div>
              </>
            )}

            <button
              type="submit"
              className="w-full py-2.5 bg-[#85A98F] hover:bg-[#52796F] text-[#FAF7EE] text-sm font-bold rounded-full hand-drawn-border hand-drawn-box hand-drawn-box-pressed transition-all flex items-center justify-center gap-2 mt-4"
            >
              <Check size={16} />
              <span>贴入秘密花园画卷，落钉定格</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
