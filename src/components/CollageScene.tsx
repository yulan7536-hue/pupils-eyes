import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { makePresetSticker, presetLabel } from '../utils/stickerAssets';
import {
  loadStickers,
  saveStickers,
  loadQuota,
  setQuota,
  bumpTask,
  hasUnclaimedReward,
  loadLibrary,
  addToLibrary,
  removeFromLibrary,
  type MySticker,
} from '../utils/stickerStore';
import { stylizeImage } from '../utils/stickerAI';
import { generate3D, waitModel3D, loadPendingTask, clearPendingTask } from '../utils/model3d';
import { saveModel, listModels, removeModel, getModel, type Model3DItem } from '../utils/modelStore';
import StickerDock from './StickerDock';
import StickerPreview from './StickerPreview';
import ModelPreview from './ModelPreview';
import AIProcessModal from './AIProcessModal';
import TaskCenter from './TaskCenter';
import Fireflies from './Fireflies';
import type { Sticker } from '../types';

/**
 * 拼贴模式：一张钢笔淡彩童话小镇插画作为背景，贴纸浮在插画上。
 *
 * 正交相机正视画面，贴纸用 THREE.Sprite 落在 x-y 平面上（billboard 永远正面），
 * 左键选中 / 拖动贴纸；选中后底部浮出操作条（缩放 / 旋转 / 镜像 / 复制 /
 * 置顶置底 / 删除）。背景图片按 cover 铺满视野。
 */
interface CollageSceneProps {
  onClose: () => void;
}

/**
 * 背景插画（public/collage-town.jpg，1200x896）。
 * 直接用原图而不是左右镜像扩图版：扩图两侧是虚化延伸，用户明确要求「不要边缘模糊」。
 * 代价是极端宽高比下会裁掉一些上下/左右内容，但整幅画面全程清晰。
 */
const BG_URL = '/collage-town.jpg';
const BG_ASPECT = 1200 / 896;
/** 正交视野的世界高度（宽度随窗口宽高比变化） */
const VIEW_H = 10;
/** 最小缩放倍数（背景按此倍数预留，保证缩小到最小时仍铺满） */
const MIN_ZOOM = 0.8;
/** 最大缩放倍数 */
const MAX_ZOOM = 2.4;
/**
 * 3D 摆件脚下的接地阴影。
 * 用「正对相机的平面」而不是水平面/精灵：正交相机是正面视角，
 * 水平面会被压成一条线，Sprite 在当前透明排序下也不可靠。
 */
function makeGroundShadow(): THREE.Mesh {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(62, 48, 38, 0.5)');
  g.addColorStop(0.45, 'rgba(62, 48, 38, 0.22)');
  g.addColorStop(1, 'rgba(62, 48, 38, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      depthTest: false,
    })
  );
  // 压扁成椭圆、比模型略宽，才能在脚下露出来
  mesh.scale.set(3.6, 1.2, 1);
  mesh.position.set(0, 0.1, 0);
  mesh.renderOrder = 2;
  return mesh;
}

/** 贴纸 Sprite 的基础尺寸（世界单位） */
const STICKER_BASE = 1.9;

/** 把 3D 生成的接口错误翻译成一句人话 */
function describe3DFailure(msg: string): string {
  if (msg.includes('AccountOverdue')) return 'AI 账户欠费，3D 生成暂不可用';
  if (msg.includes('401') || msg.includes('Unauthorized')) return 'AI Key 无效，3D 生成暂不可用';
  if (msg.includes('Failed to fetch')) return '网络不通，3D 生成失败，稍后再试';
  if (msg.includes('超时')) return '3D 生成超时了，可以再试一次';
  if (msg.includes('InvalidParameter')) return '这张图不符合要求（需 jpg/png，小于 4096px）';
  return `3D 生成失败：${msg.slice(0, 50)}`;
}

export default function CollageScene({ onClose }: CollageSceneProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  const [stickers, setStickers] = useState<Sticker[]>(() => loadStickers());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dockOpen, setDockOpen] = useState(false);
  const [quota, setQuotaState] = useState<number>(() => loadQuota());
  const [aiProgress, setAiProgress] = useState<{ pct: number; stage: string } | null>(null);
  const [taskOpen, setTaskOpen] = useState(false);
  const [taskDot, setTaskDot] = useState<boolean>(() => hasUnclaimedReward());
  /** 「我的贴纸」素材库 */
  const [library, setLibrary] = useState<MySticker[]>(() => loadLibrary());
  /** 已生成的 3D 摆件（IndexedDB 元信息） */
  const [models, setModels] = useState<Model3DItem[]>([]);
  /** AI 抠图结果，非空时显示预览确认框 */
  const [preview, setPreview] = useState<string | null>(null);
  /** 刚生成好待确认的 3D 模型（确认后才入背包并落地） */
  const [preview3d, setPreview3d] = useState<Model3DItem | null>(null);
  /** 轻提示（AI 降级原因等） */
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);

  const showToast = useCallback((text: string) => {
    setToast(text);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 4000);
  }, []);

  // Three.js 引用
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const stickerRootRef = useRef<THREE.Group | null>(null);
  /** 3D 摆件挂载点 */
  const modelRootRef = useRef<THREE.Group | null>(null);
  /** stickerId → 场景里的 3D Group */
  const modelMapRef = useRef<Map<string, THREE.Group>>(new Map());
  const [sceneReady, setSceneReady] = useState(false);
  const bgRef = useRef<THREE.Mesh | null>(null);
  const spriteMapRef = useRef<Map<string, THREE.Sprite>>(new Map());
  const textureCacheRef = useRef<Map<string, THREE.Texture>>(new Map());
  const dragRef = useRef<{ id: string; plane: THREE.Plane; raycaster: THREE.Raycaster } | null>(null);

  // 用 ref 镜像最新 state，避免事件回调里闭包过期
  const stickersRef = useRef(stickers);
  stickersRef.current = stickers;

  const getTexture = useCallback((src: string): THREE.Texture => {
    const cache = textureCacheRef.current;
    const hit = cache.get(src);
    if (hit) return hit;
    const tex = new THREE.TextureLoader().load(src);
    tex.colorSpace = THREE.SRGBColorSpace;
    cache.set(src, tex);
    return tex;
  }, []);

  /** 把贴纸数据同步成 Three.js Sprite（重建型，贴纸少所以开销可接受） */
  const rebuildStickers = useCallback(() => {
    const root = stickerRootRef.current;
    if (!root) return;
    spriteMapRef.current.forEach((sprite) => {
      sprite.material.map?.dispose();
      root.remove(sprite);
    });
    spriteMapRef.current.clear();

    stickersRef.current.forEach((stk) => {
      // 3D 摆件由 modelRoot 单独管理，这里只处理平面贴纸
      if (stk.kind === '3d') return;
      const tex = getTexture(stk.src);
      const mat = new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
        depthTest: false,
      });
      const sprite = new THREE.Sprite(mat);
      const s = STICKER_BASE * stk.scale;
      sprite.material.rotation = stk.rotation;
      // 按纹理宽高比等比缩放：最长边 = s，避免竖版/横版图被拉伸变形
      const img = tex.image as { width?: number; height?: number } | undefined;
      const iw = img?.width || 1;
      const ih = img?.height || 1;
      const ratio = iw / ih;
      const sw = ratio >= 1 ? s : s * ratio;
      const sh = ratio >= 1 ? s / ratio : s;
      sprite.scale.set(stk.flipX ? -sw : sw, sh, 1);
      // 贴纸在 x-y 平面上；y 为高度（图片坐标），z 固定略靠前于背景
      sprite.position.set(stk.x, stk.y, 0.1 + stk.layer * 0.001);
      sprite.renderOrder = 10 + stk.layer;
      sprite.userData.stickerId = stk.id;
      root.add(sprite);
      spriteMapRef.current.set(stk.id, sprite);
    });
  }, [getTexture]);

  // —— 3D 摆件同步：加载新增的、移除删除的、同步位置/旋转/缩放 ——
  useEffect(() => {
    const root = modelRootRef.current;
    if (!root || !sceneReady) return;

    const want = stickers.filter((s) => s.kind === '3d' && s.modelId);
    const wantIds = new Set(want.map((s) => s.id));

    // 清掉已经不在列表里的
    for (const [sid, group] of [...modelMapRef.current]) {
      if (wantIds.has(sid)) continue;
      root.remove(group);
      group.traverse((o) => {
        const mesh = o as THREE.Mesh;
        mesh.geometry?.dispose();
        const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat?.dispose();
      });
      modelMapRef.current.delete(sid);
    }

    want.forEach((stk) => {
      const existing = modelMapRef.current.get(stk.id);
      if (existing) {
        existing.position.set(stk.x, stk.y, stk.z);
        existing.rotation.y = stk.rotation;
        existing.scale.setScalar(stk.scale);
        return;
      }
      // 首次出现：从 IndexedDB 取 glb 并挂到场景
      void (async () => {
        const item = await getModel(stk.modelId!);
        if (!item) return;
        const url = URL.createObjectURL(item.glb);
        new GLTFLoader().load(
          url,
          (gltf) => {
            URL.revokeObjectURL(url);
            const obj = gltf.scene;
            // 先给展示倾角（正交相机正对画面，不给角度只能看到一个面），
            // 再按「旋转之后」的包围盒归一化落地 —— 顺序反了底面会歪、阴影会被压在模型里。
            obj.rotation.y = -0.34;
            obj.rotation.x = 0.1;
            obj.updateMatrixWorld(true);

            const box = new THREE.Box3().setFromObject(obj);
            const size = new THREE.Vector3();
            box.getSize(size);
            const maxDim = Math.max(size.x, size.y, size.z) || 1;
            obj.scale.setScalar(2.5 / maxDim);
            obj.updateMatrixWorld(true);

            const box2 = new THREE.Box3().setFromObject(obj);
            const center = new THREE.Vector3();
            box2.getCenter(center);
            obj.position.x -= center.x;
            obj.position.z -= center.z;
            obj.position.y -= box2.min.y; // 底面贴到 y=0

            const group = new THREE.Group();
            group.add(obj);
            group.add(makeGroundShadow());
            group.position.set(stk.x, stk.y, stk.z);
            group.rotation.y = stk.rotation;
            group.scale.setScalar(stk.scale);
            // 让 pick 能沿父链找回 stickerId
            group.traverse((o) => {
              o.userData.stickerId = stk.id;
            });
            root.add(group);
            modelMapRef.current.set(stk.id, group);
          },
          undefined,
          (err) => {
            URL.revokeObjectURL(url);
            console.warn('[collage] 3D 模型加载失败', err);
          }
        );
      })();
    });
  }, [stickers, sceneReady]);

  // —— 场景初始化 ——
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch (err) {
      console.warn('[collage] WebGL 不可用', err);
      setFailed(true);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor(0xf4efe2, 1);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 100);
    camera.position.set(0, 0, 10);
    camera.lookAt(0, 0, 0);

    // 滚轮缩放（正交相机 zoom），禁用旋转/平移（背景是 2D 插画）
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableRotate = false;
    controls.enablePan = false;
    controls.enableZoom = true;
    controls.zoomSpeed = 0.8;
    controls.minZoom = MIN_ZOOM;
    controls.maxZoom = MAX_ZOOM;
    controls.update();

    // 背景插画（cover 铺满视野）
    const bg = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: new THREE.TextureLoader().load(BG_URL) })
    );
    bg.position.set(0, 0, -1);
    bg.material.map!.colorSpace = THREE.SRGBColorSpace;
    scene.add(bg);

    const stickerRoot = new THREE.Group();
    scene.add(stickerRoot);

    // 3D 摆件是 PBR 材质，必须有光；背景（MeshBasic）和贴纸（SpriteMaterial）不受光影响。
    // 强度按 three 的物理光照单位给：太高会把 PBR 材质冲成死白，看不出明暗。
    scene.add(new THREE.AmbientLight(0xfff9ef, 0.85));
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.9);
    keyLight.position.set(4, 7, 9);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0xffe8cf, 0.7);
    fillLight.position.set(-6, 3, 5);
    scene.add(fillLight);

    const modelRoot = new THREE.Group();
    scene.add(modelRoot);

    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;
    stickerRootRef.current = stickerRoot;
    modelRootRef.current = modelRoot;
    bgRef.current = bg;
    setSceneReady(true);

    /** 按窗口尺寸调整正交相机视野 + 背景 cover 尺寸 */
    const layout = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (!w || !h) return;
      const aspect = w / h;
      camera.left = -(VIEW_H / 2) * aspect;
      camera.right = (VIEW_H / 2) * aspect;
      camera.top = VIEW_H / 2;
      camera.bottom = -(VIEW_H / 2);
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      // 背景按「最小缩放倍数下的可见范围」计算 cover：
      // 相机 zoom 越小时可见范围越大，按最小 zoom 预留尺寸，保证任何缩放都铺满
      const visibleH = VIEW_H / MIN_ZOOM;
      const visibleW = visibleH * aspect;
      let pw: number;
      let ph: number;
      if (aspect > BG_ASPECT) {
        pw = visibleW;
        ph = pw / BG_ASPECT;
      } else {
        ph = visibleH;
        pw = visibleH * BG_ASPECT;
      }
      bg.scale.set(pw, ph, 1);
    };
    layout();

    // —— 拾取与拖拽（x-y 平面） ——
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

    const pick = (e: PointerEvent): string | null => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);

      // 先查平面贴纸：多个重叠时按 renderOrder 取最上层
      const sprites = [...spriteMapRef.current.values()];
      if (sprites.length) {
        const hits = raycaster.intersectObjects(sprites, false);
        if (hits.length) {
          hits.sort((a, b) => b.object.renderOrder - a.object.renderOrder);
          return hits[0].object.userData.stickerId as string;
        }
      }

      // 再查 3D 摆件：命中的是子 mesh，要沿父链找回带 stickerId 的组
      const models = [...modelMapRef.current.values()];
      if (models.length) {
        const hits = raycaster.intersectObjects(models, true);
        if (hits.length) {
          let o: THREE.Object3D | null = hits[0].object;
          while (o) {
            const id = o.userData.stickerId as string | undefined;
            if (id) return id;
            o = o.parent;
          }
        }
      }
      return null;
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const id = pick(e);
      if (id) {
        setSelectedId(id);
        dragRef.current = { id, plane: dragPlane, raycaster };
        (renderer.domElement as HTMLCanvasElement).setPointerCapture(e.pointerId);
      } else {
        setSelectedId(null);
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      drag.raycaster.setFromCamera(pointer, camera);
      const hit = new THREE.Vector3();
      if (drag.raycaster.ray.intersectPlane(drag.plane, hit)) {
        const sprite = spriteMapRef.current.get(drag.id);
        if (sprite) {
          sprite.position.x = hit.x;
          sprite.position.y = hit.y;
          return;
        }
        const model = modelMapRef.current.get(drag.id);
        if (model) {
          model.position.x = hit.x;
          model.position.y = hit.y;
        }
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      dragRef.current = null;
      const sprite = spriteMapRef.current.get(drag.id);
      const model = modelMapRef.current.get(drag.id);
      const pos = sprite?.position ?? model?.position;
      if (pos) {
        setStickers((prev) => prev.map((s) => (s.id === drag.id ? { ...s, x: pos.x, y: pos.y } : s)));
      }
      try {
        (renderer.domElement as HTMLCanvasElement).releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    // —— 渲染循环 ——
    let animId = 0;
    const tick = () => {
      animId = requestAnimationFrame(tick);
      controls.update();
      renderer.render(scene, camera);
    };
    tick();

    window.addEventListener('resize', layout);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', layout);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      controls.dispose();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mat = (m as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else if (mat) mat.dispose();
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  // —— 贴纸数据变化 → 重建 Sprite ——
  useEffect(() => {
    rebuildStickers();
  }, [stickers, rebuildStickers]);

  // —— 持久化 ——
  useEffect(() => {
    saveStickers(stickers);
  }, [stickers]);

  // —— 键盘：Esc 退出 / Delete·Backspace 删除选中贴纸 ——
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (preview3d) setPreview3d(null);
        else if (preview) setPreview(null);
        else if (dockOpen) setDockOpen(false);
        else if (taskOpen) setTaskOpen(false);
        else if (!aiProgress) onClose();
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId && !aiProgress && !preview && !preview3d) {
        const target = e.target as HTMLElement | null;
        // 输入框里按退格不删贴纸
        if (target && /^(INPUT|TEXTAREA)$/.test(target.tagName)) return;
        e.preventDefault();
        setStickers((prev) => prev.filter((s) => s.id !== selectedId));
        setSelectedId(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, dockOpen, taskOpen, aiProgress, selectedId, preview, preview3d]);

  // —— 进入花园自动打卡 + 刷新任务红点 ——
  useEffect(() => {
    bumpTask('checkin');
    setTaskDot(hasUnclaimedReward());
  }, []);

  // —— 进场：读已存的 3D 模型 + 恢复上次没跑完的生成任务 ——
  useEffect(() => {
    void listModels().then(setModels);

    const pending = loadPendingTask();
    if (!pending) return;
    setAiProgress({ pct: 5, stage: '继续等待上次的 3D 模型' });
    waitModel3D(pending.id, (pct, stage) => setAiProgress({ pct, stage }))
      .then(async (res) => {
        const item = await saveModel(res.glb);
        setModels((prev) => [item, ...prev]);
        setPreview3d(item);
      })
      .catch((err) => {
        console.warn('[collage] 恢复 3D 任务失败', err);
        showToast('上次的 3D 生成没成功，可以再试一次');
      })
      .finally(() => setAiProgress(null));
  }, [showToast]);

  // —— 贴纸操作 ——
  const updateSticker = (id: string, patch: Partial<Sticker>) =>
    setStickers((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  /** 贴纸新增时的落点（插画下半部分的草地） */
  const newStickerPos = () => ({
    x: (Math.random() - 0.5) * 5,
    y: -1.6 - Math.random() * 1.4,
    z: 0.1,
  });

  const addPreset = (name: string) => {
    const maxLayer = stickersRef.current.reduce((m, s) => Math.max(m, s.layer), 0);
    const stk: Sticker = {
      id: `stk-${Date.now()}`,
      src: makePresetSticker(name),
      preset: name,
      ...newStickerPos(),
      scale: 1,
      rotation: 0,
      flipX: false,
      layer: maxLayer + 1,
    };
    setStickers((prev) => [...prev, stk]);
    setSelectedId(stk.id);
    setDockOpen(false);
  };

  /** 把一张现成的贴纸图放到花园里（自制贴纸走这里） */
  const placeSticker = (src: string) => {
    const maxLayer = stickersRef.current.reduce((m, s) => Math.max(m, s.layer), 0);
    const stk: Sticker = {
      id: `stk-${Date.now()}`,
      src,
      ...newStickerPos(),
      scale: 1,
      rotation: 0,
      flipX: false,
      layer: maxLayer + 1,
    };
    setStickers((prev) => [...prev, stk]);
    setSelectedId(stk.id);
  };

  // 上传照片 → AI 识别主体 + 抠图 → 预览确认 → 收进背包
  const handleUpload = async (file: File) => {
    if (quota <= 0) return;
    setDockOpen(false);
    setAiProgress({ pct: 0, stage: '准备中' });
    try {
      const result = await stylizeImage(file, (pct, stage) => setAiProgress({ pct, stage }));

      // 额度在 AI 调用后即扣（模型成本已发生，与是否收藏无关）
      const nextQuota = quota - 1;
      setQuotaState(nextQuota);
      setQuota(nextQuota);
      bumpTask('upload');
      setTaskDot(hasUnclaimedReward());

      if (!result.usedAI) {
        showToast(result.failReason ?? 'AI 暂时不可用，已用本地淡彩替代');
      }
      // 先给用户看结果，确认后才进背包
      setPreview(result.dataUrl);
    } catch (err) {
      console.warn('[collage] 上传处理失败', err);
      showToast('这张图没处理成功，换一张再试试');
    } finally {
      setAiProgress(null);
    }
  };

  /** 预览确认：收进「我的贴纸」背包 + 直接贴到花园 */
  const confirmPreview = () => {
    if (!preview) return;
    setLibrary(addToLibrary(preview));
    placeSticker(preview);
    setPreview(null);
    showToast('已收进贴纸背包');
  };

  /** 预览里「换一张照片」：回到背包重新选图 */
  const retryPreview = () => {
    setPreview(null);
    setDockOpen(true);
  };

  /** 把一张 3D 摆件放进花园 */
  const placeModel3D = (item: Model3DItem) => {
    const maxLayer = stickersRef.current.reduce((m, s) => Math.max(m, s.layer), 0);
    const stk: Sticker = {
      id: `stk-${Date.now()}`,
      src: '',
      kind: '3d',
      modelId: item.id,
      ...newStickerPos(),
      scale: 1,
      rotation: 0,
      flipX: false,
      layer: maxLayer + 1,
    };
    setStickers((prev) => [...prev, stk]);
    setSelectedId(stk.id);
  };

  /** 3D 生成：照片 → Seed3D → glb → 预览确认 */
  const handleMake3D = async (file: File) => {
    if (quota <= 0) return;
    setDockOpen(false);
    setAiProgress({ pct: 1, stage: '正在上传照片' });
    try {
      const res = await generate3D(file, (pct, stage) => setAiProgress({ pct, stage }));
      const item = await saveModel(res.glb);
      setModels((prev) => [item, ...prev]);

      const nextQuota = quota - 1;
      setQuotaState(nextQuota);
      setQuota(nextQuota);
      bumpTask('upload');
      setTaskDot(hasUnclaimedReward());

      setPreview3d(item);
    } catch (err) {
      console.warn('[collage] 3D 生成失败', err);
      clearPendingTask();
      showToast(describe3DFailure(String((err as Error)?.message ?? err)));
    } finally {
      setAiProgress(null);
    }
  };

  /** 3D 预览确认：放进花园（模型已在 IndexedDB，直接落地） */
  const confirmPreview3d = () => {
    if (!preview3d) return;
    placeModel3D(preview3d);
    setPreview3d(null);
    showToast('3D 摆件已放进花园');
  };

  /** 删除一张 3D 摆件（场景 + IndexedDB 一起清） */
  const removeModel3D = async (id: string) => {
    await removeModel(id);
    setModels((prev) => prev.filter((m) => m.id !== id));
    setStickers((prev) => prev.filter((s) => s.modelId !== id));
  };

  const duplicateSticker = () => {
    if (!selectedId) return;
    const src = stickersRef.current.find((s) => s.id === selectedId);
    if (!src) return;
    const maxLayer = stickersRef.current.reduce((m, s) => Math.max(m, s.layer), 0);
    const stk: Sticker = { ...src, id: `stk-${Date.now()}`, x: src.x + 0.7, layer: maxLayer + 1 };
    setStickers((prev) => [...prev, stk]);
    setSelectedId(stk.id);
  };

  const removeSticker = () => {
    if (!selectedId) return;
    setStickers((prev) => prev.filter((s) => s.id !== selectedId));
    setSelectedId(null);
  };

  const bringLayer = (dir: 1 | -1) => {
    if (!selectedId) return;
    setStickers((prev) => {
      const list = [...prev];
      const idx = list.findIndex((s) => s.id === selectedId);
      if (idx < 0) return prev;
      const target = list[idx];
      if (dir === 1) target.layer = Math.max(...list.map((s) => s.layer)) + 1;
      else target.layer = Math.min(...list.map((s) => s.layer)) - 1;
      list[idx] = target;
      return list;
    });
  };

  const selected = stickers.find((s) => s.id === selectedId) ?? null;

  if (failed) {
    return (
      <div className="collage-scene">
        <div className="collage-scene__fallback">
          <p>当前设备暂不支持拼贴场景</p>
          <button type="button" className="collage-close" onClick={onClose}>
            返回课桌
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="collage-scene">
      <div ref={mountRef} className="collage-scene__canvas" />

      {/* 空气里的光粒子（与课桌界面同一套） */}
      <Fireflies className="collage-motes" />

      <header className="collage-hud">
        <h2 className="collage-hud__title">
          <span className="collage-hud__cn">拼贴花园</span>
          <span className="collage-hud__en" lang="en">
            Collage Garden
          </span>
        </h2>
        <div className="collage-hud__actions">
          <button
            type="button"
            className="collage-task"
            onClick={() => setTaskOpen((v) => !v)}
          >
            任务
            {taskDot && <span className="collage-task__dot" aria-label="有奖励待领取" />}
          </button>
          <button
            type="button"
            className="collage-add"
            onClick={() => setDockOpen((v) => !v)}
          >
            添加贴纸
          </button>
          <button type="button" className="collage-close" onClick={onClose}>
            返回课桌
          </button>
        </div>
      </header>

      {/* 底部贴纸背包抽屉 */}
      {dockOpen && (
        <StickerDock
          quota={quota}
          library={library}
          models={models}
          onAddPreset={addPreset}
          onAddMySticker={(stk) => {
            placeSticker(stk.src);
            setDockOpen(false);
          }}
          onRemoveMySticker={(id) => setLibrary(removeFromLibrary(id))}
          onAddModel={(item) => {
            placeModel3D(item);
            setDockOpen(false);
          }}
          onRemoveModel={removeModel3D}
          onUpload={handleUpload}
          onUpload3D={handleMake3D}
          onClose={() => setDockOpen(false)}
        />
      )}

      {/* AI 抠图结果预览确认 */}
      {preview && (
        <StickerPreview
          src={preview}
          onConfirm={confirmPreview}
          onRetry={retryPreview}
          onDiscard={() => setPreview(null)}
        />
      )}

      {/* 3D 摆件预览确认 */}
      {preview3d && (
        <ModelPreview
          item={preview3d}
          onConfirm={confirmPreview3d}
          onRetry={() => {
            setPreview3d(null);
            setDockOpen(true);
          }}
          onDiscard={() => setPreview3d(null)}
        />
      )}

      {/* AI 处理进度 */}
      {aiProgress && (
        <AIProcessModal
          progress={aiProgress.pct}
          stage={aiProgress.stage}
          onCancel={() => setAiProgress(null)}
        />
      )}

      {/* 任务中心「魔法手账」 */}
      {taskOpen && (
        <TaskCenter
          onClose={() => setTaskOpen(false)}
          onQuotaChange={(q) => {
            setQuotaState(q);
            setTaskDot(hasUnclaimedReward());
          }}
        />
      )}

      {/* 选中贴纸的操作条 */}
      {selected && (
        <div className="collage-toolbar" ref={toolbarRef}>
          <span className="collage-toolbar__name">
            {selected.kind === '3d'
              ? '3D 摆件'
              : selected.preset
                ? presetLabel(selected.preset)
                : '我的贴纸'}
          </span>
          <button type="button" onClick={() => updateSticker(selected.id, { scale: Math.max(0.3, selected.scale * 0.85) })}>
            缩小
          </button>
          <button type="button" onClick={() => updateSticker(selected.id, { scale: Math.min(3.5, selected.scale * 1.18) })}>
            放大
          </button>
          <button type="button" onClick={() => updateSticker(selected.id, { rotation: selected.rotation + Math.PI / 8 })}>
            {selected.kind === '3d' ? '转向' : '旋转'}
          </button>
          {/* 镜像 / 复制 / 层级只对平面贴纸有意义 */}
          {selected.kind !== '3d' && (
            <>
              <button type="button" onClick={() => updateSticker(selected.id, { flipX: !selected.flipX })}>
                镜像
              </button>
              <button type="button" onClick={duplicateSticker}>
                复制
              </button>
              <button type="button" onClick={() => bringLayer(1)}>
                置顶
              </button>
              <button type="button" onClick={() => bringLayer(-1)}>
                置底
              </button>
            </>
          )}
          <button type="button" className="collage-toolbar__danger" onClick={removeSticker}>
            删除
          </button>
        </div>
      )}

      {/* 轻提示（AI 降级原因等） */}
      {toast && (
        <div className="collage-toast" role="status">
          {toast}
        </div>
      )}

      <p className="collage-hint">
        <span className="collage-hint__mouse" aria-hidden="true" />
        {selected ? '拖动移动 · 滚轮缩放 · Delete 删除' : '左键选贴纸 · 拖动移动 · 滚轮缩放'}
      </p>
    </div>
  );
}
