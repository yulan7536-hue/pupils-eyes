#!/usr/bin/env python3
"""
把 garden-bg.jpg 拆成四层：底图 + 紫藤 + 左粉花 + 右粉花。

产物（public/scene/，全部与底图同尺寸、同对齐参数）：
  base.webp          挖掉花、用 push-pull 平滑回填的底图
  wisteria.webp      顶部紫藤（含花串）
  bloom-left.webp    左侧边缘粉色花树
  bloom-right.webp   右侧边缘粉色花树
  _qa/*.png          掩膜预览，人工核验用

为什么紫藤和粉花要用两套完全不同的分法：
- 紫藤是一大片从画面顶端垂下来的花，用花色调判据 + 上半部限位就能干净取出。
  它被描边切成无数小段、互不连通，靠连通域反而会漏掉大量碎花，
  静止时留在底图上就成了不会动的"死斑"。
- 粉色花树是彼此独立的团块，右半边受暖光影响 R-G 只有 13~21、与天空重叠，
  任何颜色判据都会在树冠上沿漏进天空。这里直接用手绘多边形把整棵树圈起来
  —— 图层里带一点树周围的天空/草地没关系，静止时与底图逐像素一致；
  但树内部必须整体一致，否则摆动时树会撕裂。

底图统一用 push-pull 金字塔回填（不是纯色涂抹），被花遮住的地方
自然延续天空/树丛/草地的渐变。

用法：python3 scripts/cutout_layers.py
"""

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets-src" / "garden-bg.jpg"  # 原始素材放 assets-src，不进 dist
OUT = ROOT / "public" / "scene"
QA = ROOT / ".cutout-qa"  # 不放 public 里，免得 QA 预览图被打进 dist

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

# 中景花树：紫藤层里整块挖掉，免得它们绕画面顶端转、根部撕裂
MID_TREES = [
    (0.245, 0.378, 0.400, 0.665),
    (0.400, 0.700, 0.400, 0.660),
]


def to_hsv(arr: np.ndarray):
    mx = arr.max(axis=2)
    mn = arr.min(axis=2)
    d = mx - mn
    h = np.zeros_like(mx)
    safe = d > 1e-6
    r, g, b = arr[..., 0], arr[..., 1], arr[..., 2]
    idx = safe & (mx == r)
    h[idx] = ((g[idx] - b[idx]) / d[idx]) % 6
    idx = safe & (mx == g) & (mx != r)
    h[idx] = (b[idx] - r[idx]) / d[idx] + 2
    idx = safe & (mx == b) & (mx != r) & (mx != g)
    h[idx] = (r[idx] - g[idx]) / d[idx] + 4
    h *= 60.0
    s = np.where(mx > 1e-6, d / np.maximum(mx, 1e-6), 0.0)
    return h, s, mx


def box_mask(boxes, W, H):
    m = np.zeros((H, W), bool)
    for x0, x1, y0, y1 in boxes:
        m[int(y0 * H): int(y1 * H), int(x0 * W): int(x1 * W)] = True
    return m


def poly_mask(points, W, H):
    img = Image.new("L", (W, H), 0)
    ImageDraw.Draw(img).polygon([(x * W, y * H) for x, y in points], fill=255)
    return np.asarray(img) > 127


def wisteria_mask(a, W, H):
    """上半部的花色调像素：冷紫 H≈290 与偏洋红的浅紫 H≈330 都要抓住。"""
    h, s, v = to_hsv(a / 255.0)
    R, G = a[..., 0], a[..., 1]

    purple = (h >= 250) & (h <= 348) & (s >= 0.10) & (v >= 0.42)
    pinkish = (R - G >= 40) & (R >= 200) & (s >= 0.12)
    m = purple | pinkish

    yy = np.arange(H)[:, None] / H
    m &= yy < 0.50
    m &= ~box_mask(MID_TREES, W, H)
    return m


def dilate(img: Image.Image, r: int) -> Image.Image:
    for _ in range(r):
        img = img.filter(ImageFilter.MaxFilter(3))
    return img


def fill_holes(m: np.ndarray) -> np.ndarray:
    """灌水填内部空洞，免得花团里留下不会动的死斑。"""
    H, W = m.shape
    bg = ~m
    seeds = np.zeros_like(bg)
    seeds[0, :] = seeds[-1, :] = seeds[:, 0] = seeds[:, -1] = True

    reach = seeds & bg
    for _ in range(1500):
        prev = reach.copy()
        reach[1:] |= reach[:-1] & bg[1:]
        reach[:-1] |= reach[1:] & bg[:-1]
        reach[:, 1:] |= reach[:, :-1] & bg[:, 1:]
        reach[:, :-1] |= reach[:, 1:] & bg[:, :-1]
        if np.array_equal(reach, prev):
            break
    return m | (bg & ~reach)


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


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    QA.mkdir(parents=True, exist_ok=True)

    rgb = Image.open(SRC).convert("RGB")
    W, H = rgb.size
    a = np.asarray(rgb).astype(np.float32)
    af = a / 255.0

    wis_bool = fill_holes(wisteria_mask(a, W, H))
    wis_img = dilate(Image.fromarray(wis_bool.astype(np.uint8) * 255, "L"), 7)
    wis = np.asarray(wis_img.filter(ImageFilter.GaussianBlur(3.0))).astype(np.float32) / 255.0

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
    base8 = (np.clip(base, 0, 1) * 255).astype(np.uint8)
    Image.fromarray(base8).save(OUT / "base.webp", quality=90, method=6)
    Image.fromarray(base8).save(QA / "base-preview.png")

    for name, alpha in layers.items():
        rgba = np.concatenate(
            [(np.clip(af, 0, 1) * 255).astype(np.uint8), (alpha * 255).astype(np.uint8)[..., None]],
            axis=2,
        )
        Image.fromarray(rgba, "RGBA").save(OUT / f"{name}.webp", quality=90, method=6)

        m = alpha[..., None]
        vis = base8.astype(np.float32) * (1 - m) + np.array([255, 70, 60]) * m
        Image.fromarray(np.clip(vis, 0, 255).astype(np.uint8)).save(QA / f"mask-{name}.png")

    print("done ->", OUT)


if __name__ == "__main__":
    main()
