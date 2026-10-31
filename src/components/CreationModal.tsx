import { useState } from 'react';
import { X, Check, MapPin, Sparkles, Upload, Video, FileText, Image as ImageIcon, ArrowLeft, School, FolderArchive } from 'lucide-react';
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
  digitalResourceUrl?: string;
  date: string;
}

interface CreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  locationData: {
    province: string;
    city: string;
    district: string;
    lat: number;
    lon: number;
  } | null;
  onSubmitSuccess: (data: SubmissionPayload) => void;
}

export default function CreationModal({
  isOpen,
  onClose,
  locationData,
  onSubmitSuccess,
}: CreationModalProps) {
  const [step, setStep] = useState<'ROLE' | 'FORM'>('ROLE');

  // 身份状态
  const [role, setRole] = useState<'TEACHER' | 'STUDENT' | null>(null);

  // 表单状态
  const [title, setTitle] = useState('');
  const [school, setSchool] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [authorAge, setAuthorAge] = useState('8');
  const [content, setContent] = useState('');
  const [digitalResourceUrl, setDigitalResourceUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  if (!isOpen || !locationData) return null;

  const { province, city, district, lat, lon } = locationData;

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

    const payload: SubmissionPayload = {
      id: Date.now().toString(),
      region: `${province} · ${city} · ${district}`,
      province,
      city,
      district,
      lat,
      lon,
      title: title.trim() || `童眼看${district} · 行智开物`,
      role,
      school: school.trim() || (role === 'TEACHER' ? `${district}行智开物实验学校` : `${district}第一实验小学`),
      author: authorName.trim() || (role === 'TEACHER' ? '开物导师' : `探索学员 (${authorAge}岁)`),
      content: content.trim(),
      imageUrl: imagePreview || undefined,
      videoUrl: videoUrl.trim() || undefined,
      digitalResourceUrl: digitalResourceUrl.trim() || undefined,
      date: '刚刚',
    };

    storySound.playPinDrop();
    onSubmitSuccess(payload);
    // 重置并关闭
    setStep('ROLE');
    setRole(null);
    setTitle('');
    setContent('');
    setImagePreview(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/50 backdrop-blur-xs select-none">
      <div className="relative w-full max-w-xl bg-[#FAFBF8] rounded-2xl p-6 md:p-8 max-h-[92vh] overflow-y-auto no-scrollbar shadow-2xl border border-[#1E3824]/10">
        
        {/* 顶部关闭按钮与已落钉标牌 */}
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#1E3824]/10">
          <div className="flex items-center gap-2">
            <span className="text-sm">📍</span>
            <span className="text-xs font-bold text-[#2F6B3F] tracking-wider">
              童眼看 {province} · {city} · {district}
            </span>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="text-[#122818]/60 hover:text-[#122818] p-1 rounded-full hover:bg-stone-200 transition-colors cursor-pointer"
            aria-label="关闭窗口"
          >
            <X size={20} />
          </button>
        </div>

        {/* 
          【阶段 4：身份选择弹窗（修正主题文案）】
          严格使用用户指定内容：
          - 我是学生：分享你的课程成果，包括但不限于你的数字资源包、你的成果图片等。
          - 我是教师：分享你的教案实录手账、教学设计与课程指导记录。
        */}
        {step === 'ROLE' && (
          <div className="space-y-6 pt-1">
            <div className="text-center">
              <h2 className="text-2xl font-black tracking-wide text-[#122818] font-serif">
                请选择你的身份
              </h2>
              <p className="text-xs text-[#3B6647] mt-1.5">
                童眼看世界 · 行智开物 成果共创录入
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              {/* 我是学生 */}
              <button
                type="button"
                onClick={() => handleSelectRole('STUDENT')}
                className="p-6 bg-[#FAF5E8] hover:bg-[#F2EADA] rounded-2xl transition-all text-left flex flex-col items-start group cursor-pointer border border-[#1E3824]/10 hover:border-[#2F6B3F]/30 hover:shadow-lg"
              >
                <div className="w-12 h-12 rounded-full bg-[#2F6B3F] flex items-center justify-center text-2xl mb-3 group-hover:scale-105 transition-transform text-white shadow-xs">
                  👧
                </div>
                <h3 className="font-serif font-black text-lg text-[#122818] mb-1">
                  我是学生
                </h3>
                <p className="text-xs text-[#3B6647] leading-relaxed">
                  分享你的课程成果，包括但不限于你的数字资源包、你的成果图片等。
                </p>
              </button>

              {/* 我是教师 */}
              <button
                type="button"
                onClick={() => handleSelectRole('TEACHER')}
                className="p-6 bg-[#FAF5E8] hover:bg-[#F2EADA] rounded-2xl transition-all text-left flex flex-col items-start group cursor-pointer border border-[#1E3824]/10 hover:border-[#D6634C]/30 hover:shadow-lg"
              >
                <div className="w-12 h-12 rounded-full bg-[#D6634C] flex items-center justify-center text-2xl mb-3 group-hover:scale-105 transition-transform text-white shadow-xs">
                  👨‍🏫
                </div>
                <h3 className="font-serif font-black text-lg text-[#122818] mb-1">
                  我是教师
                </h3>
                <p className="text-xs text-[#3B6647] leading-relaxed">
                  分享你的教案实录手账、教学设计与课程指导记录。
                </p>
              </button>
            </div>
          </div>
        )}

        {/* 提交表单 */}
        {step === 'FORM' && role && (
          <form onSubmit={handleSubmitForm} className="space-y-4 pt-1">
            <div className="flex items-center justify-between pb-1">
              <span className="text-xs font-bold text-[#122818] flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#2F6B3F]" />
                <span>{role === 'TEACHER' ? '教师 · 教案实录手账录入' : '学生 · 课程成果分享录入'}</span>
              </span>
              <button 
                type="button" 
                onClick={() => setStep('ROLE')} 
                className="text-xs text-[#2F6B3F] hover:underline font-bold flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft size={12} />
                <span>重选身份</span>
              </button>
            </div>

            {/* 课题/成果标题 */}
            <div>
              <label className="block text-xs font-bold mb-1.5 text-[#122818]">
                {role === 'TEACHER' ? '课题与教案名称 *' : '成果作品名称 *'}
              </label>
              <input
                type="text"
                required
                placeholder={role === 'TEACHER' ? '例如：天工开物之安吉竹器结构与工程手账' : '例如：我设计的水生净化数字资源包与手作模型'}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3.5 py-2.5 clay-input text-xs md:text-sm text-[#122818] focus:outline-none"
              />
            </div>

            {/* 学校与作者 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-bold mb-1.5 flex items-center gap-1 text-[#122818]">
                  <School size={13} className="text-[#327346]" /> 
                  <span>所属学校 / 单位</span>
                </label>
                <input
                  type="text"
                  placeholder="如：安吉行智开物实验学校"
                  value={school}
                  onChange={(e) => setSchool(e.target.value)}
                  className="w-full px-3.5 py-2.5 clay-input text-xs text-[#122818] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1.5 text-[#122818]">
                  {role === 'TEACHER' ? '执教老师姓名' : '作者姓名与年龄'}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder={role === 'TEACHER' ? '如：林老师' : '如：林木木'}
                    value={authorName}
                    onChange={(e) => setAuthorName(e.target.value)}
                    className="flex-1 px-3.5 py-2.5 clay-input text-xs text-[#122818] focus:outline-none"
                  />
                  {role === 'STUDENT' && (
                    <input
                      type="number"
                      min="4"
                      max="18"
                      value={authorAge}
                      onChange={(e) => setAuthorAge(e.target.value)}
                      className="w-16 px-2 py-2.5 clay-input text-xs text-center text-[#122818] focus:outline-none font-bold"
                      title="年龄"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* 教师专属：教案实录手账、教学设计与课程指导记录 */}
            {role === 'TEACHER' ? (
              <>
                <div>
                  <label className="block text-xs font-bold mb-1.5 flex items-center gap-1 text-[#122818]">
                    <FileText size={13} className="text-[#D6634C]" />
                    <span>教案实录手账、教学设计与课程指导记录 (必填) *</span>
                  </label>
                  <textarea
                    rows={4}
                    required
                    placeholder="分享你的教案实录手账、教学设计与课程指导记录。详述教学引导策略、实践步骤、跨学科反思..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="w-full px-3.5 py-2.5 clay-input text-xs leading-relaxed text-[#122818] focus:outline-none"
                  />
                </div>

                {/* 教学照片 */}
                <div className="p-3.5 bg-[#FAF5E8] rounded-xl space-y-2 border border-[#1E3824]/10">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold flex items-center gap-1 text-[#122818]">
                      <ImageIcon size={13} className="text-[#327346]" />
                      <span>现场教学剪影 / 实践实录照片 (推荐)</span>
                    </label>
                    {imagePreview && (
                      <button 
                        type="button" 
                        onClick={() => setImagePreview(null)}
                        className="text-[10px] text-red-700 underline font-bold cursor-pointer"
                      >
                        清空照片
                      </button>
                    )}
                  </div>

                  {imagePreview ? (
                    <div className="relative w-full h-32 rounded-xl overflow-hidden">
                      <img src={imagePreview} alt="教学照片" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <label className="p-4 text-center rounded-xl bg-white/70 hover:bg-white flex flex-col items-center justify-center cursor-pointer transition-colors border border-dashed border-[#3B6647]/30">
                      <Upload size={18} className="text-[#3B6647] mb-1" />
                      <span className="text-xs font-bold text-[#122818]">选择教学实录照片</span>
                      <span className="text-[10px] text-[#3B6647]/70">支持 JPG, PNG, WEBP</span>
                      <input type="file" accept="image/*" onChange={handleImageFile} className="hidden" />
                    </label>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1.5 flex items-center gap-1 text-[#3B6647]">
                    <Video size={13} />
                    <span>示范课录像 / 课程视频链接 (选填)</span>
                  </label>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    className="w-full px-3.5 py-2.5 clay-input text-xs text-[#122818] focus:outline-none"
                  />
                </div>
              </>
            ) : (
              /* 学生专属：课程成果，包括数字资源包与成果图片 */
              <>
                <div>
                  <label className="block text-xs font-bold mb-1.5 flex items-center gap-1 text-[#122818]">
                    <Sparkles size={13} className="text-[#327346]" />
                    <span>课程成果心得与说明 (必填) *</span>
                  </label>
                  <textarea
                    rows={4}
                    required
                    placeholder="分享你的课程成果心得，介绍你的手作、发现过程或数字资源包内容..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="w-full px-3.5 py-2.5 clay-input text-xs leading-relaxed text-[#122818] focus:outline-none"
                  />
                </div>

                {/* 数字资源包链接 */}
                <div>
                  <label className="block text-xs font-bold mb-1.5 flex items-center gap-1 text-[#122818]">
                    <FolderArchive size={13} className="text-[#2F6B3F]" />
                    <span>数字资源包链接 (数字手册 / 课件包 / 云盘链接)</span>
                  </label>
                  <input
                    type="url"
                    placeholder="例如：https://pan.example.com/s/my-resource-pack"
                    value={digitalResourceUrl}
                    onChange={(e) => setDigitalResourceUrl(e.target.value)}
                    className="w-full px-3.5 py-2.5 clay-input text-xs text-[#122818] focus:outline-none"
                  />
                </div>

                {/* 成果图片上传 */}
                <div className="p-3.5 bg-[#FAF5E8] rounded-xl space-y-2 border border-[#1E3824]/10">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold flex items-center gap-1 text-[#122818]">
                      <ImageIcon size={13} className="text-[#327346]" />
                      <span>上传成果图片 (手作模型 / 成果海报 / 观察画作)</span>
                    </label>
                    {imagePreview && (
                      <button 
                        type="button" 
                        onClick={() => setImagePreview(null)}
                        className="text-[10px] text-red-700 underline font-bold cursor-pointer"
                      >
                        清空
                      </button>
                    )}
                  </div>

                  {imagePreview ? (
                    <div className="relative w-full h-32 rounded-xl overflow-hidden">
                      <img src={imagePreview} alt="成果图片" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <label className="p-4 text-center rounded-xl bg-white/70 hover:bg-white flex flex-col items-center justify-center cursor-pointer transition-colors border border-dashed border-[#3B6647]/30">
                      <Upload size={18} className="text-[#3B6647] mb-1" />
                      <span className="text-xs font-bold text-[#122818]">点击选择我的成果图片</span>
                      <input type="file" accept="image/*" onChange={handleImageFile} className="hidden" />
                    </label>
                  )}
                </div>
              </>
            )}

            <button
              type="submit"
              className="w-full py-3 clay-btn font-bold text-sm flex items-center justify-center gap-2 mt-4 cursor-pointer"
            >
              <Check size={16} />
              <span>保存并正式归档展示</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
