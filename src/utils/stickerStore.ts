/**
 * 拼贴贴纸的本地持久化与额度管理。
 * 沿用项目的轻量模式：localStorage + 纯函数，不引入 zustand。
 */

import type { Sticker, Task } from '../types';
import { makePresetSticker, seedStickers } from './stickerAssets';

const STICKERS_KEY = 'pupils-eyes:collage-stickers';
const QUOTA_KEY = 'pupils-eyes:collage-quota';
const TASKS_KEY = 'pupils-eyes:tasks';
/** 「我的贴纸」素材库：上传生成并确认收藏的贴纸 */
const LIBRARY_KEY = 'pupils-eyes:sticker-library';

/** 背包里收藏的自制贴纸 */
export interface MySticker {
  id: string;
  /** 贴纸图（webp/PNG dataURL，透明背景） */
  src: string;
  /** 生成时间戳 */
  createdAt: number;
  /** 已发布到公共素材库时的远端 id */
  remoteId?: string;
  /** 是否对所有人可见 */
  isPublic?: boolean;
}

/** 素材库最多保留多少张（localStorage 容量保护） */
const LIBRARY_MAX = 30;

export function loadLibrary(): MySticker[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(LIBRARY_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as MySticker[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function saveLibrary(list: MySticker[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LIBRARY_KEY, JSON.stringify(list));
  } catch {
    /* 配额满时静默失败，不阻塞使用 */
  }
}

/** 改某一张的元信息（公开状态、远端 id），返回新列表 */
export function patchLibraryItem(id: string, patch: Partial<MySticker>): MySticker[] {
  const next = loadLibrary().map((s) => (s.id === id ? { ...s, ...patch } : s));
  saveLibrary(next);
  return next;
}

/** 新增一张自制贴纸到素材库（超出上限时丢最旧的）；返回新列表 */
export function addToLibrary(src: string): MySticker[] {
  const item: MySticker = { id: `my-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, src, createdAt: Date.now() };
  const next = [item, ...loadLibrary()].slice(0, LIBRARY_MAX);
  saveLibrary(next);
  return next;
}

/** 从素材库删除一张 */
export function removeFromLibrary(id: string): MySticker[] {
  const next = loadLibrary().filter((s) => s.id !== id);
  saveLibrary(next);
  return next;
}

/** 每日任务定义（固定 4 个，进度存 localStorage，跨天自动重置） */
export interface TaskDef {
  id: string;
  title: string;
  desc: string;
  goal: number;
  icon: string;
}

export const TASK_DEFS: TaskDef[] = [
  { id: 'checkin', title: '花园打卡', desc: '走进拼贴花园逛一逛', goal: 1, icon: '🌼' },
  { id: 'read', title: '读一份教案', desc: '翻开成果手册读一篇', goal: 1, icon: '📖' },
  { id: 'like', title: '点亮一份成果', desc: '为喜欢的成果点亮小灯', goal: 1, icon: '✨' },
  { id: 'upload', title: '创作一张贴纸', desc: '上传照片，变出你的贴纸', goal: 1, icon: '🎨' },
];

/** 当天日期键，用于「每日任务」的跨天重置 */
function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/** 默认可上传贴纸额度（完成任务可 +1，见任务中心） */
export const DEFAULT_QUOTA = 3;

/** 读取贴纸；首次进入时生成一组预置贴纸作为演示 */
export function loadStickers(): Sticker[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STICKERS_KEY);
    if (raw) return JSON.parse(raw) as Sticker[];
  } catch {
    /* ignore */
  }

  const now = Date.now();
  const seeds: Sticker[] = seedStickers().map((preset, i) => ({
    id: `stk-${now}-${i}`,
    src: makePresetSticker(preset),
    preset,
    x: (i - 2) * 1.9,
    y: -1.8 - (i % 2) * 0.9,
    z: 0.1,
    scale: 1,
    rotation: 0,
    flipX: false,
    layer: i,
  }));
  saveStickers(seeds);
  return seeds;
}

export function saveStickers(list: Sticker[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STICKERS_KEY, JSON.stringify(list));
  } catch {
    /* 隐私模式可能写不进去 */
  }
}

/** 读取贴纸上传额度 */
export function loadQuota(): number {
  if (typeof window === 'undefined') return DEFAULT_QUOTA;
  try {
    const v = window.localStorage.getItem(QUOTA_KEY);
    const n = v ? parseInt(v, 10) : NaN;
    return Number.isFinite(n) ? n : DEFAULT_QUOTA;
  } catch {
    return DEFAULT_QUOTA;
  }
}

export function setQuota(n: number) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(QUOTA_KEY, String(n));
  } catch {
    /* ignore */
  }
}

/* ---------------- 每日任务 ---------------- */

function defaultTasks(): Task[] {
  return TASK_DEFS.map((d) => ({
    id: d.id,
    title: d.title,
    desc: d.desc,
    goal: d.goal,
    progress: 0,
    claimed: false,
  }));
}

/** 读取当天任务；跨天自动重置 */
export function loadTasks(): Task[] {
  if (typeof window === 'undefined') return defaultTasks();
  try {
    const raw = window.localStorage.getItem(TASKS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { date?: string; tasks?: Task[] };
      if (parsed?.date === todayKey() && Array.isArray(parsed.tasks)) {
        return parsed.tasks;
      }
    }
  } catch {
    /* ignore */
  }
  const tasks = defaultTasks();
  saveTasks(tasks);
  return tasks;
}

export function saveTasks(tasks: Task[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(TASKS_KEY, JSON.stringify({ date: todayKey(), tasks }));
  } catch {
    /* ignore */
  }
}

/** 某事件触发，把对应任务进度拉满；返回更新后的任务列表 */
export function bumpTask(id: string): Task[] {
  const tasks = loadTasks();
  let changed = false;
  const next = tasks.map((t) => {
    if (t.id === id && t.progress < t.goal) {
      changed = true;
      return { ...t, progress: t.goal };
    }
    return t;
  });
  if (changed) saveTasks(next);
  return next;
}

/** 领取任务奖励：额度 +1，标记已领取；返回新的额度 */
export function claimTask(id: string): number {
  const tasks = loadTasks();
  const t = tasks.find((x) => x.id === id);
  if (!t || t.claimed || t.progress < t.goal) return loadQuota();
  const next = tasks.map((x) => (x.id === id ? { ...x, claimed: true } : x));
  saveTasks(next);
  const q = loadQuota() + 1;
  setQuota(q);
  return q;
}

/** 是否有「已完成但未领取」的奖励（用于入口红点） */
export function hasUnclaimedReward(): boolean {
  return loadTasks().some((t) => t.progress >= t.goal && !t.claimed);
}
