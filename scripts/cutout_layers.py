#!/usr/bin/env python3
"""
把 garden-bg.jpg 拆成四层：底图 + 紫藤 + 左粉花 + 右粉花，
并顺带算出紫藤"每一串"的摆动分栏，生成 src/components/wisteriaStrands.ts。

产物（public/scene/，全部与底图同尺寸、同对齐参数）：
  base.webp          挖掉花、用 push-pull 平滑回填的底图
  wisteria.webp      顶部紫藤（只含花串，不含天空/建筑）
  bloom-left.webp    左侧边缘粉色花树
  bloom-right.webp   右侧边缘粉色花树
  ../.cutout-qa/*.png 掩膜与摆动模拟预览，人工核验用

紫藤判据为什么用 B-G：
  这张图的天空是暖奶油色（R≈250,G≈230,B≈215），紫藤是蓝紫（B 比 G 高 30~65）。
  上一版用 R-G>=40 抓粉色，结果整片暖天空都被算进花层，再一膨胀填洞，
  凉亭屋顶、拱门、桥、灯、云全部变成实心块，跟着一起晃。
  B-G>22 能把花串和天空/建筑彻底分开（实测天空最大 18、花最小 30）。

摆动分栏为什么要按"空隙"切：
  花串是垂下来的独立团块，空隙处的 alpha 是 0。沿空隙竖切，切线上没有任何像素，
  两串各绕自己顶端转多少度都不会露缝 —— 这是唯一能既不切断花、又能分开摆的办法。
  空隙不够的地方按加权覆盖率取最小值当切线（越靠下权重越高，因为越靠下摆幅越大）。

用法：python3 scripts/cutout_layers.py
"""

import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets-src" / "garden-bg.jpg"  # 原始素材放 assets-src，不进 dist
OUT = ROOT / "public" / "scene"
QA = ROOT / ".cutout-qa"  # 不放 public 里，免得 QA 预览图被打进 dist
STRANDS_TS = ROOT / "src" / "components" / "wisteriaStrands.ts"

# 花层只取画面上部这一段，下面的建筑/水面一律不进来
Y_LIMIT_F = 0.42

# 摆动分栏参数（像素，最终按图宽换算成百分比）
SLICE_TARGET = 74.0  # 每栏目标宽度
SLICE_MIN = 38.0  # 太窄的栏并进邻居
SLICE_BLEED = 5.0  # 左右各借几像素，遮住旋转时顶边的一丝缝

# 左右两棵边缘花树的多边形（归一化 x, y）。顶点贴着树冠外沿，不切进建筑与水面。
TREE_POLYS = {
    "bloom-left": [
        (0.000, 0.300), (0.030, 0.292), (0.066, 0.306), (0.098, 0.324),
        (0.124, 0.352), (0.130, 0.440), (0.126, 0.560), (0.112, 0.640),
        (0.078, 0.678), (0.040, 0.696), (0.000, 0.690),
    ],
    "bloom-right": [
        (0.928, 0.480), (0.946, 0.432), (0.972, 0.416), (1.000, 0.420),
        (1.000, 0.668), (0.972, 0.692), (0.936, 0.678),
    ],
}


def poly_mask(points, W, H):
    img = Image.new("L", (W, H), 0)
    ImageDraw.Draw(img).polygon([(x * W, y * H) for x, y in points], fill=255)
    return np.asarray(img) > 127


def close(m: np.ndarray, r: int) -> np.ndarray:
    """先膨胀后腐蚀：把花瓣之间的细缝连起来，不改变外轮廓。"""
    img = Image.fromarray(m.astype(np.uint8) * 255, "L")
    return np.asarray(img.filter(ImageFilter.MaxFilter(2 * r + 1)).filter(
        ImageFilter.MinFilter(2 * r + 1))) > 127


def fill_holes(m: np.ndarray) -> np.ndarray:
    """灌水填内部空洞，免得花团里留下不会动的死斑。

    注意：只填真正的"洞"。花串之间的空隙在下沿是开口的，灌水能流出去，不会被填。
    """
    h, w = m.shape
    bg = ~m
    reach = np.zeros_like(bg)
    reach[0, :] = reach[-1, :] = reach[:, 0] = reach[:, -1] = True
    reach &= bg
    for _ in range(h + w):
        prev = reach.copy()
        reach[1:] |= reach[:-1] & bg[1:]
        reach[:-1] |= reach[1:] & bg[:-1]
        reach[:, 1:] |= reach[:, :-1] & bg[:, 1:]
        reach[:, :-1] |= reach[:, 1:] & bg[:, :-1]
        if np.array_equal(reach, prev):
            break
    return m | (bg & ~reach)


def rolling_max(prof: np.ndarray, r: int) -> np.ndarray:
    out = prof.copy()
    for d in range(1, r + 1):
        out[d:] = np.maximum(out[d:], prof[:-d])
        out[:-d] = np.maximum(out[:-d], prof[d:])
    return out


def wisteria_mask(a: np.ndarray, W: int, H: int) -> np.ndarray:
    R, G, B = a[..., 0], a[..., 1], a[..., 2]
    ylim = int(Y_LIMIT_F * H)
    # 蓝绿差：紫藤 30~65，暖天空 <20，凉灰天空 ~18，建筑（含绿顶/朱柱）基本为负
    m = (B - G > 22) & (R > G - 5)
    m[ylim:] = False

    # 逐列下包络：花串下方的零星紫点（水面反光、花丛）判掉
    rows = np.where(m.any(axis=1))[0]
    bottom = np.zeros(W, dtype=np.int32)
    for x in range(W):
        ys = np.where(m[:ylim, x])[0]
        bottom[x] = ys.max() if len(ys) else 0
    env = rolling_max(bottom, 26) + 4
    m &= np.arange(H)[:, None] <= env[None, :]
    m[ylim:] = False

    m = close(m, 2)
    m = fill_holes(m)
    return m


def slice_bounds(alpha: np.ndarray, W: int, H: int):
    """按空隙把花串切成若干栏，返回百分比切口位置。"""
    ylim = int(Y_LIMIT_F * H)
    yy = np.arange(ylim, dtype=np.float32) / ylim
    # 加权覆盖率：越靠下（摆幅越大）权重越高，切口尽量落在下半部没有花的地方
    prof = (alpha[:ylim] * yy[:, None]).sum(axis=0)

    bounds = [0.0]
    x = 0.0
    while x + SLICE_TARGET < W - 1:
        target = x + SLICE_TARGET
        lo = int(max(x + SLICE_MIN, target - SLICE_TARGET * 0.45))
        hi = int(min(W - 1, target + SLICE_TARGET * 0.45))
        if hi <= lo:
            break
        seg = prof[lo:hi + 1]
        cols = np.arange(lo, hi + 1)
        mn = seg.min()
        # 近最小值的那些列里挑最靠近目标宽度的（真空隙就是整段 mn=0，取中点）
        near = cols[seg <= mn + max(1e-3, mn * 0.04)]
        cut = float(near[np.argmin(np.abs(near - target))])
        if cut - bounds[-1] < SLICE_MIN:
            x = target
            continue
        bounds.append(cut)
        x = cut
    bounds.append(float(W))

    # 尾栏过窄就并进前一栏
    if len(bounds) > 3 and bounds[-1] - bounds[-2] < SLICE_MIN:
        bounds.pop(-2)
    return bounds


def build_strands(alpha: np.ndarray, W: int, H: int):
    bounds = slice_bounds(alpha, W, H)
    n = len(bounds) - 1
    out = []
    for i in range(n):
        x0, x1 = bounds[i], bounds[i + 1]
        # 借边，但不能越出画布
        bl = min(SLICE_BLEED, x0)
        br = min(SLICE_BLEED, W - x1)
        ox0, ox1 = x0 - bl, x1 + br
        ow = ox1 - ox0
        # 相位：相邻栏错开一点 → 一道从左往右走的波；幅度用低频正弦错开，避免整齐划一
        # 顶盖已经把藤冠定死，摆幅只作用在下垂的花串上，整体收一档更像风
        amp = 1.75 + 0.4 * np.sin(i * 1.13 + 0.4)
        dur = 5.5 + 0.55 * np.sin(i * 0.71 + 1.9)
        delay = -0.17 * i
        out.append({
            "left": round(ox0 / W * 100, 4),
            "width": round(ow / W * 100, 4),
            # 内层大图相对本栏左上角的偏移与宽度（% 相对本栏宽度）
            "imgLeft": round(-ox0 / ow * 100, 4),
            "imgWidth": round(W / ow * 100, 4),
            "amp": round(float(amp), 3),
            "dur": round(float(dur), 3),
            "delay": round(float(delay), 3),
        })
    return out, bounds


def push_pull(img: np.ndarray, known: np.ndarray) -> np.ndarray:
    h, w = known.shape
    pad_h = (2 - h % 2) % 2
    pad_w = (2 - w % 2) % 2
    img_p = np.pad(img, ((0, pad_h), (0, pad_w), (0, 0)), mode="edge")
    known_p = np.pad(known, ((0, pad_h), (0, pad_w)), mode="edge")

    cur_img, cur_w = img_p * known_p[..., None], known_p[..., None]
    sums, weights = [cur_img], [cur_w]
    while min(cur_img.shape[:2]) > 4:
        hh = (cur_img.shape[0] // 2) * 2
        ww = (cur_img.shape[1] // 2) * 2
        cur_img = cur_img[:hh, :ww].reshape(hh // 2, 2, ww // 2, 2, 3).mean(axis=(1, 3))
        cur_w = cur_w[:hh, :ww].reshape(hh // 2, 2, ww // 2, 2, 1).mean(axis=(1, 3))
        sums.append(cur_img)
        weights.append(cur_w)

    color = [s / np.maximum(wt, 1e-4) for s, wt in zip(sums, weights)]
    for i in range(len(color) - 2, -1, -1):
        up = np.asarray(
            Image.fromarray((np.clip(color[i + 1], 0, 1) * 255).astype(np.uint8)).resize(
                (color[i].shape[1], color[i].shape[0]), Image.BILINEAR
            ),
            dtype=np.float32,
        ) / 255.0
        k = weights[i]
        color[i] = color[i] * k + up * (1.0 - k)
    return color[0][:h, :w]


def sway_preview(base8: np.ndarray, af: np.ndarray, alpha: np.ndarray, strands, W, H):
    """按最终角度把每栏绕自己顶边中点转出去，看看会不会露缝。"""
    canvas = base8.astype(np.float32)
    layer = np.concatenate([(np.clip(af, 0, 1) * 255).astype(np.uint8),
                            (alpha * 255).astype(np.uint8)[..., None]], axis=2)
    src = Image.fromarray(layer, "RGBA")
    for i, s in enumerate(strands):
        x0 = int(s["left"] / 100 * W)
        x1 = int((s["left"] + s["width"]) / 100 * W)
        crop = src.crop((x0, 0, x1, int(Y_LIMIT_F * H) + 60))
        # 用最大摆幅（amp 的两倍）做压力测试
        ang = -float(s["amp"]) * 2.0 if i % 2 == 0 else float(s["amp"]) * 2.0
        rot = crop.rotate(ang, resample=Image.BICUBIC, center=(crop.width / 2, 0), expand=False)
        tile = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        tile.paste(rot, (x0, 0))
        t = np.asarray(tile).astype(np.float32)
        a = t[..., 3:4] / 255.0
        canvas = canvas * (1 - a) + t[..., :3] * a
    Image.fromarray(np.clip(canvas, 0, 255).astype(np.uint8)).save(QA / "sway-preview.png")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    QA.mkdir(parents=True, exist_ok=True)

    rgb = Image.open(SRC).convert("RGB")
    W, H = rgb.size
    a = np.asarray(rgb).astype(np.float32)
    af = a / 255.0

    wis_bool = wisteria_mask(a, W, H)

    tree = np.zeros((H, W), bool)
    for poly in TREE_POLYS.values():
        tree |= poly_mask(poly, W, H)
    # 边缘花树由 bloom 层负责，紫藤层不能带一点——否则它俩绕不同轴心转，树根会撕开
    wis_bool &= ~tree

    wis = np.asarray(
        Image.fromarray(wis_bool.astype(np.uint8) * 255, "L").filter(ImageFilter.GaussianBlur(1.15))
    ).astype(np.float32) / 255.0

    layers = {"wisteria": wis}
    for name, poly in TREE_POLYS.items():
        m = poly_mask(poly, W, H)
        img = Image.fromarray(m.astype(np.uint8) * 255, "L").filter(ImageFilter.GaussianBlur(2.6))
        layers[name] = np.asarray(img).astype(np.float32) / 255.0

    for name, alpha in layers.items():
        ys, xs = np.where(alpha > 0.5)
        print(
            f"{name:11s} coverage={(alpha > 0.5).mean() * 100:5.2f}%  bbox="
            f"{xs.min() / W:.3f}, {xs.max() / W:.3f}, {ys.min() / H:.3f}, {ys.max() / H:.3f}"
        )

    union = np.clip(sum(layers.values()), 0.0, 1.0)
    base = af * (1 - union[..., None]) + push_pull(af, 1.0 - union) * union[..., None]
    base8 = np.clip(base, 0, 1) * 255
    Image.fromarray(base8.astype(np.uint8)).save(OUT / "base.webp", quality=90, method=6)
    Image.fromarray(base8.astype(np.uint8)).save(QA / "base-preview.png")

    for name, alpha in layers.items():
        rgba = np.concatenate(
            [(np.clip(af, 0, 1) * 255).astype(np.uint8), (alpha * 255).astype(np.uint8)[..., None]],
            axis=2,
        )
        Image.fromarray(rgba, "RGBA").save(OUT / f"{name}.webp", quality=90, method=6)

        m = alpha[..., None]
        vis = base8.astype(np.float32) * (1 - m) + np.array([255, 70, 60]) * m
        Image.fromarray(np.clip(vis, 0, 255).astype(np.uint8)).save(QA / f"mask-{name}.png")

    # 洋红底单独出一张，专门看紫藤有没有残留
    mag = np.full_like(af, [1.0, 0.0, 1.0])
    m = wis[..., None]
    vis = mag * (1 - m) + af * m
    Image.fromarray((np.clip(vis, 0, 1) * 255).astype(np.uint8)).save(QA / "wisteria-on-magenta.png")

    strands, bounds = build_strands(wis, W, H)
    print(f"strands={len(strands)}  cuts={[round(b) for b in bounds]}")
    sway_preview(base8, af, wis, strands, W, H)

    body = ",\n".join(
        "  { left: %s, width: %s, imgLeft: %s, imgWidth: %s, amp: %s, dur: %s, delay: %s }"
        % (s["left"], s["width"], s["imgLeft"], s["imgWidth"], s["amp"], s["dur"], s["delay"])
        for s in strands
    )
    STRANDS_TS.write_text(
        "// 由 scripts/cutout_layers.py 生成，勿手改。\n"
        "// 每一栏 = 一串（或几串挨在一起）紫藤，各自绕自己顶边中点转，形成一道风推过去的波。\n"
        "// left / width 是相对取景框的百分比；imgLeft / imgWidth 是栏内大图相对本栏宽度的百分比。\n"
        "export interface WisteriaStrand {\n"
        "  left: number;\n  width: number;\n  imgLeft: number;\n  imgWidth: number;\n"
        "  amp: number;\n  dur: number;\n  delay: number;\n}\n\n"
        "export const WISTERIA_STRANDS: WisteriaStrand[] = [\n" + body + ",\n];\n",
        encoding="utf-8",
    )
    print("done ->", OUT, "|", STRANDS_TS.relative_to(ROOT))


if __name__ == "__main__":
    main()
