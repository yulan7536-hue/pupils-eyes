import { useState } from 'react';
import { GalleryItem } from './GalleryWall';
import LessonRadarChart, { DEFAULT_RADAR_DIMENSIONS } from './LessonRadarChart';
import { storySound } from '../utils/sound';
import { X, MapPin, School, Heart, MessageSquare, Send, Video, ExternalLink, Sparkles } from 'lucide-react';

interface PopUpDetailCardProps {
  item: GalleryItem | null;
  onClose: () => void;
  onLike: (id: string) => void;
  onAddComment: (id: string, text: string) => void;
}

export default function PopUpDetailCard({
  item,
  onClose,
  onLike,
  onAddComment,
}: PopUpDetailCardProps) {
  const [commentInput, setCommentInput] = useState('');

  if (!item) return null;

  const isTeacher = item.role === 'TEACHER';

  const handlePost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentInput.trim()) return;
    storySound.playPinDrop();
    onAddComment(item.id, commentInput.trim());
    setCommentInput('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-[#122818]/45 backdrop-blur-[4px] select-none">
      
      {/* 
        3D 立体贺卡折角投影底座 (Pop-up Book Ground Shadow)
      */}
      <div 
        className="relative w-full max-w-2xl max-h-[90vh] flex flex-col"
        style={{ perspective: '1600px' }}
      >
        {/* 
          核心 3D 翻立主体：以底部为轴心，如立体书一般 3D 挺立立起 (rotateX from -80deg to 0deg)
        */}
        <div 
          className="relative w-full bg-[#FAFBF7] rounded-2xl overflow-hidden p-6 sm:p-8 flex flex-col overflow-y-auto no-scrollbar shadow-[0_30px_60px_-15px_rgba(10,26,14,0.45)] transition-all duration-500 ease-[cubic-bezier(0.18,1,0.22,1)]"
          style={{
            transformOrigin: 'bottom center',
            animation: 'popup-standup 0.55s cubic-bezier(0.16, 1, 0.3, 1) forwards',
          }}
        >
          {/* 顶部折叠书脊微装饰 */}
          <div className="flex items-center justify-between pb-3 border-b border-[#1E3824]/10 mb-4">
            <div className="flex items-center gap-2 text-xs font-bold">
              <span className={`px-2.5 py-0.5 rounded-full text-white text-[10px] ${
                isTeacher ? 'bg-[#D6634C]' : 'bg-[#2F6B3F]'
              }`}>
                {isTeacher ? '👨‍🏫 教师教案实录手账' : '👧 学生课程成果'}
              </span>
              <span className="text-[#3B6647] flex items-center gap-1 font-mono">
                <MapPin size={12} className="text-[#327346]" />
                <span>{item.region}</span>
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                storySound.playPaperTurn();
                onClose();
              }}
              className="text-[#122818] hover:scale-110 p-1 rounded-full transition-transform cursor-pointer"
              aria-label="合成立体卡片"
            >
              <X size={20} />
            </button>
          </div>

          {/* 标题 */}
          <h2 className="text-2xl sm:text-3xl font-black text-[#122818] font-serif leading-snug mb-2">
            {item.title}
          </h2>

          {/* 学校与作者 */}
          <div className="flex items-center gap-3 text-xs text-[#3B6647] mb-5">
            <span className="flex items-center gap-1 font-medium">
              <School size={13} className="text-[#327346]" />
              {item.school}
            </span>
            <span>·</span>
            <span className="font-bold text-[#122818]">{item.author}</span>
            <span>·</span>
            <span className="font-mono text-[11px] opacity-75">{item.date}</span>
          </div>

          {/* 成果实物照片 */}
          {item.imageUrl && (
            <div className="relative w-full h-64 sm:h-72 rounded-xl overflow-hidden mb-5 bg-[#EAEFE6] shadow-sm">
              <img
                src={item.imageUrl}
                alt={item.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* 正文手记与教案设计 */}
          <div className="text-xs sm:text-sm text-[#122818]/90 font-serif leading-relaxed whitespace-pre-wrap mb-6 bg-[#F5F8F2] p-4 sm:p-5 rounded-xl border border-[#1E3824]/10">
            {item.content}
          </div>

          {/* 示范课录像外链 */}
          {item.videoUrl && (
            <div className="mb-4">
              <a
                href={item.videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-xs font-bold text-[#2F6B3F] hover:text-[#122818] underline"
              >
                <Video size={14} />
                <span>观看本堂课实景教学录像</span>
                <ExternalLink size={12} />
              </a>
            </div>
          )}

          {/* 学生数字资源包链接 */}
          {item.digitalResourceUrl && (
            <div className="mb-6">
              <a
                href={item.digitalResourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-xs font-bold text-[#1E4D2B] bg-[#E8F5E9] px-3.5 py-2 rounded-xl hover:bg-[#C8E6C9] transition-colors"
              >
                <span>📦 查看学生数字资源包 / 成果文件包</span>
                <ExternalLink size={12} />
              </a>
            </div>
          )}

          {/* 
            【动态教案雷达图】
            当展示教师教案板块时，渲染手绘风格六维相对占比雷达图与量规交互
          */}
          {isTeacher && (
            <div className="my-4 pt-4 border-t border-[#1E3824]/10">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={16} className="text-[#D6634C]" />
                <h3 className="text-sm font-black text-[#122818] font-serif">
                  教案多维效度雷达评估（AI 自动解构）
                </h3>
              </div>
              <p className="text-xs text-[#3B6647] mb-3 leading-relaxed">
                依据行智开物美育六维评价标准进行综合图谱绘制，点击各维度文字可阅读量规标准：
              </p>
              
              <LessonRadarChart dimensions={DEFAULT_RADAR_DIMENSIONS} />
            </div>
          )}

          {/* 读者便利贴与点赞区 */}
          <div className="pt-4 border-t border-[#1E3824]/10 mt-auto">
            <div className="flex items-center justify-between mb-3 text-xs text-[#3B6647]">
              <button
                type="button"
                onClick={() => {
                  storySound.playPinDrop();
                  onLike(item.id);
                }}
                className="flex items-center gap-1.5 hover:text-red-600 font-bold transition-colors cursor-pointer"
              >
                <Heart size={15} className={item.likes > 0 ? 'fill-red-500 text-red-600' : ''} />
                <span>赞赏作品 ({item.likes})</span>
              </button>

              <span className="flex items-center gap-1 font-bold">
                <MessageSquare size={14} />
                <span>暖心便签 ({item.comments.length})</span>
              </span>
            </div>

            {/* 便签列表 */}
            <div className="space-y-2 mb-3 max-h-36 overflow-y-auto no-scrollbar">
              {item.comments.map((c) => (
                <div key={c.id} className="bg-[#FFFDF2] p-2.5 rounded-lg text-xs">
                  <div className="flex items-center justify-between text-[10px] text-[#3B6647] mb-0.5">
                    <span className="font-bold text-[#122818]">{c.user}</span>
                    <span>{c.time}</span>
                  </div>
                  <p className="text-[#122818] font-serif">{c.text}</p>
                </div>
              ))}
            </div>

            {/* 发送便签 */}
            <form onSubmit={handlePost} className="flex items-center gap-2">
              <input
                type="text"
                placeholder="留下您的启发或赞叹..."
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                className="flex-1 px-3 py-2 clay-input text-xs text-[#122818] focus:outline-none"
              />
              <button
                type="submit"
                className="clay-btn px-4 py-2 text-xs font-bold flex items-center gap-1"
              >
                <Send size={12} />
                <span>贴上</span>
              </button>
            </form>
          </div>

        </div>

        {/* 底部 3D 纸张厚度折痕阴影条 */}
        <div className="w-[96%] h-3 mx-auto bg-[#0A1A0E]/30 blur-sm rounded-full -mt-1 pointer-events-none" />
      </div>

      <style>{`
        @keyframes popup-standup {
          0% {
            opacity: 0;
            transform: rotateX(-80deg) scale(0.85) translateY(40px);
          }
          100% {
            opacity: 1;
            transform: rotateX(0deg) scale(1) translateY(0px);
          }
        }
      `}</style>
    </div>
  );
}
