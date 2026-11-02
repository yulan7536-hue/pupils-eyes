/**
 * 预置水彩贴纸：Canvas 生成透明背景的小元素，供拼贴花园直接使用。
 *
 * 风格对标「我的色彩」参考图板：马卡龙粉彩水彩治愈系。
 * 元素取自参考图的常见花草：樱花、雏菊、薰衣草、绣球、蒲公英、粉蝶、绿叶、星星、云朵。
 * 画法：径向渐变晕染（湿画法柔边）+ 点染花簇 + 淡高光留白。
 */

type DrawFn = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

interface PresetDef {
  label: string;
  draw: DrawFn;
}

const C = 256;

function canvas(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = C;
  c.height = C;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, C, C);
  return [c, ctx];
}

/** 水彩色团：径向渐变晕染的椭圆（柔边） */
function blob(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  color: string,
  alpha = 1
) {
  const g = ctx.createRadialGradient(x, y, Math.min(rx, ry) * 0.1, x, y, Math.max(rx, ry));
  g.addColorStop(0, color + 'ff');
  g.addColorStop(0.6, color + 'e6');
  g.addColorStop(1, color + '00');
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

/** 硬边小圆（用于花瓣、点染），带柔边晕 */
function dot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
  alpha = 1
) {
  const g = ctx.createRadialGradient(x, y, r * 0.1, x, y, r);
  g.addColorStop(0, color + 'ff');
  g.addColorStop(0.7, color + 'cc');
  g.addColorStop(1, color + '00');
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

/** 较实的浅蓝灰圆底，让纯白元素（雏菊/蒲公英/云）在浅色面板上也有清晰轮廓 */
function paleBackdrop(ctx: CanvasRenderingContext2D) {
  const g = ctx.createRadialGradient(C / 2, C / 2, C * 0.18, C / 2, C / 2, C * 0.46);
  g.addColorStop(0, 'rgba(174,194,200,0.95)');
  g.addColorStop(0.65, 'rgba(174,194,200,0.85)');
  g.addColorStop(1, 'rgba(174,194,200,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(C / 2, C / 2, C * 0.46, 0, Math.PI * 2);
  ctx.fill();
}

/** 五瓣花（花瓣绕中心一圈） */
function petalFlower(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  petalR: number,
  orbit: number,
  petalColor: string,
  coreColor: string,
  petals = 5
) {
  for (let i = 0; i < petals; i++) {
    const a = (i / petals) * Math.PI * 2 - Math.PI / 2;
    blob(ctx, cx + Math.cos(a) * orbit, cy + Math.sin(a) * orbit, petalR, petalR * 0.86, petalColor);
  }
  blob(ctx, cx, cy, petalR * 0.6, petalR * 0.6, coreColor);
}

const PRESET_DEFS: Record<string, PresetDef> = {
  // 小花：樱花粉五瓣花，花心鹅黄
  flower: {
    label: '小花',
    draw: (ctx) => {
      const cx = C / 2;
      const cy = C / 2;
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
        blob(ctx, cx + Math.cos(a) * 58, cy + Math.sin(a) * 58, 42, 36, '#f29aa6');
      }
      blob(ctx, cx, cy, 26, 26, '#f6d890');
      dot(ctx, cx, cy, 10, '#fff3c8');
    },
  },
  // 雏菊：奶白花瓣 + 金黄花心（淡棕描边，避免在浅色面板隐形）
  daisy: {
    label: '雏菊',
    draw: (ctx) => {
      paleBackdrop(ctx);
      const cx = C / 2;
      const cy = C / 2;
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        blob(ctx, cx + Math.cos(a) * 66, cy + Math.sin(a) * 66, 34, 20, '#fdf6ec', 0.95);
      }
      // 花瓣淡棕描边
      ctx.strokeStyle = 'rgba(186,150,104,0.85)';
      ctx.lineWidth = 5;
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        ctx.beginPath();
        ctx.ellipse(cx + Math.cos(a) * 66, cy + Math.sin(a) * 66, 34, 20, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      blob(ctx, cx, cy, 26, 26, '#f6d890');
      dot(ctx, cx, cy, 10, '#eac26a');
    },
  },
  // 樱花枝：褐色细枝 + 几朵粉花 + 花苞
  sakura: {
    label: '樱花',
    draw: (ctx) => {
      // 主枝
      ctx.strokeStyle = '#9c7a58';
      ctx.lineWidth = 7;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(30, 216);
      ctx.quadraticCurveTo(90, 150, 150, 118);
      ctx.stroke();
      // 细枝
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(120, 138);
      ctx.quadraticCurveTo(160, 110, 200, 92);
      ctx.moveTo(90, 150);
      ctx.quadraticCurveTo(70, 110, 60, 76);
      ctx.stroke();
      // 花苞
      dot(ctx, 60, 76, 10, '#f29aa6');
      dot(ctx, 200, 92, 9, '#f6b8c2');
      // 几朵五瓣樱花
      petalFlower(ctx, 128, 110, 30, 40, '#f6b8c2', '#f2d59a');
      petalFlower(ctx, 190, 78, 24, 32, '#f29aa6', '#f6d890');
      petalFlower(ctx, 66, 120, 22, 30, '#fbd0d6', '#f2d59a');
      // 零散花瓣飘落
      blob(ctx, 210, 140, 12, 9, '#f6b8c2', 0.9);
      blob(ctx, 46, 176, 11, 8, '#fbd0d6', 0.85);
    },
  },
  // 薰衣草：几根细茎 + 顶部紫穗花簇
  lavender: {
    label: '薰衣草',
    draw: (ctx) => {
      const stems: Array<[number, number]> = [
        [78, 128],
        [128, 118],
        [178, 128],
      ];
      stems.forEach(([x, top]) => {
        // 茎
        ctx.strokeStyle = '#8fae78';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x, 230);
        ctx.quadraticCurveTo(x + 2, 180, x, top);
        ctx.stroke();
        // 顶部紫穗：一串渐小的小圆点
        for (let i = 0; i < 7; i++) {
          const yy = top + i * 9;
          const rr = 11 - i * 1.1;
          const dx = Math.sin(i * 0.9) * 5;
          dot(ctx, x + dx, yy, Math.max(3, rr), '#b98fd0', 0.95);
          dot(ctx, x - dx, yy + 4, Math.max(2.6, rr * 0.8), '#c9a8d8', 0.9);
        }
      });
    },
  },
  // 绣球：蓝紫色大花球（密集小花簇）
  hydrangea: {
    label: '绣球',
    draw: (ctx) => {
      const cx = C / 2;
      const cy = C / 2;
      const colors = ['#b9a0cc', '#9a86c0', '#c9b8d8', '#a99ac8', '#d0c4e0'];
      let s = 20241102;
      const rand = () => {
        s = (s * 16807) % 2147483647;
        return s / 2147483647;
      };
      for (let i = 0; i < 90; i++) {
        const a = rand() * Math.PI * 2;
        const d = Math.sqrt(rand()) * 72;
        const px = cx + Math.cos(a) * d;
        const py = cy + Math.sin(a) * d * 0.92;
        const col = colors[Math.floor(rand() * colors.length)];
        dot(ctx, px, py, 7 + rand() * 5, col, 0.92);
      }
      // 叶片
      blob(ctx, cx - 66, cy + 74, 30, 20, '#9fce83', 0.9);
      blob(ctx, cx + 66, cy + 76, 30, 20, '#b7d89a', 0.9);
    },
  },
  // 蒲公英：白色绒球（硬边白点 + 灰描边）+ 金黄中心 + 绿色茎叶
  dandelion: {
    label: '蒲公英',
    draw: (ctx) => {
      paleBackdrop(ctx);
      const cx = C / 2;
      const cy = C / 2 - 8;
      // 放射状绒线（白色，稍粗）
      ctx.strokeStyle = 'rgba(255,255,255,0.95)';
      ctx.lineWidth = 3;
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * 72, cy + Math.sin(a) * 72);
        ctx.stroke();
      }
      // 绒线顶端绒点：白色实心 + 灰描边
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const px = cx + Math.cos(a) * 72;
        const py = cy + Math.sin(a) * 72;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(px, py, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(140,155,160,0.9)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(px, py, 8, 0, Math.PI * 2);
        ctx.stroke();
      }
      // 中心金黄
      ctx.fillStyle = '#f6d890';
      ctx.beginPath();
      ctx.arc(cx, cy, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(190,150,80,0.8)';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      // 茎
      ctx.strokeStyle = '#9fce83';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.quadraticCurveTo(cx + 6, cy + 60, cx - 4, cy + 110);
      ctx.stroke();
      // 飘散的绒球
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx + 88, cy - 66, 9, 0, Math.PI * 2);
      ctx.fill();
    },
  },
  // 叶子：嫩绿 + 叶脉
  leaf: {
    label: '叶子',
    draw: (ctx) => {
      const cx = C / 2;
      const cy = C / 2;
      blob(ctx, cx, cy, 40, 78, '#a9cf9e', 0.95);
      ctx.strokeStyle = 'rgba(120,158,96,0.7)';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx - 28, cy - 58);
      ctx.quadraticCurveTo(cx, cy, cx + 32, cy + 64);
      ctx.stroke();
      blob(ctx, cx, cy - 40, 28, 28, '#c8e2b4', 0.55);
    },
  },
  // 蝴蝶：粉紫两对翅膀
  butterfly: {
    label: '蝴蝶',
    draw: (ctx) => {
      const cx = C / 2;
      const cy = C / 2;
      const wings = [
        [cx - 46, cy - 40, 44, 50, '#c98ab0'],
        [cx - 40, cy + 22, 30, 34, '#e2a8c0'],
        [cx + 46, cy - 40, 44, 50, '#dda0c8'],
        [cx + 40, cy + 22, 30, 34, '#c98ab0'],
      ] as const;
      wings.forEach(([x, y, rx, ry, col]) => blob(ctx, x, y, rx, ry, col));
      // 翅膀上的淡点
      dot(ctx, cx - 52, cy - 46, 8, '#f7e0ec', 0.9);
      dot(ctx, cx + 52, cy - 46, 8, '#f7e0ec', 0.9);
      // 身体
      blob(ctx, cx, cy, 11, 38, '#8a6b45', 0.95);
      // 触须
      ctx.strokeStyle = '#8a6b45';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx - 4, cy - 38);
      ctx.quadraticCurveTo(cx - 20, cy - 66, cx - 34, cy - 74);
      ctx.moveTo(cx + 4, cy - 38);
      ctx.quadraticCurveTo(cx + 20, cy - 66, cx + 34, cy - 74);
      ctx.stroke();
    },
  },
  // 星星：金色五角星
  star: {
    label: '星星',
    draw: (ctx) => {
      const cx = C / 2;
      const cy = C / 2;
      const R = 78;
      const r = 34;
      ctx.fillStyle = '#f0d894';
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const rad = i % 2 === 0 ? R : r;
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        const x = cx + Math.cos(a) * rad;
        const y = cy + Math.sin(a) * rad;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(180,140,60,0.55)';
      ctx.lineWidth = 4;
      ctx.stroke();
      blob(ctx, cx, cy, 22, 22, '#fff3c8', 0.8);
    },
  },
  // 云朵：白主体 + 深蓝灰外轮廓（destination-over 只在外圈露边，轮廓连贯）
  cloud: {
    label: '云朵',
    draw: (ctx) => {
      const cx = C / 2;
      const cy = C / 2 + 14;
      const parts: Array<[number, number, number, number]> = [
        [cx - 44, cy + 4, 36, 26],
        [cx, cy - 16, 46, 36],
        [cx + 44, cy + 4, 32, 22],
      ];
      // 白色主体
      ctx.fillStyle = '#ffffff';
      parts.forEach(([x, y, rx, ry]) => {
        ctx.beginPath();
        ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
      });
      // 深蓝灰描边：画到白色下层，只在最外圈露出
      ctx.globalCompositeOperation = 'destination-over';
      ctx.fillStyle = '#46616b';
      parts.forEach(([x, y, rx, ry]) => {
        ctx.beginPath();
        ctx.ellipse(x, y, rx + 8, ry + 8, 0, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalCompositeOperation = 'source-over';
    },
  },
};

export const PRESET_STICKERS = Object.keys(PRESET_DEFS);

export function presetLabel(name: string): string {
  return PRESET_DEFS[name]?.label ?? name;
}

/** 生成一张预置贴纸的 dataURL（PNG），带白色描边（像一张真实贴纸） */
export function makePresetSticker(name: string): string {
  const def = PRESET_DEFS[name];
  if (!def) return '';
  const [c, ctx] = canvas();
  def.draw(ctx, C, C);
  return addWhiteBorder(c);
}

/**
 * 给贴纸加白色描边：把原图作为白色剪影向 8 个方向偏移绘制，形成白边，
 * 再覆盖原图。这样贴纸贴在插画上会有「实体贴纸」的轮廓感。
 */
function addWhiteBorder(src: HTMLCanvasElement): string {
  const pad = 14;
  const bw = 6; // 白边宽度
  const out = document.createElement('canvas');
  out.width = C + pad * 2;
  out.height = C + pad * 2;
  const octx = out.getContext('2d')!;
  // 白色剪影（保留 alpha，颜色转白）
  octx.filter = 'brightness(0) invert(1)';
  const dirs: Array<[number, number]> = [
    [-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1],
  ];
  for (const [dx, dy] of dirs) {
    octx.drawImage(src, pad + dx * bw, pad + dy * bw);
  }
  // 原图覆盖
  octx.filter = 'none';
  octx.drawImage(src, pad, pad);
  return out.toDataURL('image/png');
}

/** 首次进入拼贴花园时的默认贴纸：樱花 + 雏菊 + 薰衣草 + 小花 + 粉蝶 */
export function seedStickers(): string[] {
  return ['sakura', 'daisy', 'lavender', 'flower', 'butterfly'];
}
