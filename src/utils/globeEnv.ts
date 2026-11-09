import * as THREE from 'three';

/**
 * 程序化的「影棚」环境贴图。
 *
 * 之前黄铜只靠 4 盏平行光，metalness 0.28 却没有任何环境可反射，
 * 高光只剩几个镜面点，读起来就是塑料。这里用一张 2:1 等距圆柱画布当环境：
 * 上亮下暗的竖直渐变给金属一条明暗过渡，三块柔光箱提供高光形状。
 * 再过 PMREM 预滤成按粗糙度分层的 mip，交给 brass 材质。
 *
 * 刻意不设 scene.environment：球是水彩纸面，挂环境反射会泛一层油光。
 */
export function createStudioEnvTexture(width = 1024, height = 512): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    // 天顶 → 地平 → 暗地。上亮下暗是关键：全白的环境会让金属失去明暗过渡
    const g = ctx.createLinearGradient(0, 0, 0, height);
    g.addColorStop(0, '#fff8ec');
    g.addColorStop(0.3, '#f6e8d4');
    g.addColorStop(0.48, '#e9d7be');
    g.addColorStop(0.6, '#c3a884');
    g.addColorStop(0.82, '#8d7355');
    g.addColorStop(1, '#5f4c3a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);

    // 柔光箱：椭圆 + 四段衰减。硬边圆会在金属上烙出一块死白的补丁
    const softbox = (
      cx: number,
      cy: number,
      rx: number,
      ry: number,
      rgb: string,
      alpha: number
    ) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(rx / ry, 1);
      const r = ctx.createRadialGradient(0, 0, 0, 0, 0, ry);
      r.addColorStop(0, `rgba(${rgb},${alpha})`);
      r.addColorStop(0.45, `rgba(${rgb},${alpha * 0.62})`);
      r.addColorStop(0.78, `rgba(${rgb},${alpha * 0.16})`);
      r.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = r;
      ctx.beginPath();
      ctx.arc(0, 0, ry, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    // 右上主光：铜弧外侧那道最亮的高光
    softbox(width * 0.63, height * 0.2, width * 0.19, height * 0.26, '255,255,255', 1);
    // 左侧冷补：让铜的暗面偏冷，和暖部形成对比，不然整体一片土黄
    softbox(width * 0.16, height * 0.34, width * 0.1, height * 0.15, '206,232,240', 0.55);
    // 右后暖反：给底座圆盘一圈回光
    softbox(width * 0.86, height * 0.46, width * 0.09, height * 0.1, '255,226,190', 0.35);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.mapping = THREE.EquirectangularReflectionMapping;
  return texture;
}

/**
 * 生成可直接挂到材质上的环境贴图。
 *
 * 返回 renderTarget：envMap 本体是它的 texture，销毁时要把整个 target 一起 dispose。
 * 中间那张等距圆柱画布烘进 GPU 之后立刻释放，不留 CPU 副本。
 */
export function buildStudioEnvMap(
  renderer: THREE.WebGLRenderer,
  width = 1024,
  height = 512
): THREE.WebGLRenderTarget {
  const source = createStudioEnvTexture(width, height);
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const target = pmrem.fromEquirectangular(source);
  pmrem.dispose();
  source.dispose();
  return target;
}
