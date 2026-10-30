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
  content: string;
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

  const handleProvinceChange = (p: string) => {
    setProvince(p);
    const cities = Object.keys(REGION_TREE[p] || {});
    const firstCity = cities[0] || '';
    setCity(firstCity);
    const districts = REGION_TREE[p]?.[firstCity] || [];
    setDistrict(districts[0] || '');
    storySound.playPaperTurn();
  };

  const handleCityChange = (c: string) => {
    setCity(c);
    const districts = REGION_TREE[province]?.[c] || [];
    setDistrict(districts[0] || '');
    storySound.playPaperTurn();
  };

  const handleConfirmLocation = () => {
    const finalDistrict = isCustomMode && customDistrict.trim() ? customDistrict.trim() : district;
    const coord = getRegionCoordinates(province, city, finalDistrict);
    
    storySound.playPinDrop();
    onPinInserted(coord, `${province}·${finalDistrict}`);
    setStep('ROLE');
  };

  const handleSelectRole = (selectedRole: 'TEACHER' | 'STUDENT') => {
    storySound.playPaperTurn();
    setRole(selectedRole);
    setStep('FORM');
  };

  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setImagePreview(url);
      storySound.playPaperTurn();
    }
  };

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-[#162B1C]/50 backdrop-blur-[3px] select-none">
      <div className="relative w-full max-w-xl clay-card p-6 md:p-8 max-h-[92vh] overflow-y-auto no-scrollbar">
        
        {/* 顶部陶土印章标签 */}
        <div className="absolute -top-4 left-10 px-4 py-1 bg-[#D47A6A] border-2 border-[#1E3824] text-xs font-black text-[#FAF5E8] rounded-full shadow-xs -rotate-2">
          🍃 软陶手作台 · 课题画纸
        </div>

        {/* 关闭按钮 */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-[#1E3824] hover:scale-110 p-1.5 rounded-full hover:bg-[#EAEFE6] transition-transform"
        >
          <X size={20} />
        </button>

        {/* 步骤 1：填空式级联地区选择 */}
        {step === 'LOCATION' && (
          <div className="space-y-5 pt-3">
            <div>
              <div className="text-xs text-[#52796F] font-bold tracking-wider mb-1">
                第一步 / 定位观察站坐标
              </div>
              <h2 className="text-2xl md:text-3xl font-black tracking-wide text-[#1E3824]">
                童眼看 <span className="underline decoration-wavy decoration-[#6E9277] text-[#477051] px-1 font-handwriting">
                  {finalDisplayDistrict || '______'}
                </span>
              </h2>
              <p className="text-xs text-[#52796F] mt-1.5 leading-relaxed">
                请依次选择国家、省份、市州与区县（精确到县），点击确定后将在 3D 黏土地球对应坐标实时弹跳插钉：
              </p>
            </div>

            {/* 级联选择器陶土托盘 */}
            <div className="p-4 bg-[#EAEFE6] rounded-xl border-2 border-[#1E3824] space-y-3.5 text-xs md:text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* 国家 */}
                <div>
                  <label className="block text-[11px] font-bold text-[#52796F] mb-1">国家 / Country</label>
                  <input
                    type="text"
                    disabled
                    value={country}
                    className="w-full px-3 py-2 clay-input font-bold text-[#1E3824]"
                  />
                </div>

                {/* 省份 */}
                <div>
                  <label className="block text-[11px] font-bold text-[#52796F] mb-1">省份 / Province *</label>
                  <select
                    value={province}
                    onChange={(e) => handleProvinceChange(e.target.value)}
                    className="w-full px-3 py-2 clay-input font-bold text-[#1E3824] focus:outline-none"
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
                    className="w-full px-3 py-2 clay-input font-bold text-[#1E3824] focus:outline-none"
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
                      className="text-[10px] text-[#52796F] underline font-bold"
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
                      className="w-full px-3 py-2 clay-input font-bold text-[#1E3824] focus:outline-none"
                    />
                  ) : (
                    <select
                      value={district}
                      onChange={(e) => {
                        setDistrict(e.target.value);
                        storySound.playPaperTurn();
                      }}
                      className="w-full px-3 py-2 clay-input font-bold text-[#1E3824] focus:outline-none"
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
            <div className="p-3 bg-[#FAF5E8] border-2 border-dashed border-[#1E3824]/40 rounded-xl text-center text-xs md:text-sm">
              <span className="text-[#52796F]">已就绪观察主题：</span>
              <span className="font-black text-[#1E3824] ml-1 text-sm md:text-base">
                童眼看 {province} · {city} · {finalDisplayDistrict}
              </span>
            </div>

            <button
              type="button"
              onClick={handleConfirmLocation}
              className="w-full py-3 clay-btn font-black text-sm flex items-center justify-center gap-2"
            >
              <span>“吧嗒”物理弹跳插钉并选身份</span>
              <Sparkles size={16} className="text-[#E6B84A]" />
            </button>
          </div>
        )}

        {/* 步骤 2：泥塑简笔身份分流 */}
        {step === 'ROLE' && (
          <div className="space-y-5 pt-3">
            <div className="flex items-center justify-between border-b-2 border-[#1E3824]/15 pb-2">
              <div className="flex items-center gap-1.5 text-xs text-[#52796F] font-bold">
                <MapPin size={13} className="text-[#6E9277]" />
                <span>{province} · {city} · {finalDisplayDistrict}</span>
              </div>
              <button 
                onClick={() => setStep('LOCATION')} 
                className="text-xs text-[#52796F] flex items-center gap-1 hover:underline font-bold"
              >
                <ArrowLeft size={12} />
                <span>重选地区</span>
              </button>
            </div>

            <div className="text-center pt-2">
              <h2 className="text-2xl font-black tracking-wide text-[#1E3824]">
                你的身份是？
              </h2>
              <p className="text-xs text-[#52796F] mt-1">
                选择你的视角，铺开定制的园丁教案画纸或童趣手作笔记
              </p>
            </div>

            {/* 老师 / 学生双重厚切软陶泥大按钮 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <button
                type="button"
                onClick={() => handleSelectRole('TEACHER')}
                className="p-6 bg-[#FAF5E8] hover:bg-[#F0E8D5] rounded-2xl border-3 border-[#1E3824] shadow-[4px_5px_0px_#1E3824] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all text-left flex flex-col items-center sm:items-start group cursor-pointer"
              >
                <div className="w-16 h-16 rounded-2xl bg-[#D47A6A] border-2 border-[#1E3824] flex items-center justify-center text-3xl mb-3 shadow-xs group-hover:scale-105 transition-transform">
                  👨‍🏫
                </div>
                <h3 className="font-black text-lg text-[#1E3824] mb-1">我是老师</h3>
                <p className="text-xs text-[#52796F] leading-relaxed">
                  上传教学设计反思、课堂实景照片剪影，可附带示范课链接与学生作业。
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleSelectRole('STUDENT')}
                className="p-6 bg-[#FAF5E8] hover:bg-[#F0E8D5] rounded-2xl border-3 border-[#1E3824] shadow-[4px_5px_0px_#1E3824] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all text-left flex flex-col items-center sm:items-start group cursor-pointer"
              >
                <div className="w-16 h-16 rounded-2xl bg-[#6E9277] border-2 border-[#1E3824] flex items-center justify-center text-3xl mb-3 shadow-xs group-hover:scale-105 transition-transform">
                  👧
                </div>
                <h3 className="font-black text-lg text-[#1E3824] mb-1">我是学生</h3>
                <p className="text-xs text-[#52796F] leading-relaxed">
                  分享亲手捏的泥塑小动物、拾落的落叶标本、自然观察心得小诗与童心发现。
                </p>
              </button>
            </div>
          </div>
        )}

        {/* 步骤 3：差异化提交表单 */}
        {step === 'FORM' && role && (
          <form onSubmit={handleSubmitForm} className="space-y-4 pt-2">
            <div className="flex items-center justify-between border-b-2 border-[#1E3824]/15 pb-2">
              <div className="flex items-center gap-1.5 text-xs text-[#52796F] font-black">
                <MapPin size={13} className="text-[#6E9277]" />
                <span>{finalDisplayDistrict} · {role === 'TEACHER' ? '园丁教研档案' : '小小探索者画卷'}</span>
              </div>
              <button 
                type="button" 
                onClick={() => setStep('ROLE')} 
                className="text-xs text-[#52796F] underline font-bold"
              >
                切换身份
              </button>
            </div>

            {/* 标题 */}
            <div>
              <label className="block text-xs font-bold mb-1 text-[#1E3824]">
                课题 / 作品名称 *
              </label>
              <input
                type="text"
                required
                placeholder={role === 'TEACHER' ? '例如：在安吉竹林里聆听春笋破土的声音' : '例如：我捏的像星星一样的海菜花'}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 clay-input text-xs md:text-sm text-[#1E3824] focus:outline-none"
              />
            </div>

            {/* 基础身份信息 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold mb-1 flex items-center gap-1 text-[#1E3824]">
                  <School size={12} className="text-[#6E9277]" /> 所属学校 / 机构
                </label>
                <input
                  type="text"
                  placeholder="如：安吉绿水青山实验小学"
                  value={school}
                  onChange={(e) => setSchool(e.target.value)}
                  className="w-full px-3 py-2 clay-input text-xs text-[#1E3824] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1 text-[#1E3824]">
                  {role === 'TEACHER' ? '执教老师姓名' : '作者姓名与年龄'}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder={role === 'TEACHER' ? '如：林老师' : '如：林木木'}
                    value={authorName}
                    onChange={(e) => setAuthorName(e.target.value)}
                    className="flex-1 px-3 py-2 clay-input text-xs text-[#1E3824] focus:outline-none"
                  />
                  {role === 'STUDENT' && (
                    <input
                      type="number"
                      min="4"
                      max="18"
                      value={authorAge}
                      onChange={(e) => setAuthorAge(e.target.value)}
                      className="w-16 px-2 py-2 clay-input text-xs text-center text-[#1E3824] focus:outline-none"
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
                  <label className="block text-xs font-bold mb-1 flex items-center gap-1 text-[#1E3824]">
                    <FileText size={13} className="text-[#D47A6A]" />
                    <span>教学设计与教案反思 (必填) *</span>
                  </label>
                  <textarea
                    rows={3}
                    required
                    placeholder="详述本课的自然引导策略、如何用定格泥塑和手绘激发孩子们观察大自然..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="w-full px-3 py-2 clay-input text-xs leading-relaxed text-[#1E3824] focus:outline-none"
                  />
                </div>

                <div className="p-3.5 bg-[#EAEFE6] rounded-xl border-2 border-[#1E3824] space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold flex items-center gap-1 text-[#1E3824]">
                      <ImageIcon size={13} className="text-[#6E9277]" />
                      <span>现场教学剪影 / 学生实践照片 (推荐)</span>
                    </label>
                    {imagePreview && (
                      <button 
                        type="button" 
                        onClick={() => setImagePreview(null)}
                        className="text-[10px] text-red-700 underline font-bold"
                      >
                        清空照片
                      </button>
                    )}
                  </div>

                  {imagePreview ? (
                    <div className="relative w-full h-32 rounded-lg overflow-hidden border-2 border-[#1E3824]">
                      <img src={imagePreview} alt="现场照片" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <label className="border-2 border-dashed border-[#1E3824]/50 p-4 text-center rounded-xl bg-white hover:bg-[#FAF5E8] flex flex-col items-center justify-center cursor-pointer transition-colors">
                      <Upload size={20} className="text-[#52796F] mb-1" />
                      <span className="text-xs font-bold text-[#1E3824]">点此拍照或选择现场照片</span>
                      <span className="text-[10px] text-[#52796F]">支持 JPG, PNG, WEBP 图片</span>
                      <input type="file" accept="image/*" onChange={handleImageFile} className="hidden" />
                    </label>
                  )}
                </div>

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
                    className="w-full px-3 py-2 clay-input text-xs text-[#1E3824] focus:outline-none"
                  />
                </div>
              </>
            ) : (
              /* 学生专属表单 */
              <>
                <div>
                  <label className="block text-xs font-bold mb-1 flex items-center gap-1 text-[#1E3824]">
                    <Sparkles size={13} className="text-[#6E9277]" />
                    <span>童心观察日记 / 发现心得 (必填) *</span>
                  </label>
                  <textarea
                    rows={4}
                    required
                    placeholder="我今天在树底下发现了一只迷路的小甲虫，它身上有彩虹一样的光..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="w-full px-3 py-2 clay-input text-xs leading-relaxed text-[#1E3824] focus:outline-none"
                  />
                </div>

                <div className="p-3.5 bg-[#EAEFE6] rounded-xl border-2 border-[#1E3824] space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold flex items-center gap-1 text-[#1E3824]">
                      <ImageIcon size={13} className="text-[#6E9277]" />
                      <span>上传我的自然泥塑 / 手绘画作</span>
                    </label>
                    {imagePreview && (
                      <button 
                        type="button" 
                        onClick={() => setImagePreview(null)}
                        className="text-[10px] text-red-700 underline font-bold"
                      >
                        清除
                      </button>
                    )}
                  </div>

                  {imagePreview ? (
                    <div className="relative w-full h-32 rounded-lg overflow-hidden border-2 border-[#1E3824]">
                      <img src={imagePreview} alt="学生作品" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <label className="border-2 border-dashed border-[#1E3824]/50 p-4 text-center rounded-xl bg-white hover:bg-[#FAF5E8] flex flex-col items-center justify-center cursor-pointer transition-colors">
                      <Upload size={20} className="text-[#52796F] mb-1" />
                      <span className="text-xs font-bold text-[#1E3824]">把我的泥塑或画作拍照放进来</span>
                      <input type="file" accept="image/*" onChange={handleImageFile} className="hidden" />
                    </label>
                  )}
                </div>
              </>
            )}

            <button
              type="submit"
              className="w-full py-3 clay-btn font-black text-sm flex items-center justify-center gap-2 mt-4"
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
