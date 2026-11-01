import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { createClayEarthTexture, createClayNormalTexture } from '../utils/clayTextures';
import { storySound } from '../utils/sound';
import GlobeFallback from './GlobeFallback';
import type { PinItem } from '../types';

interface ClayGlobeProps {
  pins: PinItem[];
  /** 画布边长（px）。尺寸由外层根据视口算好后传入 */
  size: number;
  zoomed: boolean;
  activeTargetCoord: { lat: number; lon: number } | null;
  newlyDroppedPinId: string | null;
  onSelectPin: (pin: PinItem) => void;
  onHoverPin: (pin: PinItem | null, clientX: number, clientY: number) => void;
  /** 落钉瞬间把新图钉的屏幕坐标抛出来，让"啪！"打在钉子上 */
  onPinAnchor?: (at: { x: number; y: number } | null) => void;
  onToggleZoom: () => void;
}

const R = 2;

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
  }, [zoomed]);

  const targetQuatRef = useRef<THREE.Quaternion | null>(null);
  const targetingRef = useRef(false);
  const dropRef = useRef<{ start: number; pin: THREE.Group; ripple: THREE.Mesh | null } | null>(null);

  /* ---------------- 场景初始化（只做一次） ---------------- */
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const side = size || 600;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    /*
     * 取景要同时兜住两样东西：球顶（y=+2.03）和底座圆盘的最低点（y=-2.745）。
     * 只按球半径算视锥是不够的——圆盘半径 0.7，它靠镜头那一侧在透视下会被放大，
     * 于是底座前沿比球体下缘还低出一截，直接掉到画布外面被切平，
     * 看起来就像贴图贴了一半。这里联立「顶部留 4%、底部贴边」解出相机位置：
     *   (2.034 - VIEW_Y) = 0.96 · tan(19°) · d
     *   (2.745 + VIEW_Y) = 1.00 · tan(19°) · (d - 0.7)   ← 减 0.7 是圆盘半径带来的近距补偿
     * 解得 VIEW_Y ≈ -0.425、d ≈ 7.44。底座下沿正好压在画布底边上，
     * 落座后画布底边一贴住台面，铜座就是踩实的。
     */
    const VIEW_Y = -0.425;
    camera.position.set(0, VIEW_Y, 7.44);
    camera.lookAt(0, VIEW_Y, 0);
    cameraRef.current = camera;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      // 这台机器没有 WebGL：退回 2D 黏土球，绝不能让整页白掉
      setFailed(true);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(side, side);
    renderer.setClearAlpha(0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    // 不用 ACES：它把黏土的泥色一律抬亮、去饱和，莫兰迪会变成灰白
    renderer.toneMapping = THREE.NoToneMapping;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 影棚光：暖主光 + 天青补光 + 背后轮廓光（提亮，塑出温润通透的亮面软陶高光）
    scene.add(new THREE.AmbientLight(0xfffbf2, 1.28));

    const key = new THREE.DirectionalLight(0xfff7e8, 1.42);
    key.position.set(4.2, 5.6, 5.2);
    scene.add(key);

    const fill = new THREE.DirectionalLight(0xd7ecf2, 0.78);
    fill.position.set(-5, -1.6, -3.4);
    scene.add(fill);

    const rim = new THREE.DirectionalLight(0xffffff, 0.66);
    rim.position.set(-2.4, 3.2, -5);
    scene.add(rim);

    // 右下的暖反弹光，托住球的暗侧
    const bounce = new THREE.DirectionalLight(0xfff0e0, 0.42);
    bounce.position.set(4.5, -3.2, 2.4);
    scene.add(bounce);

    const globe = new THREE.Group();
    // 初始把中国区域转向镜头（东经 105°，北纬 35°），北朝上、东朝右
    globe.quaternion.copy(orientTo(35, 105));
    scene.add(globe);
    globeRef.current = globe;

    // —— 球体：手捏出来的不完全圆 ——
    const geom = new THREE.SphereGeometry(R, 96, 96);
    const pos = geom.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const len = Math.hypot(x, y, z);
      const dents = Math.sin(x * 3.4) * Math.cos(y * 3.4) * 0.022 + Math.sin(z * 5.6) * 0.012;
      const k = (R + dents) / len;
      pos.setXYZ(i, x * k, y * k, z * k);
    }
    geom.computeVertexNormals();

    const albedo = createClayEarthTexture(2048, 1024);
    const normal = createClayNormalTexture(512);

    const mat = new THREE.MeshStandardMaterial({
      map: albedo,
      normalMap: normal,
      normalScale: new THREE.Vector2(0.62, 0.62),
      roughness: 0.72,
      metalness: 0.03,
    });
    globe.add(new THREE.Mesh(geom, mat));

    // —— 黄铜支架：一道半圆弧 + 立柱 + 圆盘底座（属于「桌子」，不能挂进会旋转的 globe 组） ——
    const baseGroup = new THREE.Group();
    scene.add(baseGroup);

    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xe2c47e,
      roughness: 0.34,
      metalness: 0.62,
    });
    const brassDeep = new THREE.MeshStandardMaterial({
      color: 0xc39a55,
      roughness: 0.42,
      metalness: 0.5,
    });

    // 弧：绕球一圈多一点，开口朝左下，像参考插画里那道抱住球的金色带
    const arcGeom = new THREE.TorusGeometry(R + 0.24, 0.095, 16, 96, Math.PI * 1.02);
    const arc = new THREE.Mesh(arcGeom, brassMat);
    arc.rotation.z = -Math.PI * 0.5;
    baseGroup.add(arc);

    // 弧的落点处一个小铜箍，把弧和立柱接上
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.12, 16), brassDeep);
    collar.position.y = -(R + 0.02);
    baseGroup.add(collar);

    // 立柱：从球的底部往下，接住底座
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.1, 0.62, 20), brassMat);
    stem.position.y = -(R + 0.26);
    baseGroup.add(stem);

    // 圆盘底座：两层，上小下大，像被车出来的铜座
    const discTop = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.56, 0.11, 40), brassMat);
    discTop.position.y = -(R + 0.58);
    baseGroup.add(discTop);

    const discBottom = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.7, 0.13, 40), brassDeep);
    discBottom.position.y = -(R + 0.68);
    baseGroup.add(discBottom);

    const pinsGroup = new THREE.Group();
    globe.add(pinsGroup);
    pinsRef.current = pinsGroup;

    const ripples = new THREE.Group();
    globe.add(ripples);
    ripplesRef.current = ripples;

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

    const tick = () => {
      const dt = clock.getDelta();
      const now = performance.now();
      acc += dt;

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

      // 新落钉：落下 → 回弹 → 稳住
      if (dropRef.current) {
        const { start, pin, ripple } = dropRef.current;
        const t = (now - start) / 1000;
        if (t < 0.95) {
          const bounce = Math.sin(t * 17) * Math.exp(-t * 5.2) * 0.42;
          const lift = t < 0.2 ? (0.2 - t) * 2.6 : 0;
          const dir = pin.position.clone().normalize();
          pin.position.copy(dir.multiplyScalar(R + 0.045 + Math.max(0, bounce) + lift));
        } else {
          pin.position.copy(pin.position.clone().normalize().multiplyScalar(R + 0.045));
          dropRef.current = null;
        }

        // 把钉子投影到屏幕上，"啪！"就能正正打在图钉落点上
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

      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      geom.dispose();
      mat.dispose();
      albedo.dispose();
      normal.dispose();
      arcGeom.dispose();
      brassMat.dispose();
      brassDeep.dispose();
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

  /* ---------------- 图钉 ---------------- */
  useEffect(() => {
    const group = pinsRef.current;
    const ripples = ripplesRef.current;
    if (!group || !ripples) return;

    // 清空旧图钉
    while (group.children.length) {
      const child = group.children[0];
      child.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
      });
      group.remove(child);
    }
    while (ripples.children.length) {
      const child = ripples.children[0] as THREE.Mesh;
      child.geometry?.dispose();
      ripples.remove(child);
    }

    const headMat = (color: number) =>
      new THREE.MeshStandardMaterial({ color, roughness: 0.86, metalness: 0.03 });

    pins.forEach((pin, i) => {
      const isNew = pin.id === newlyDroppedPinId;
      const at = latLonToVector3(pin.lat, pin.lon, R + 0.045);
      const node = new THREE.Group();
      node.position.copy(at);
      node.lookAt(at.clone().multiplyScalar(2));
      node.userData.pin = pin;

      const palette = [0xf2e7cb, 0x8fae5e, 0xa8d4ba];
      const color = pin.role === 'TEACHER' ? 0xd4796f : palette[i % 3];

      const head = new THREE.Mesh(new THREE.DodecahedronGeometry(0.105, 2), headMat(color));
      head.position.z = 0.115;
      head.userData.pin = pin;
      node.add(head);

      const needle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.014, 0.005, 0.14, 8),
        new THREE.MeshStandardMaterial({ color: 0x6f5a44, roughness: 0.8 })
      );
      needle.rotation.x = Math.PI / 2;
      needle.position.z = 0.05;
      needle.userData.pin = pin;
      node.add(needle);

      const pad = new THREE.Mesh(
        new THREE.SphereGeometry(0.045, 12, 12),
        new THREE.MeshStandardMaterial({ color: 0xe8d9b2, roughness: 0.9 })
      );
      pad.scale.set(1.5, 1.5, 0.45);
      pad.userData.pin = pin;
      node.add(pad);

      group.add(node);

      if (isNew) {
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(0.075, 0.17, 32),
          new THREE.MeshBasicMaterial({
            color: 0xffe3a8,
            transparent: true,
            opacity: 0.72,
            side: THREE.DoubleSide,
          })
        );
        ring.position.copy(at);
        ring.lookAt(at.clone().multiplyScalar(2));
        ripples.add(ring);
        dropRef.current = { start: performance.now(), pin: node, ripple: ring };
      }
    });
  }, [pins, newlyDroppedPinId]);

  return failed ? (
    <GlobeFallback pins={pins} size={size} zoomed={zoomed} onToggleZoom={onToggleZoom} />
  ) : (
    <div ref={mountRef} style={{ width: size, height: size }} />
  );
}
