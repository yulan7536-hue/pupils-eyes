import { useState } from 'react';
import { Heart, MessageSquare, MapPin, Send, School, Video, ExternalLink, Sparkles } from 'lucide-react';
import { SubmissionPayload } from './CreationModal';
import { storySound } from '../utils/sound';

export interface GalleryItem extends SubmissionPayload {
  likes: number;
  comments: { id: string; user: string; text: string; time: string }[];
}

interface GalleryWallProps {
  items: GalleryItem[];
  onItemLiked: (id: string) => void;
  onAddComment: (id: string, text: string) => void;
  targetHighlightId?: string | null;
}

export default function GalleryWall({ items, onItemLiked, onAddComment, targetHighlightId }: GalleryWallProps) {
  const [filterRole, setFilterRole] = useState<'ALL' | 'TEACHER' | 'STUDENT'>('ALL');
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});

  const filteredItems = items.filter((item) => {
    if (filterRole === 'ALL') return true;
    return item.role === filterRole;
  });

  const handlePostComment = (itemId: string) => {
    const text = commentInputs[itemId]?.trim();
    if (!text) return;
    storySound.playPinDrop();
    onAddComment(itemId, text);
    setCommentInputs({ ...commentInputs, [itemId]: '' });
    setExpandedComments({ ...expandedComments, [itemId]: true });
  };

  const toggleComments = (itemId: string) => {
    storySound.playPaperTurn();
    setExpandedComments({
      ...expandedComments,
      [itemId]: !expandedComments[itemId],
    });
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-12 select-none">
      
      {/* 顶部标题区：去边框化，优雅高雅的美术展厅质感 */}
      <div className="text-center max-w-2xl mx-auto mb-16">
        <div className="inline-flex items-center gap-2 text-xs font-bold text-[#327346] mb-3 tracking-widest uppercase">
          <Sparkles size={14} className="text-[#327346]" />
          <span>师生生态共创 · 成果展览</span>
        </div>
        <h2 className="text-3xl md:text-4xl font-black tracking-wide text-[#122818] font-serif">
          童眼看自然 · 泥塑成果画卷
        </h2>
        <p className="text-xs md:text-sm text-[#3B6647] mt-3 leading-relaxed font-serif">
          收录来自全国区县的教学实践与孩子们的童趣自然观察，每一幅记录皆为凝结童心的生态标本。
        </p>

        {/* 身份筛选过滤器：纯字阶留白切换，无任何边框、盒子与阴影 */}
        <div className="flex items-center justify-center gap-8 mt-8 text-xs font-bold">
          <button
            type="button"
            onClick={() => {
              storySound.playPaperTurn();
              setFilterRole('ALL');
            }}
            className={`transition-colors cursor-pointer pb-1 ${
              filterRole === 'ALL'
                ? 'text-[#122818] border-b-2 border-[#2F6B3F] font-black'
                : 'text-[#3B6647]/70 hover:text-[#122818]'
            }`}
          >
            全部成果 ({items.length})
          </button>
          <button
            type="button"
            onClick={() => {
              storySound.playPaperTurn();
              setFilterRole('TEACHER');
            }}
            className={`transition-colors cursor-pointer pb-1 ${
              filterRole === 'TEACHER'
                ? 'text-[#D6634C] border-b-2 border-[#D6634C] font-black'
                : 'text-[#3B6647]/70 hover:text-[#D6634C]'
            }`}
          >
            👨‍🏫 教师教研设计
          </button>
          <button
            type="button"
            onClick={() => {
              storySound.playPaperTurn();
              setFilterRole('STUDENT');
            }}
            className={`transition-colors cursor-pointer pb-1 ${
              filterRole === 'STUDENT'
                ? 'text-[#2F6B3F] border-b-2 border-[#2F6B3F] font-black'
                : 'text-[#3B6647]/70 hover:text-[#2F6B3F]'
            }`}
          >
            👧 学生泥塑手记
          </button>
        </div>
      </div>

      {/* 成果瀑布流 Masonry Grid（完全无卡片外框，完全依靠呼吸感留白与画廊级图文排版） */}
      <div className="columns-1 md:columns-2 lg:columns-3 gap-12 space-y-12">
        {filteredItems.map((item) => {
          const isHighlighted = targetHighlightId === item.id;
          const showAllComments = expandedComments[item.id];
          const isTeacher = item.role === 'TEACHER';

          return (
            <div
              key={item.id}
              id={`work-${item.id}`}
              className={`break-inside-avoid relative transition-all duration-300 pb-4 ${
                isHighlighted ? 'scale-[1.01]' : ''
              }`}
            >
              {/* 作品图片（纯净圆角，无任何外黑框与阴影） */}
              {item.imageUrl && (
                <div className="relative w-full h-56 rounded-2xl overflow-hidden mb-4 bg-[#EAEFE6]">
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                    loading="lazy"
                  />
                </div>
              )}

              {/* 身份与地区元信息（纯字阶排版，无盒子与边框） */}
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="flex items-center gap-1.5 text-[#3B6647] font-bold">
                  <MapPin size={13} className="text-[#327346]" />
                  <span>{item.region}</span>
                </span>
                <span className={`text-[11px] font-bold tracking-wider ${
                  isTeacher ? 'text-[#D6634C]' : 'text-[#2F6B3F]'
                }`}>
                  {isTeacher ? '👨‍🏫 园丁教研' : '👧 童趣泥作'}
                </span>
              </div>

              {/* 标题 */}
              <h3 className="font-serif font-black text-xl md:text-2xl text-[#122818] leading-snug mb-2">
                {item.title}
              </h3>

              {/* 学校与作者 */}
              <div className="text-xs text-[#3B6647] flex items-center gap-2 mb-3">
                <span className="flex items-center gap-1 font-medium">
                  <School size={12} className="text-[#327346]" /> {item.school}
                </span>
                <span>·</span>
                <span className="font-bold text-[#122818]">{item.author}</span>
                <span>·</span>
                <span className="font-mono text-[#3B6647]/70 text-[11px]">{item.date}</span>
              </div>

              {/* 内容正文（纯自然呼吸文字，无任何灰色盒子） */}
              <p className="text-xs md:text-sm leading-relaxed text-[#122818]/90 font-serif whitespace-pre-wrap mb-4">
                {item.content}
              </p>

              {/* 录像外链 */}
              {item.videoUrl && (
                <div className="mb-4">
                  <a
                    href={item.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-[#2F6B3F] hover:text-[#122818] font-bold underline"
                  >
                    <Video size={13} />
                    <span>观摩配套示范课录像</span>
                    <ExternalLink size={11} />
                  </a>
                </div>
              )}

              {/* 点赞与留言（纯净留白交互，无横线与外框） */}
              <div className="flex items-center justify-between text-xs text-[#3B6647] py-2">
                <button
                  type="button"
                  onClick={() => {
                    storySound.playPinDrop();
                    onItemLiked(item.id);
                  }}
                  className="flex items-center gap-1.5 hover:text-red-600 font-bold transition-colors cursor-pointer"
                >
                  <Heart
                    size={15}
                    className={item.likes > 0 ? 'fill-red-500 text-red-600' : ''}
                  />
                  <span>点赞 ({item.likes})</span>
                </button>

                <button
                  type="button"
                  onClick={() => toggleComments(item.id)}
                  className="flex items-center gap-1.5 hover:text-[#122818] font-bold transition-colors cursor-pointer"
                >
                  <MessageSquare size={14} />
                  <span>便签留言 ({item.comments.length})</span>
                </button>
              </div>

              {/* 便签留言区（纯文字层次与缩进，无盒子、无阴影、无分割线） */}
              <div className="mt-2 space-y-3 pl-3">
                {/* 留言列表 */}
                <div className="space-y-2">
                  {(showAllComments ? item.comments : item.comments.slice(0, 2)).map((c) => (
                    <div key={c.id} className="text-xs">
                      <div className="flex items-center gap-2 text-[11px] text-[#3B6647] mb-0.5 font-medium">
                        <span className="font-bold text-[#122818]">{c.user}</span>
                        <span className="text-[10px] opacity-70">{c.time}</span>
                      </div>
                      <p className="text-[#122818] leading-snug font-serif pl-1">{c.text}</p>
                    </div>
                  ))}
                  {item.comments.length > 2 && (
                    <button
                      type="button"
                      onClick={() => toggleComments(item.id)}
                      className="text-[11px] text-[#3B6647] hover:text-[#122818] cursor-pointer font-bold"
                    >
                      {showAllComments ? '收起部分' : `展开全部 (${item.comments.length})`}
                    </button>
                  )}
                  {item.comments.length === 0 && (
                    <p className="text-[11px] text-[#3B6647]/70 italic">
                      还没有便签，留下第一句心意吧~
                    </p>
                  )}
                </div>

                {/* 极简无边框便签输入栏 */}
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    placeholder="写下一张暖心便签..."
                    value={commentInputs[item.id] || ''}
                    onChange={(e) =>
                      setCommentInputs({ ...commentInputs, [item.id]: e.target.value })
                    }
                    onKeyDown={(e) => e.key === 'Enter' && handlePostComment(item.id)}
                    className="flex-1 px-3 py-1.5 text-xs clay-input focus:outline-none placeholder:text-[#3B6647]/50"
                  />
                  <button
                    type="button"
                    onClick={() => handlePostComment(item.id)}
                    className="clay-btn px-3 py-1.5 text-xs font-bold"
                    title="贴上便签"
                  >
                    <Send size={12} />
                  </button>
                </div>
              </div>

            </div>
          );
        })}
      </div>
    </div>
  );
}
