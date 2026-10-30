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
      
      {/* 顶部标题区 */}
      <div className="text-center max-w-2xl mx-auto mb-10">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 clay-card text-xs font-black text-[#477051] mb-3">
          <Sparkles size={14} className="text-[#E6B84A]" />
          <span>师生生态共创 · 秘密花园展览</span>
        </div>
        <h2 className="text-3xl md:text-4xl font-black tracking-wide text-[#1E3824]">
          童眼看自然 · 泥塑手记画卷
        </h2>
        <p className="text-xs md:text-sm text-[#52796F] mt-2.5 leading-relaxed font-serif">
          这里收录了来自全国各个区县的教学实践与孩子们的童趣观察，每张卡片都如同一块手捏陶土标本，可随时贴上手绘便签参与交流。
        </p>

        {/* 身份筛选过滤器（陶土按键） */}
        <div className="flex items-center justify-center gap-3 mt-6">
          <button
            type="button"
            onClick={() => {
              storySound.playPaperTurn();
              setFilterRole('ALL');
            }}
            className={`px-5 py-2 text-xs font-black transition-all ${
              filterRole === 'ALL'
                ? 'clay-btn bg-[#6E9277]'
                : 'clay-card hover:bg-[#FAF5E8] text-[#1E3824]'
            }`}
          >
            全部作品 ({items.length})
          </button>
          <button
            type="button"
            onClick={() => {
              storySound.playPaperTurn();
              setFilterRole('TEACHER');
            }}
            className={`px-5 py-2 text-xs font-black transition-all ${
              filterRole === 'TEACHER'
                ? 'clay-btn-terracotta'
                : 'clay-card hover:bg-[#FAF5E8] text-[#1E3824]'
            }`}
          >
            👨‍🏫 教师教案设计
          </button>
          <button
            type="button"
            onClick={() => {
              storySound.playPaperTurn();
              setFilterRole('STUDENT');
            }}
            className={`px-5 py-2 text-xs font-black transition-all ${
              filterRole === 'STUDENT'
                ? 'clay-btn bg-[#6E9277]'
                : 'clay-card hover:bg-[#FAF5E8] text-[#1E3824]'
            }`}
          >
            👧 学生泥塑手记
          </button>
        </div>
      </div>

      {/* 成果瀑布流 Masonry Grid */}
      <div className="columns-1 md:columns-2 lg:columns-3 gap-7 space-y-7">
        {filteredItems.map((item) => {
          const isHighlighted = targetHighlightId === item.id;
          const showAllComments = expandedComments[item.id];
          const isTeacher = item.role === 'TEACHER';

          return (
            <div
              key={item.id}
              id={`work-${item.id}`}
              className={`break-inside-avoid clay-card p-6 relative transition-all duration-300 ${
                isHighlighted ? 'ring-4 ring-[#E6B84A] scale-[1.02]' : 'hover:-translate-y-1'
              }`}
            >
              {/* 顶部手捏软陶胶带标签 */}
              <div 
                className={`absolute -top-3.5 right-6 px-3.5 py-1 text-[11px] font-black rounded-full border-2 border-[#1E3824] shadow-xs rotate-2 ${
                  isTeacher ? 'bg-[#D47A6A] text-[#FAF5E8]' : 'bg-[#6E9277] text-[#FAF5E8]'
                }`}
              >
                {isTeacher ? '👨‍🏫 园丁教研' : '👧 童趣泥作'}
              </div>

              {/* 地区与学校信息 */}
              <div className="flex items-center justify-between text-xs text-[#52796F] font-black mb-2.5">
                <span className="flex items-center gap-1.5">
                  <MapPin size={13} className="text-[#6E9277]" />
                  <span>{item.region}</span>
                </span>
                <span className="text-[11px] font-mono text-[#52796F]/80">{item.date}</span>
              </div>

              {/* 标题 */}
              <h3 className="font-black text-xl text-[#1E3824] leading-snug mb-2 font-serif">
                {item.title}
              </h3>

              {/* 学校与作者 */}
              <div className="text-xs text-[#52796F] flex items-center gap-2 mb-4">
                <span className="flex items-center gap-1 font-medium">
                  <School size={12} className="text-[#6E9277]" /> {item.school}
                </span>
                <span>·</span>
                <span className="font-black text-[#1E3824]">{item.author}</span>
              </div>

              {/* 作品图片 */}
              {item.imageUrl && (
                <div className="relative w-full h-48 rounded-xl overflow-hidden mb-4 border-2 border-[#1E3824] bg-white shadow-xs">
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
              )}

              {/* 内容正文（教学反思或日记） */}
              <div className="p-4 bg-[#EAEFE6] rounded-xl border-2 border-[#1E3824]/30 text-xs md:text-sm leading-relaxed text-[#1E3824]/90 whitespace-pre-wrap font-serif">
                {item.content}
              </div>

              {/* 录像外链 */}
              {item.videoUrl && (
                <div className="mt-3">
                  <a
                    href={item.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-[#52796F] hover:text-[#1E3824] underline font-bold"
                  >
                    <Video size={13} className="text-[#6E9277]" />
                    <span>观摩配套示范课录像</span>
                    <ExternalLink size={11} />
                  </a>
                </div>
              )}

              {/* 底部点赞与留言统计 */}
              <div className="flex items-center justify-between text-xs text-[#52796F] mt-5 pt-3 border-t-2 border-[#1E3824]/15">
                <button
                  type="button"
                  onClick={() => {
                    storySound.playPinDrop();
                    onItemLiked(item.id);
                  }}
                  className="flex items-center gap-1.5 hover:text-red-600 font-black transition-colors"
                >
                  <Heart
                    size={16}
                    className={item.likes > 0 ? 'fill-red-500 text-red-600' : ''}
                  />
                  <span>点赞 ({item.likes})</span>
                </button>

                <button
                  type="button"
                  onClick={() => toggleComments(item.id)}
                  className="flex items-center gap-1.5 hover:text-[#1E3824] font-black transition-colors"
                >
                  <MessageSquare size={15} />
                  <span>便利贴留言 ({item.comments.length})</span>
                </button>
              </div>

              {/* 手写便利贴留言抽屉 */}
              <div className="mt-4 pt-3.5 border-t-2 border-dashed border-[#1E3824]/20 space-y-3">
                <div className="flex items-center justify-between text-xs font-black text-[#52796F]">
                  <span>🌿 读者写下的小纸条</span>
                  {item.comments.length > 2 && (
                    <button
                      type="button"
                      onClick={() => toggleComments(item.id)}
                      className="underline text-[11px]"
                    >
                      {showAllComments ? '收起部分' : `展开全部 (${item.comments.length})`}
                    </button>
                  )}
                </div>

                {/* 留言列表（黄色手写便利贴） */}
                <div className="space-y-2.5">
                  {(showAllComments ? item.comments : item.comments.slice(0, 2)).map((c) => (
                    <div
                      key={c.id}
                      className="bg-[#FFF9DE] p-3 rounded-lg border-2 border-[#1E3824] text-xs rotate-[-0.5deg] shadow-xs"
                    >
                      <div className="flex items-center justify-between text-[11px] text-[#52796F] mb-1 font-bold">
                        <span className="text-[#1E3824]">{c.user}</span>
                        <span>{c.time}</span>
                      </div>
                      <p className="text-[#1E3824] leading-snug font-serif">{c.text}</p>
                    </div>
                  ))}
                  {item.comments.length === 0 && (
                    <p className="text-xs text-[#52796F] italic py-1">
                      还没有人留下便签，快来贴上第一张小纸条吧~
                    </p>
                  )}
                </div>

                {/* 便利贴输入栏 */}
                <div className="flex items-center gap-2 mt-2.5">
                  <input
                    type="text"
                    placeholder="贴一张暖心手写便签..."
                    value={commentInputs[item.id] || ''}
                    onChange={(e) =>
                      setCommentInputs({ ...commentInputs, [item.id]: e.target.value })
                    }
                    onKeyDown={(e) => e.key === 'Enter' && handlePostComment(item.id)}
                    className="flex-1 px-3 py-2 text-xs clay-input focus:outline-none placeholder:text-gray-400"
                  />
                  <button
                    type="button"
                    onClick={() => handlePostComment(item.id)}
                    className="clay-btn p-2"
                    title="贴上便签"
                  >
                    <Send size={14} />
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
