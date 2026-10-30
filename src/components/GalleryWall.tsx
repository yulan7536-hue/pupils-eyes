import { useState } from 'react';
import { Heart, MessageSquare, MapPin, Send, School, Video, ExternalLink, Sparkles, Filter } from 'lucide-react';
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
    <div className="w-full max-w-6xl mx-auto px-4 py-10 select-none">
      
      {/* 顶部标题区：秘密花园手绘画卷 */}
      <div className="text-center max-w-2xl mx-auto mb-8">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#FAF7EE] border border-[#1A3320] text-xs font-bold text-[#52796F] rounded-full mb-2 hand-drawn-box-sm">
          <Sparkles size={13} className="text-[#85A98F]" />
          <span>师生生态共创 · 秘密花园展览</span>
        </div>
        <h2 className="text-2xl md:text-3xl font-bold tracking-wide text-[#1A3320]">
          童眼看自然 · 师生手记画卷
        </h2>
        <p className="text-xs md:text-sm text-[#52796F] mt-2 leading-relaxed">
          这里收录了来自全国各个区县的教学实践与孩子们的童趣观察，每张卡片都如同一页植物标本，可随时写下手绘便签参与交流。
        </p>

        {/* 身份筛选过滤器 */}
        <div className="flex items-center justify-center gap-2 mt-5">
          <button
            type="button"
            onClick={() => {
              storySound.playPaperTurn();
              setFilterRole('ALL');
            }}
            className={`px-4 py-1.5 text-xs font-bold rounded-full border border-[#1A3320] transition-all ${
              filterRole === 'ALL'
                ? 'bg-[#85A98F] text-white hand-drawn-box-sm'
                : 'bg-[#FAF7EE] text-[#1A3320] hover:bg-[#F3F7F0]'
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
            className={`px-4 py-1.5 text-xs font-bold rounded-full border border-[#1A3320] transition-all ${
              filterRole === 'TEACHER'
                ? 'bg-[#85A98F] text-white hand-drawn-box-sm'
                : 'bg-[#FAF7EE] text-[#1A3320] hover:bg-[#F3F7F0]'
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
            className={`px-4 py-1.5 text-xs font-bold rounded-full border border-[#1A3320] transition-all ${
              filterRole === 'STUDENT'
                ? 'bg-[#85A98F] text-white hand-drawn-box-sm'
                : 'bg-[#FAF7EE] text-[#1A3320] hover:bg-[#F3F7F0]'
            }`}
          >
            👧 学生泥塑手记
          </button>
        </div>
      </div>

      {/* 成果瀑布流 Masonry Grid */}
      <div className="columns-1 md:columns-2 lg:columns-3 gap-6 space-y-6">
        {filteredItems.map((item) => {
          const isHighlighted = targetHighlightId === item.id;
          const showAllComments = expandedComments[item.id];

          return (
            <div
              key={item.id}
              id={`work-${item.id}`}
              className={`break-inside-avoid parchment-sheet p-5 hand-drawn-border hand-drawn-box relative transition-all duration-300 ${
                isHighlighted ? 'ring-4 ring-[#85A98F] scale-[1.02]' : 'hover:-translate-y-1'
              }`}
            >
              {/* 顶部手绘贴纸便签 */}
              <div className="absolute -top-3 right-6 px-3 py-0.5 bg-[#FAF3D1] border border-[#1A3320] text-[10px] font-bold text-[#1A3320] rotate-[1.5deg] shadow-sm">
                {item.role === 'TEACHER' ? '👨‍🏫 园丁教研' : '👧 童趣泥作'}
              </div>

              {/* 地区与学校信息 */}
              <div className="flex items-center justify-between text-[11px] text-[#52796F] font-semibold mb-2">
                <span className="flex items-center gap-1">
                  <MapPin size={12} className="text-[#85A98F]" />
                  <span>{item.region}</span>
                </span>
                <span>{item.date}</span>
              </div>

              {/* 标题 */}
              <h3 className="font-bold text-lg text-[#1A3320] leading-snug mb-1">
                {item.title}
              </h3>

              {/* 学校与作者 */}
              <div className="text-xs text-[#52796F] flex items-center gap-2 mb-3">
                <span className="flex items-center gap-1">
                  <School size={11} /> {item.school}
                </span>
                <span>·</span>
                <span className="font-bold text-[#1A3320]">{item.author}</span>
              </div>

              {/* 作品图片 */}
              {item.imageUrl && (
                <div className="relative w-full h-44 rounded overflow-hidden mb-3 border border-[#1A3320] bg-white">
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
              )}

              {/* 内容正文（教学反思或日记） */}
              <div className="p-3 bg-[#F3F7F0] rounded hand-drawn-border-sm text-xs leading-relaxed text-[#1A3320]/85 whitespace-pre-wrap font-serif">
                {item.content}
              </div>

              {/* 录像外链 */}
              {item.videoUrl && (
                <div className="mt-2.5">
                  <a
                    href={item.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-[#52796F] hover:text-[#1A3320] underline font-semibold"
                  >
                    <Video size={13} />
                    <span>观摩配套示范课录像</span>
                    <ExternalLink size={10} />
                  </a>
                </div>
              )}

              {/* 底部点赞与留言统计 */}
              <div className="flex items-center justify-between text-xs text-[#52796F] mt-4 pt-2.5 border-t border-[#1A3320]/15">
                <button
                  type="button"
                  onClick={() => {
                    storySound.playPinDrop();
                    onItemLiked(item.id);
                  }}
                  className="flex items-center gap-1 hover:text-red-500 font-semibold transition-colors"
                >
                  <Heart
                    size={15}
                    className={item.likes > 0 ? 'fill-red-400 text-red-500' : ''}
                  />
                  <span>点赞 ({item.likes})</span>
                </button>

                <button
                  type="button"
                  onClick={() => toggleComments(item.id)}
                  className="flex items-center gap-1 hover:text-[#1A3320] font-semibold transition-colors"
                >
                  <MessageSquare size={14} />
                  <span>手绘便利贴 ({item.comments.length})</span>
                </button>
              </div>

              {/* 手写便利贴留言抽屉 */}
              <div className="mt-3 pt-3 border-t border-dashed border-[#1A3320]/25 space-y-2.5">
                <div className="flex items-center justify-between text-[11px] font-bold text-[#52796F]">
                  <span>🌿 读者写下的小纸条</span>
                  {item.comments.length > 2 && (
                    <button
                      type="button"
                      onClick={() => toggleComments(item.id)}
                      className="underline text-[10px]"
                    >
                      {showAllComments ? '收起部分' : `展开全部 (${item.comments.length})`}
                    </button>
                  )}
                </div>

                {/* 留言列表 */}
                <div className="space-y-2">
                  {(showAllComments ? item.comments : item.comments.slice(0, 2)).map((c) => (
                    <div
                      key={c.id}
                      className="bg-[#FFF9DE] p-2.5 hand-drawn-border-sm text-xs rotate-[-0.5deg] relative shadow-xs"
                    >
                      <div className="flex items-center justify-between text-[10px] text-[#52796F] mb-1">
                        <span className="font-bold text-[#1A3320]">{c.user}</span>
                        <span>{c.time}</span>
                      </div>
                      <p className="text-[#1A3320] leading-snug font-serif">{c.text}</p>
                    </div>
                  ))}
                  {item.comments.length === 0 && (
                    <p className="text-[11px] text-[#52796F] italic py-1">
                      还没有人留下便签，快来贴上第一张小纸条吧~
                    </p>
                  )}
                </div>

                {/* 便利贴输入栏 */}
                <div className="flex items-center gap-1.5 mt-2">
                  <input
                    type="text"
                    placeholder="贴一张暖心手写便签..."
                    value={commentInputs[item.id] || ''}
                    onChange={(e) =>
                      setCommentInputs({ ...commentInputs, [item.id]: e.target.value })
                    }
                    onKeyDown={(e) => e.key === 'Enter' && handlePostComment(item.id)}
                    className="flex-1 px-3 py-1.5 text-xs bg-white border border-[#1A3320] rounded focus:outline-none placeholder:text-gray-400"
                  />
                  <button
                    type="button"
                    onClick={() => handlePostComment(item.id)}
                    className="p-1.5 bg-[#85A98F] text-white rounded border border-[#1A3320] hover:bg-[#52796F] transition-colors"
                    title="贴上便签"
                  >
                    <Send size={13} />
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
