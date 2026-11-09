import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { createClayEarthTexture, createClayNormalTexture } from '../utils/clayTextures';
import { buildStudioEnvMap } from '../utils/globeEnv';
import { collectFrameSamples, frameGlobeCamera } from '../utils/globeFraming';
import { getGlobeParams, pickGlobeTier } from '../utils/globeQuality';
import { storySound } from '../utils/sound';
import GlobeFallback from './GlobeFallback';
import type { PinItem } from '../types';

interface ClayGlobeProps {
  pins: PinItem[];
  /** 画布边长（px）。尺寸由外层根据视口算好后传入 */
  size: number;
  /** 已经被点亮的成果 id（= 球面小灯的 id），这些灯要发亮 */
  litPinIds: Set<string>;
  zoomed: boolean;
  activeTargetCoord: { lat: number; lon: number } | null;
  newlyDroppedPinId: string | null;
  onSelectPin: (pin: PinItem) => void;
  onHoverPin: (pin: PinItem | null, clientX: number, clientY: number) => void;
  /** 安放瞬间把新灯的屏幕坐标抛出来，让"啪！"打在灯上 */
  onPinAnchor?: (at: { x: number; y: number } | null) => void;
  onToggleZoom: () => void;
}

const R = 2;

/**
 * 小灯贴着球面站住时，灯座底面所在的半径。
 * 球体本身被捏过（起伏 ±0.03），这里留 0.001 的余量，既不悬空也不陷进泥里。
 */
const LAMP_AT = R + 0.012;

/** 灯座/灯杆的黏土色：老师一盏豆沙，学生按序轮换，和图钉时代的分色一致 */
const LAMP_BASE_COLORS = [0xd3a97a, 0x8fae5e, 0x8aa9a1];
const LAMP_BASE_TEACHER = 0xc07b70;
const LAMP_GLASS = 0xf6dfb4;
const LAMP_EMISSIVE = 0xffb565;

/** 一圈暖光的贴图（灯亮时挂在灯珠上，做出"光圈化开"的观感）。只做一次，反复用。 */
let glowTexture: THREE.Texture | null = null;
function getGlowTexture(): THREE.Texture {
  if (glowTexture) return glowTexture;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255, 226, 176, 0.95)');
  g.addColorStop(0.28, 'rgba(255, 198, 122, 0.5)');
  g.addColorStop(0.62, 'rgba(255, 176, 96, 0.16)');
  g.addColorStop(1, 'rgba(255, 170, 90, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  glowTexture = new THREE.CanvasTexture(canvas);
  glowTexture.colorSpace = THREE.SRGBColorSpace;
  return glowTexture;
}

/**
 * 底座下面的接触阴影贴图。
 *
 * 落座态有 CSS 的 ::after 兜着，但放大态画布浮在页面中央、外面没有任何承托，
 * 底座会显得悬空。这张横椭圆假 AO 把球"按"住。
 * ctx.scale 把圆压扁，匹配 4.75° 俯视下圆盘的投影椭圆率。
 */
let contactShadowTexture: THREE.Texture | null = null;
function getContactShadowTexture(): THREE.Texture {
  if (contactShadowTexture) return contactShadowTexture;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.translate(size / 2, size / 2);
  ctx.scale(1, 0.42);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, size / 2);
  g.addColorStop(0, 'rgba(88, 62, 38, 0.85)');
  g.addColorStop(0.45, 'rgba(88, 62, 38, 0.42)');
  g.addColorStop(0.7, 'rgba(88, 62, 38, 0.12)');
  g.addColorStop(1, 'rgba(88, 62, 38, 0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
  ctx.fill();
  contactShadowTexture = new THREE.CanvasTexture(canvas);
  contactShadowTexture.colorSpace = THREE.SRGBColorSpace;
  return contactShadowTexture;
}

/** 一盏灯的动画状态：p = 亮起进度 0→1，flash = 刚被点亮时那一下过曝 */
interface LampHandle {
  bulbMat: THREE.MeshStandardMaterial;
  haloMat: THREE.SpriteMaterial;
  halo: THREE.Sprite;
  phase: number;
  lit: boolean;
  p: number;
  flash: number;
}

/** 建灯时先把亮度定格在初始状态（该亮的已经亮着），别从黑里淡入一遍 */
function paintInitialLamp(lamp: LampHandle) {
  lamp.bulbMat.emissiveIntensity = 0.04 + lamp.p * 1.32;
  lamp.haloMat.opacity = lamp.p * 0.62;
  const s = 0.2 + lamp.p * 0.2;
  lamp.halo.scale.set(s, s, 1);
}

/** 经纬度 → 球面坐标 */
function latLonToVector3(lat: number, lon: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

/** 俯仰角：把北半球抬进画面中心一带（看起来像"从赤道略高处看地球"），但绝不翻滚球体 */
const TILT = (20 * Math.PI) / 180;

/**
 * 让某个经纬度正对镜头，且「北始终朝上、东始终朝右」。
 *
 * 不能用 setFromUnitVectors：它会走最短弧，球会沿着视线轴任意翻滚，
 * 于是北京可能被转到安吉的右下方——方位看起来全错。
 * 这里拆成两步：先绕 Y 轴转到目标经度，再绕 X 轴抬头 TILT，
 * 只有偏航和俯仰、没有翻滚，所以所有图钉的相对方位与真实地理一致。
 */
function orientTo(lat: number, lon: number): THREE.Quaternion {
  const yaw = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 1, 0),
    (-(90 + lon) * Math.PI) / 180
  );
  const pitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), TILT);
  return pitch.multiply(yaw);
}

export default function ClayGlobe({
  pins,
  size,
  litPinIds,
  zoomed,
  activeTargetCoord,
  newlyDroppedPinId,
  onSelectPin,
  onHoverPin,
  onPinAnchor,
  onToggleZoom,
}: ClayGlobeProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const globeRef = useRef<THREE.Group | null>(null);
  const pinsRef = useRef<THREE.Group | null>(null);
  const ripplesRef = useRef<THREE.Group | null>(null);
  /** PMREM 产出的环境贴图，销毁时要连 renderTarget 一起 dispose */
  const envTargetRef = useRef<THREE.WebGLRenderTarget | null>(null);
  const envMapRef = useRef<THREE.Texture | null>(null);
  /** 底座下的假 AO，落座/放大两档透明度 */
  const aoRef = useRef<THREE.Sprite | null>(null);
  /** 供渲染循环里的运行时降级用（闭包里的 size 会过期） */
  const sizeRef = useRef(size);
  sizeRef.current = size;

  /** id → 灯的动画句柄。重建灯塔时同步重建，点亮时只改材质，不重建场景 */
  const lampsRef = useRef<Map<string, LampHandle>>(new Map());
  /**
   * 建灯时要读"当前亮没亮"。用 ref 而不是把 litPinIds 塞进建灯 effect 的依赖：
   * 否则每点亮一次就把所有灯拆了重建，刚落下的那盏的弹跳动画会被打断。
   */
  const litRef = useRef(litPinIds);
  litRef.current = litPinIds;

  // 回调放进 ref，避免因为函数身份变化重建整个 WebGL 场景
  const onSelectRef = useRef(onSelectPin);
  const onHoverRef = useRef(onHoverPin);
  const onAnchorRef = useRef(onPinAnchor);
  const onZoomRef = useRef(onToggleZoom);
  useEffect(() => {
    onSelectRef.current = onSelectPin;
    onHoverRef.current = onHoverPin;
    onAnchorRef.current = onPinAnchor;
    onZoomRef.current = onToggleZoom;
  }, [onSelectPin, onHoverPin, onPinAnchor, onToggleZoom]);

  const zoomedRef = useRef(zoomed);
  useEffect(() => {
    zoomedRef.current = zoomed;
    // 放大态没有桌面兜着，接触阴影要更实一点才不会显得球浮着
    const ao = aoRef.current;
    if (ao) (ao.material as THREE.SpriteMaterial).opacity = zoomed ? 0.42 : 0.18;
  }, [zoomed]);

  const targetQuatRef = useRef<THREE.Quaternion | null>(null);
  const targetingRef = useRef(false);
  const dropRef = useRef<{ start: number; pin: THREE.Group; ripple: THREE.Mesh | null } | null>(null);

  /* ---------------- 场景初始化（只做一次） ---------------- */
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const side = size || 600;
    const params = getGlobeParams(pickGlobeTier());

    const scene = new THREE.Scene();
    // 相机位置先不设：等球、铜架、底座都建好之后由 frameGlobeCamera 反解
    const camera = new THREE.PerspectiveCamera(38, 1, 2, 24);
    cameraRef.current = camera;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: params.antialias, alpha: true });
    } catch {
      // 这台机器没有 WebGL：退回 2D 黏土球，绝不能让整页白掉
      setFailed(true);
      return;
    }
    renderer.setPixelRatio(params.pixelRatio);
    renderer.setSize(side, side);
    renderer.setClearAlpha(0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    /*
     * Neutral（Khronos PBR Neutral）而不是 ACES：ACES 会把莫兰迪泥色一律抬亮去饱和，
     * 而 Neutral 在 0.8 以下几乎线性、不动中间调，只在亮部做保色相的压缩 ——
     * 正好治"加了环境反射之后黄铜高光削平"，又保住了水彩的灰调。
     */
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1.0;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 黄铜的环境反射。只挂金属材质，不设 scene.environment —— 球是纸面，不该泛油光
    const envTarget = buildStudioEnvMap(renderer, params.envSize[0], params.envSize[1]);
    envTargetRef.current = envTarget;
    envMapRef.current = envTarget.texture;

    /*
     * 影棚光重配：环境光从 1.34 压到 0.72，主光提到 2.05。
     * 总光量几乎不变，但 ambient 占比从 30% 降到 16% ——
     * 受光面亮度保持，暗面沉下去，球才有体积，而不是一块被无影灯照平的贴图。
     */
    scene.add(new THREE.AmbientLight(0xfffbf2, 0.72));

    const key = new THREE.DirectionalLight(0xfff4e2, 2.05);
    key.position.set(4.6, 6.2, 5.4);
    scene.add(key);

    const fill = new THREE.DirectionalLight(0xd9edf3, 0.62);
    fill.position.set(-5.2, -1.4, -3.2);
    scene.add(fill);

    if (params.lights >= 5) {
      // 背后轮廓光：从纯白改暖白，避免后方一圈死白
      const rim = new THREE.DirectionalLight(0xfff2dc, 0.85);
      rim.position.set(-2.6, 3.4, -5.2);
      scene.add(rim);

      // 右下的暖反弹光，托住球的暗侧
      const bounce = new THREE.DirectionalLight(0xffe9d2, 0.3);
      bounce.position.set(4.6, -3.2, 2.6);
      scene.add(bounce);
    }

    const globe = new THREE.Group();
    // 初始把中国区域转向镜头（东经 105°，北纬 35°），北朝上、东朝右
    globe.quaternion.copy(orientTo(35, 105));
    scene.add(globe);
    globeRef.current = globe;

    // —— 球体：水彩画在光滑纸面上，保持标准球体，不再手捏起伏 ——
    const geom = new THREE.SphereGeometry(R, params.sphere[0], params.sphere[1]);
    geom.computeVertexNormals();

    const albedo = createClayEarthTexture(
      params.earthTexture[0],
      params.earthTexture[1],
      Math.min(params.anisotropy, renderer.capabilities.getMaxAnisotropy())
    );
    const normal = createClayNormalTexture(params.normalTexture);

    const mat = new THREE.MeshStandardMaterial({
      map: albedo,
      normalMap: normal,
      normalScale: new THREE.Vector2(0.28, 0.28),
      roughness: 0.52,
      metalness: 0,
      // 一点点环境反射：只要球面有"这盏灯在不在屋里"的暗示，不能照出镜面
      envMap: envMapRef.current,
      envMapIntensity: 0.22,
    });

    /*
     * 菲涅尔边缘光：水彩球在浅色背景里容易糊进去，靠一圈极窄的暖边把轮廓立起来。
     * 不走「背后加一层加色球」——那样会盖住铜弧，也很容易做成发光球。
     * 直接往自发光里加，零额外 draw call。
     * 注入点已核对 three 0.187 的 meshphysical_frag：vViewPosition 有声明，
     * normal 由 <normal_fragment_begin> 提供，<emissivemap_fragment> 正好在其后。
     */
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uRimColor = { value: new THREE.Color(1.0, 0.94, 0.83) };
      shader.uniforms.uRimStrength = { value: params.rimStrength };
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          '#include <common>\nuniform vec3 uRimColor;\nuniform float uRimStrength;'
        )
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
          // 用几何法线（vNormal）而不是被法线贴图扰动过的 normal：
          // 后者在轮廓处高频抖动，会把边缘光打成一圈断续的白点
          float rimF = 1.0 - clamp(dot(normalize(vViewPosition), normalize(vNormal)), 0.0, 1.0);
          totalEmissiveRadiance += uRimColor * pow(rimF, 3.5) * uRimStrength;`
        );
    };
    mat.customProgramCacheKey = () => 'globe-rim-v1';

    const sphere = new THREE.Mesh(geom, mat);
    // 小灯向外凸出约 0.1，取景时把球放大 5% 兜住它们，不必真的遍历每一盏灯
    sphere.userData.frameInflate = 1.05;
    globe.add(sphere);

    // —— 黄铜支架：一道半圆弧 + 立柱 + 圆盘底座（属于「桌子」，不能挂进会旋转的 globe 组） ——
    const baseGroup = new THREE.Group();
    scene.add(baseGroup);

    const envMap = envMapRef.current;
    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xe6b47c,
      // 比第一版更亮一档：0.34 的粗糙度把柔光箱糊成一整片，看不出"铜在反光"
      roughness: 0.29,
      metalness: 0.62,
      envMap,
      envMapIntensity: 1.35,
    });
    const brassDeep = new THREE.MeshStandardMaterial({
      color: 0xc58a4e,
      roughness: 0.38,
      metalness: 0.58,
      envMap,
      envMapIntensity: 1.05,
    });

    // 弧：绕球一圈多一点，开口朝左下，像参考插画里那道抱住球的金色带
    const arcGeom = new THREE.TorusGeometry(
      R + 0.24,
      0.095,
      params.arcRadialSegments,
      params.arcTubularSegments,
      Math.PI * 1.02
    );
    const arc = new THREE.Mesh(arcGeom, brassMat);
    arc.rotation.z = -Math.PI * 0.5;
    baseGroup.add(arc);

    /*
     * 弧的两端封球。
     * TorusGeometry 是开口管，端面是个空心圆 —— 落座时看不出来，
     * 一放大就能看见铜管被"剪断"的切口，非常掉价。
     * 用两颗同样粗细的小铜球把端头收圆，读起来像故意做的球形端饰。
     */
    const arcCaps = new THREE.Group();
    arcCaps.rotation.z = -Math.PI * 0.5;
    for (const theta of [0, Math.PI * 1.02]) {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.095, 20, 14), brassMat);
      cap.position.set(Math.cos(theta) * (R + 0.24), Math.sin(theta) * (R + 0.24), 0);
      arcCaps.add(cap);
    }
    baseGroup.add(arcCaps);

    // 弧的落点处一个小铜箍，把弧和立柱接上
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.12, 16), brassDeep);
    collar.position.y = -(R + 0.02);
    baseGroup.add(collar);

    // 立柱：从球的底部往下，接住底座。比原来粗一档，
    // 细柱子顶着一颗大球看着就站不稳
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.12, 0.7, 24), brassMat);
    stem.position.y = -(R + 0.25);
    baseGroup.add(stem);

    /*
     * 圆盘底座：两层，上小下大，像被车出来的铜座。
     * 尺寸是照着「压得住上面那颗球」定的：直径 1.9（球径的 0.48 倍）、
     * 两层合计 0.4 高。原来直径 1.4、高 0.24，投影到屏幕上只有 90×20 像素，
     * 顶着 220 像素的球，怎么调都像被一根杆子举着。
     */
    const discTop = new THREE.Mesh(
      new THREE.CylinderGeometry(0.66, 0.78, 0.18, params.discSegments),
      brassMat
    );
    discTop.position.y = -(R + 0.58);
    baseGroup.add(discTop);

    const discBottom = new THREE.Mesh(
      new THREE.CylinderGeometry(0.87, 0.95, 0.22, params.discSegments),
      brassDeep
    );
    discBottom.position.y = -(R + 0.78);
    baseGroup.add(discBottom);

    const pinsGroup = new THREE.Group();
    // 小灯和光晕向外凸、又带加法光晕，混进取景采样会把画面压小
    pinsGroup.userData.noFrame = true;
    globe.add(pinsGroup);
    pinsRef.current = pinsGroup;

    const ripples = new THREE.Group();
    ripples.userData.noFrame = true;
    globe.add(ripples);
    ripplesRef.current = ripples;

    // 底座下的接触阴影：落座态有 CSS 兜着，放大态画布外没有承托，靠它把球"按"住
    const ao = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: getContactShadowTexture(),
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
        toneMapped: false,
      })
    );
    ao.position.set(0, -2.86, 0.55);
    ao.scale.set(2.6, 0.62, 1);
    ao.userData.noFrame = true;
    scene.add(ao);
    aoRef.current = ao;

    /*
     * 取景：球、铜弧、立柱、底座全部建好之后，用真实顶点反解相机。
     * 之前手解方程只兜了球顶和底座，漏了铜弧（外缘最高 2.335），
     * 画布上边缘正好切在弧顶上 —— 那就是"地球仪顶部没了"。
     */
    const samples = collectFrameSamples(scene);
    const frame = frameGlobeCamera(camera, samples);

    if (import.meta.env.DEV) {
      // 球面在画面里的直径（解析解）：sinθ = R/d
      const sphereDia =
        (2 * (R / Math.sqrt(frame.d * frame.d - R * R))) /
        Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5));
      const report = { ...frame, sphereDia };
      (window as unknown as { __globeFrame?: typeof report }).__globeFrame = report;
      console.info('[globe-frame]', report);
      console.assert(frame.top <= 1 && frame.bottom >= -1, '取景越界', report);
      console.assert(frame.d > 7.5 && frame.d < 9.5, '相机距离异常，采样集可能混入远处物体', frame.d);
    }

    /* ---------------- 交互 ---------------- */
    const canvas = renderer.domElement;
    let dragging = false;
    let moved = 0;
    let prev = { x: 0, y: 0 };
    let hovering: PinItem | null = null;

    const toNdc = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      return new THREE.Vector2(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        -((e.clientY - r.top) / r.height) * 2 + 1
      );
    };

    const pickPin = (e: PointerEvent): PinItem | null => {
      const ray = new THREE.Raycaster();
      ray.setFromCamera(toNdc(e), camera);
      const hits = ray.intersectObjects(pinsGroup.children, true);
      if (!hits.length) return null;
      let obj: THREE.Object3D | null = hits[0].object;
      while (obj && !obj.userData.pin && obj !== pinsGroup) obj = obj.parent;
      return (obj?.userData.pin as PinItem) ?? null;
    };

    const onPointerDown = (e: PointerEvent) => {
      dragging = true;
      moved = 0;
      prev = { x: e.clientX, y: e.clientY };
      targetingRef.current = false;
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        /* 合成事件没有真实 pointerId，捕获失败不影响拖动 */
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (dragging && globeRef.current) {
        const dx = e.clientX - prev.x;
        const dy = e.clientY - prev.y;
        moved += Math.abs(dx) + Math.abs(dy);
        const qy = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), dx * 0.0055);
        const qx = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), dy * 0.0055);
        globeRef.current.quaternion.premultiply(qy).multiply(qx);
        prev = { x: e.clientX, y: e.clientY };
        return;
      }

      const pin = pickPin(e);
      if (pin !== hovering) {
        hovering = pin;
        canvas.style.cursor = pin ? 'pointer' : 'grab';
      }
      onHoverRef.current(pin, e.clientX, e.clientY);
    };

    const onPointerUp = (e: PointerEvent) => {
      const wasDragging = dragging;
      dragging = false;
      try {
        if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
      } catch {
        /* 同上 */
      }
      if (!wasDragging || moved > 8) return;

      const pin = pickPin(e);
      if (pin) {
        storySound.playPinDrop();
        onSelectRef.current(pin);
        return;
      }
      // 只有还在书桌上时才允许点开；放大后靠显式的关闭按钮退出，避免误触
      if (!zoomedRef.current) {
        storySound.playPaperTurn();
        onZoomRef.current();
      }
    };

    const onPointerLeave = () => {
      onHoverRef.current(null, 0, 0);
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointerleave', onPointerLeave);

    /* ---------------- 渲染循环 ---------------- */
    const clock = new THREE.Clock();
    let acc = 0;
    const STEP = 1 / 14; // 定格动画的抽帧节奏
    let raf = 0;

    /*
     * 运行时降级：只降不升，避免在帧率边缘反复抖动。
     * 前 30 帧跳过——着色器编译与贴图上传会造成假掉帧。
     */
    let frameCount = 0;
    let accMs = 0;
    let accFrames = 0;
    let degraded = 0;
    let fpsCap = params.targetFps;
    let lastRenderAt = 0;

    /**
     * 把动画状态刷到材质上。
     * 熄灭：只剩玻璃的一点温色；点亮：灯珠过曝成暖白，外圈光晕化开。
     * 亮着的时候留一点呼吸，灯才像"活着"，不像贴了两层发光贴图。
     */
    const paintLamp = (lamp: LampHandle, nowSec: number) => {
      const breath =
        0.93 +
        Math.sin(nowSec * 1.7 + lamp.phase) * 0.05 +
        Math.sin(nowSec * 4.3 + lamp.phase * 2.1) * 0.025;
      const flash = lamp.flash * 1.6;
      lamp.bulbMat.emissiveIntensity = 0.04 + lamp.p * 1.32 * breath + flash * 0.8;
      lamp.haloMat.opacity = Math.min(1, lamp.p * 0.62 * breath + flash * 0.35);
      const s = 0.2 + lamp.p * 0.2 + flash * 0.12;
      lamp.halo.scale.set(s, s, 1);
    };

    const tick = () => {
      const dt = clock.getDelta();
      const now = performance.now();
      acc += dt;

      // 灯：被点亮的那盏从暗到亮，其余保持熄灭
      const nowSec = now / 1000;
      lampsRef.current.forEach((lamp) => {
        const target = lamp.lit ? 1 : 0;
        if (lamp.flash > 0) lamp.flash = Math.max(0, lamp.flash - dt * 2.2);
        const moving = Math.abs(lamp.p - target) > 0.001;
        if (moving) {
          lamp.p += (target - lamp.p) * Math.min(1, dt * 5.5);
          if (Math.abs(lamp.p - target) <= 0.001) lamp.p = target;
        }
        if (moving || lamp.flash > 0 || lamp.p > 0) paintLamp(lamp, nowSec);
      });

      if (targetingRef.current && targetQuatRef.current && globeRef.current) {
        globeRef.current.quaternion.slerp(targetQuatRef.current, Math.min(1, dt * 4.2));
        if (globeRef.current.quaternion.angleTo(targetQuatRef.current) < 0.008) {
          targetingRef.current = false;
        }
      } else if (!dragging && globeRef.current && acc >= STEP) {
        acc = 0;
        globeRef.current.quaternion.premultiply(
          new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.0026)
        );
      }

      // 新安放的灯：落下 → 回弹 → 稳住
      if (dropRef.current) {
        const { start, pin, ripple } = dropRef.current;
        const t = (now - start) / 1000;
        if (t < 0.95) {
          const bounce = Math.sin(t * 17) * Math.exp(-t * 5.2) * 0.42;
          const lift = t < 0.2 ? (0.2 - t) * 2.6 : 0;
          const dir = pin.position.clone().normalize();
          pin.position.copy(dir.multiplyScalar(LAMP_AT + Math.max(0, bounce) + lift));
        } else {
          pin.position.copy(pin.position.clone().normalize().multiplyScalar(LAMP_AT));
          dropRef.current = null;
        }

        // 把灯投影到屏幕上，"啪！"就能正正打在小灯上
        if (onAnchorRef.current) {
          const world = new THREE.Vector3();
          pin.getWorldPosition(world);
          world.project(camera);
          const box = canvas.getBoundingClientRect();
          onAnchorRef.current({
            x: box.left + (world.x * 0.5 + 0.5) * box.width,
            y: box.top + (-world.y * 0.5 + 0.5) * box.height,
          });
        }
        if (ripple) {
          if (t < 1.5) {
            const s = 1 + t * 3.1;
            ripple.scale.set(s, s, 1);
            (ripple.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.72 - t * 0.48);
          } else {
            ripple.visible = false;
          }
        }
      }

      // 低配档限帧：状态照常更新，只省掉渲染
      const minInterval = 1000 / fpsCap;
      if (now - lastRenderAt < minInterval - 1.5) {
        raf = requestAnimationFrame(tick);
        return;
      }
      lastRenderAt = now;

      renderer.render(scene, camera);

      // 帧时长统计：每 60 帧结算一次，只降不升
      frameCount++;
      if (frameCount > 30) {
        accMs += Math.min(dt * 1000, 60); // 切标签页回来的巨大 delta 不参与
        accFrames++;
        if (accFrames >= 60) {
          const avg = accMs / accFrames;
          accMs = 0;
          accFrames = 0;
          if (degraded === 0 && avg > 20) {
            degraded = 1;
            renderer.setPixelRatio(Math.max(1, Math.min(renderer.getPixelRatio(), 1.5)));
            renderer.setSize(sizeRef.current, sizeRef.current);
          } else if (degraded === 1 && avg > 26 && fpsCap > 30) {
            degraded = 2;
            fpsCap = 30;
          }
        }
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      /*
       * 通用销毁：以前只 dispose 了 7 个对象，铜箍、立柱、两个圆盘的几何
       * 每次热更新都漏一批。这里整棵树走一遍。
       */
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        mesh.geometry?.dispose?.();
        const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(material)) material.forEach((m) => m.dispose());
        else material?.dispose?.();
      });
      albedo.dispose();
      normal.dispose();
      envTarget.dispose();
      renderer.dispose();
      container.innerHTML = '';
    };
    // size 变化只调整绘制缓冲区，不重建场景
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------- 尺寸变化 ---------------- */
  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer || !size) return;
    renderer.setSize(size, size);
  }, [size]);

  /* ---------------- 视角对齐到某个坐标 ---------------- */
  useEffect(() => {
    if (!activeTargetCoord || !globeRef.current) return;
    const { lat, lon } = activeTargetCoord;
    // 目标已经在正面：不转球。落钉就该落在它真实的位置上（北京在安吉北边），
    // 一转就把所有钉子挤到圆心，看起来"位置从来没变过"。
    const world = latLonToVector3(lat, lon, 1).applyQuaternion(globeRef.current.quaternion);
    if (world.z > 0.5) return;
    // 只有落在背面（比如南北美洲）才转过去，且只做偏航，不翻滚
    targetQuatRef.current = orientTo(lat, lon);
    targetingRef.current = true;
  }, [activeTargetCoord]);

  /* ---------------- 球面上的小灯 ---------------- */
  useEffect(() => {
    const group = pinsRef.current;
    const ripples = ripplesRef.current;
    if (!group || !ripples) return;

    // 清空旧灯（连同几何与材质，别让每点亮一次就漏一批）
    while (group.children.length) {
      const child = group.children[0];
      child.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const material = (m as THREE.Mesh).material;
        if (Array.isArray(material)) material.forEach((x) => x.dispose());
        else material?.dispose();
      });
      group.remove(child);
    }
    lampsRef.current.clear();

    while (ripples.children.length) {
      const child = ripples.children[0] as THREE.Mesh;
      child.geometry?.dispose();
      (child.material as THREE.Material | undefined)?.dispose?.();
      ripples.remove(child);
    }

    const glassTexture = getGlowTexture();

    pins.forEach((pin, i) => {
      const isNew = pin.id === newlyDroppedPinId;
      const lit = litRef.current.has(pin.id);

      // 灯座贴在球面上，灯的 +z 就是球面法线，所以各部件沿 z 依次排上去
      const at = latLonToVector3(pin.lat, pin.lon, LAMP_AT);
      const node = new THREE.Group();
      node.position.copy(at);
      node.lookAt(at.clone().multiplyScalar(2));
      node.userData.pin = pin;

      const baseColor =
        pin.role === 'TEACHER' ? LAMP_BASE_TEACHER : LAMP_BASE_COLORS[i % LAMP_BASE_COLORS.length];
      const baseMat = new THREE.MeshStandardMaterial({
        color: baseColor,
        roughness: 0.82,
        metalness: 0.04,
      });
      // 灯圈用赭石金，跟泥做的灯托拉开材质，小灯才有一圈"金属灯口"的高光
      const rimMat = new THREE.MeshStandardMaterial({
        color: 0xd0a25e,
        roughness: 0.3,
        metalness: 0.55,
        envMap: envMapRef.current,
        envMapIntensity: 1.0,
      });

      /*
       * 小灯的造型：一圈黄铜灯圈 + 嵌在圈里的一颗玻璃灯珠。
       *
       * 这个尺寸下试了三版：细杆顶灯珠（杆沿球面法线，正对镜头时整根杆被灯珠
       * 挡住，只剩一颗悬空的珠子）、灯罩（糊成一个小土丘）、灯珠扣半球。
       * 最后落在这版：所有部件都贴在球面的切平面里，任何角度看都是
       * "一圈铜 + 一颗珠"，点亮时整颗珠透出暖光 —— 十来个像素里最稳的读法。
       */
      // 灯托：一道角色色的泥边，老师豆沙 / 学生按序轮换，和图钉时代的分色一脉相承
      const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.066, 0.014, 28), baseMat);
      seat.rotation.x = Math.PI / 2;
      seat.position.z = 0.007;
      seat.userData.pin = pin;
      node.add(seat);

      // 灯圈：黄铜，压在灯托上，像一枚小小的灯口
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.0095, 12, 32), rimMat);
      ring.position.z = 0.013;
      ring.userData.pin = pin;
      node.add(ring);

      // 灯珠：半球玻璃罩，扣在圈里，球面就是灯口
      const bulbMat = new THREE.MeshStandardMaterial({
        color: LAMP_GLASS,
        roughness: 0.36,
        metalness: 0,
        emissive: LAMP_EMISSIVE,
        emissiveIntensity: 0.04,
      });
      const bulbGeo = new THREE.SphereGeometry(0.05, 28, 18, 0, Math.PI * 2, 0, Math.PI / 2);
      bulbGeo.rotateX(Math.PI / 2); // 上半球朝 +z（球面法线）
      bulbGeo.scale(1, 1, 1.22); // 灯珠凸出来一点，才有"一颗灯"的体积
      const bulb = new THREE.Mesh(bulbGeo, bulbMat);
      bulb.position.z = 0.006;
      bulb.userData.pin = pin;
      node.add(bulb);

      // 光晕：始终面向相机的加法贴图。熄灭时完全透明，亮起点开一圈暖光
      const haloMat = new THREE.SpriteMaterial({
        map: glassTexture,
        color: 0xffcb8c,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const halo = new THREE.Sprite(haloMat);
      halo.position.z = 0.055;
      halo.scale.set(0.2, 0.2, 1);
      halo.userData.pin = pin;
      node.add(halo);

      // 拾取用的透明球：灯比原来的图钉小，给它一层看不见的"手感范围"
      const hit = new THREE.Mesh(
        new THREE.SphereGeometry(0.075, 10, 8),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
      );
      hit.position.z = 0.03;
      hit.userData.pin = pin;
      node.add(hit);

      group.add(node);

      const handle: LampHandle = {
        bulbMat,
        haloMat,
        halo,
        phase: i * 1.7,
        lit,
        p: lit ? 1 : 0,
        flash: 0,
      };
      lampsRef.current.set(pin.id, handle);
      paintInitialLamp(handle);

      if (isNew) {
        const rippleRing = new THREE.Mesh(
          new THREE.RingGeometry(0.075, 0.17, 32),
          new THREE.MeshBasicMaterial({
            color: 0xffe3a8,
            transparent: true,
            opacity: 0.72,
            side: THREE.DoubleSide,
          })
        );
        rippleRing.position.copy(latLonToVector3(pin.lat, pin.lon, R + 0.02));
        rippleRing.lookAt(at.clone().multiplyScalar(2));
        ripples.add(rippleRing);
        dropRef.current = { start: performance.now(), pin: node, ripple: rippleRing };
      }
    });
  }, [pins, newlyDroppedPinId]);

  /* ---------------- 点亮 / 熄灭：只改状态，动画交给渲染循环 ---------------- */
  useEffect(() => {
    lampsRef.current.forEach((lamp, id) => {
      const on = litPinIds.has(id);
      if (on === lamp.lit) return;
      lamp.lit = on;
      // 刚被点亮：给一下过曝，灯"啪"地亮起来才有反应
      if (on) lamp.flash = 1;
    });
  }, [litPinIds]);

  return failed ? (
    <GlobeFallback
      pins={pins}
      size={size}
      zoomed={zoomed}
      litPinIds={litPinIds}
      onToggleZoom={onToggleZoom}
    />
  ) : (
    <div ref={mountRef} style={{ width: size, height: size }} />
  );
}
