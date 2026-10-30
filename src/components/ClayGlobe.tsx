import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { storySound } from '../utils/sound';

export interface PinItem {
  id: string;
  name: string;
  city: string;
  lat: number;
  lon: number;
  school: string;
  desc: string;
  author?: string;
  role?: 'TEACHER' | 'STUDENT';
  date?: string;
}

interface ClayGlobeProps {
  pins: PinItem[];
  onSelectPin: (pin: PinItem) => void;
  activeTargetCoord?: { lat: number; lon: number } | null;
  newlyDroppedPinId?: string | null;
}

// 经纬度转换到 3D 球体局部坐标
function latLonToVector3(lat: number, lon: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  return new THREE.Vector3(x, y, z);
}

// 动态创建手绘撕纸图钉铭牌纹理（带有小王子纸质标签风格）
function createPinLabelTexture(cityName: string, title: string, isTeacher: boolean): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 80;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    // 纸质底色
    ctx.fillStyle = '#FAF7EE';
    ctx.strokeStyle = '#1A3320';
    ctx.lineWidth = 3;

    // 手绘圆角矩形
    ctx.beginPath();
    ctx.roundRect(6, 6, 244, 68, 8);
    ctx.fill();
    ctx.stroke();

    // 撕纸胶带角标
    ctx.fillStyle = isTeacher ? '#E27D60' : '#85A98F';
    ctx.fillRect(16, 2, 45, 8);

    // 城市与标题文字
    ctx.fillStyle = '#1A3320';
    ctx.font = 'bold 22px "Noto Serif SC", serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const displayCity = cityName.split('·').pop() || cityName;
    ctx.fillText(`📍 ${displayCity}`, 18, 32);

    ctx.fillStyle = '#52796F';
    ctx.font = '16px "Noto Serif SC", serif';
    const shortTitle = title.length > 9 ? title.slice(0, 9) + '...' : title;
    ctx.fillText(shortTitle, 20, 56);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export default function ClayGlobe({
  pins,
  onSelectPin,
  activeTargetCoord,
  newlyDroppedPinId,
}: ClayGlobeProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [hoveredPin, setHoveredPin] = useState<{ pin: PinItem; x: number; y: number } | null>(null);

  // 内部引用以供动画和交互
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const globeGroupRef = useRef<THREE.Group | null>(null);
  const pinsGroupRef = useRef<THREE.Group | null>(null);
  const ripplesGroupRef = useRef<THREE.Group | null>(null);
  const particlesGroupRef = useRef<THREE.Group | null>(null);

  // 四元数目标平滑旋转
  const targetQuaternionRef = useRef<THREE.Quaternion | null>(null);
  const isTargetingRef = useRef<boolean>(false);
  const isDraggingRef = useRef(false);
  const prevMouseRef = useRef({ x: 0, y: 0 });

  // 记录新落钉的动画时钟
  const dropAnimRef = useRef<{
    pinId: string;
    startTime: number;
    pinGroup: THREE.Group | null;
    rippleMesh: THREE.Mesh | null;
  } | null>(null);

  // 响应外部新坐标：利用四元数直接把该点精准旋转对准摄像机视野正中心！
  useEffect(() => {
    if (!activeTargetCoord || !globeGroupRef.current || !cameraRef.current) return;
    const { lat, lon } = activeTargetCoord;

    // 获取该点在球体坐标系下的局部法向量
    const localTarget = latLonToVector3(lat, lon, 1.0).normalize();
    // 摄像机方向（略带俯视，更加自然）
    const desiredDir = new THREE.Vector3(0, 0.25, 1.0).normalize();

    // 计算将 localTarget 旋转到 desiredDir 所需的四元数
    const targetQuat = new THREE.Quaternion().setFromUnitVectors(localTarget, desiredDir);
    targetQuaternionRef.current = targetQuat;
    isTargetingRef.current = true;

    // 播放音效
    storySound.playPinDrop();
  }, [activeTargetCoord]);

  // 初始化 Three.js 场景
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    // 1. 初始化场景与相机
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 1.3, 5.2);
    cameraRef.current = camera;

    // 2. 渲染器配置
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 3. 温暖定格黏土三点工作室光照
    const ambientLight = new THREE.AmbientLight(0xfff8ed, 1.25);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xfffae6, 2.2);
    keyLight.position.set(4.5, 5.5, 4.0);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x85a98f, 1.0);
    fillLight.position.set(-4.5, -2.5, -3.0);
    scene.add(fillLight);

    // 4. 地球总组
    const globeGroup = new THREE.Group();
    // 默认初始角度面向中国区域（东经 105°，北纬 35°）
    const initialTarget = latLonToVector3(35, 105, 1.0).normalize();
    const initialDesired = new THREE.Vector3(0, 0.2, 1.0).normalize();
    globeGroup.quaternion.setFromUnitVectors(initialTarget, initialDesired);
    scene.add(globeGroup);
    globeGroupRef.current = globeGroup;

    // 5. 泥塑地球主体 (球体半径 2.0)
    const earthRadius = 2.0;
    const earthGeom = new THREE.SphereGeometry(earthRadius, 54, 54);

    // 给顶点注入微小手捏黏土的粗糙肌理
    const posAttr = earthGeom.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i);
      const vy = posAttr.getY(i);
      const vz = posAttr.getZ(i);
      const len = Math.sqrt(vx * vx + vy * vy + vz * vz);
      const bump = Math.sin(vx * 4.2) * Math.cos(vy * 4.2) * 0.022;
      posAttr.setXYZ(i, (vx / len) * (earthRadius + bump), (vy / len) * (earthRadius + bump), (vz / len) * (earthRadius + bump));
    }
    earthGeom.computeVertexNormals();

    const earthMat = new THREE.MeshStandardMaterial({
      color: 0x7FA389, // 定格动画同款抹茶绿泥土
      roughness: 0.88,
      metalness: 0.04,
    });
    const earthMesh = new THREE.Mesh(earthGeom, earthMat);
    globeGroup.add(earthMesh);

    // 6. 手绘大陆经纬纸纹层
    const wireGeom = new THREE.SphereGeometry(earthRadius + 0.006, 28, 28);
    const wireMat = new THREE.MeshBasicMaterial({
      color: 0xFAF7EE,
      wireframe: true,
      transparent: true,
      opacity: 0.14,
    });
    const wireMesh = new THREE.Mesh(wireGeom, wireMat);
    globeGroup.add(wireMesh);

    // 7. 中国区域金色暖光温润漫射辉光
    const chinaPos = latLonToVector3(35, 105, earthRadius + 0.02);
    const chinaGroup = new THREE.Group();
    chinaGroup.position.copy(chinaPos);
    chinaGroup.lookAt(chinaPos.clone().multiplyScalar(2));

    const glowCircleGeom = new THREE.CircleGeometry(0.76, 32);
    const glowCircleMat = new THREE.MeshBasicMaterial({
      color: 0xFFDE59,
      transparent: true,
      opacity: 0.36,
      side: THREE.DoubleSide,
    });
    const glowCircle = new THREE.Mesh(glowCircleGeom, glowCircleMat);
    chinaGroup.add(glowCircle);

    // 外圈细金环
    const outerRingGeom = new THREE.RingGeometry(0.72, 0.98, 32);
    const outerRingMat = new THREE.MeshBasicMaterial({
      color: 0xFFDE59,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
    });
    const outerRing = new THREE.Mesh(outerRingGeom, outerRingMat);
    chinaGroup.add(outerRing);

    globeGroup.add(chinaGroup);

    // 8. 图钉总组
    const pinsGroup = new THREE.Group();
    globeGroup.add(pinsGroup);
    pinsGroupRef.current = pinsGroup;

    // 9. 动态水波纹/泥土震荡组
    const ripplesGroup = new THREE.Group();
    globeGroup.add(ripplesGroup);
    ripplesGroupRef.current = ripplesGroup;

    // 10. 爆裂星光粒子组
    const particlesGroup = new THREE.Group();
    globeGroup.add(particlesGroup);
    particlesGroupRef.current = particlesGroup;

    // 11. 环绕的小王子微云
    const satellitesGroup = new THREE.Group();
    for (let c = 0; c < 7; c++) {
      const angle = (c / 7) * Math.PI * 2;
      const dist = earthRadius + 0.55 + Math.sin(c * 2) * 0.18;
      const cy = Math.cos(c * 2.5) * 0.75;
      const cloudGeom = new THREE.DodecahedronGeometry(0.12, 0);
      const cloudMat = new THREE.MeshStandardMaterial({
        color: 0xFAF7EE,
        roughness: 0.9,
      });
      const cloud = new THREE.Mesh(cloudGeom, cloudMat);
      cloud.position.set(Math.cos(angle) * dist, cy, Math.sin(angle) * dist);
      satellitesGroup.add(cloud);
    }
    globeGroup.add(satellitesGroup);

    // 12. 交互控制：鼠标拖拽与射线检测
    const handleMouseDown = (e: MouseEvent) => {
      isDraggingRef.current = true;
      isTargetingRef.current = false; // 取消强制追踪
      prevMouseRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      if (isDraggingRef.current && globeGroupRef.current) {
        const deltaX = e.clientX - prevMouseRef.current.x;
        const deltaY = e.clientY - prevMouseRef.current.y;

        // 使用轴角四元数旋转
        const rotY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), deltaX * 0.006);
        const rotX = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), deltaY * 0.006);
        globeGroupRef.current.quaternion.premultiply(rotY);
        globeGroupRef.current.quaternion.multiply(rotX);

        prevMouseRef.current = { x: e.clientX, y: e.clientY };
        return;
      }

      // 射线检测图钉
      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2(
        (mouseX / rect.width) * 2 - 1,
        -(mouseY / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(pointer, camera);

      if (pinsGroupRef.current) {
        const intersects = raycaster.intersectObjects(pinsGroupRef.current.children, true);
        if (intersects.length > 0) {
          let hitMesh = intersects[0].object as THREE.Mesh;
          while (hitMesh.parent && !hitMesh.userData.pinData && hitMesh.parent !== pinsGroupRef.current) {
            hitMesh = hitMesh.parent as THREE.Mesh;
          }
          if (hitMesh.userData.pinData) {
            setHoveredPin({
              pin: hitMesh.userData.pinData,
              x: mouseX,
              y: mouseY,
            });
            container.style.cursor = 'pointer';
            return;
          }
        }
      }
      setHoveredPin(null);
      container.style.cursor = isDraggingRef.current ? 'grabbing' : 'grab';
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      if (container) container.style.cursor = 'grab';
    };

    const handleClick = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2(
        (mouseX / rect.width) * 2 - 1,
        -(mouseY / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(pointer, camera);

      if (pinsGroupRef.current) {
        const intersects = raycaster.intersectObjects(pinsGroupRef.current.children, true);
        if (intersects.length > 0) {
          let hitMesh = intersects[0].object as THREE.Mesh;
          while (hitMesh.parent && !hitMesh.userData.pinData && hitMesh.parent !== pinsGroupRef.current) {
            hitMesh = hitMesh.parent as THREE.Mesh;
          }
          if (hitMesh.userData.pinData) {
            storySound.playPinDrop();
            onSelectPin(hitMesh.userData.pinData);
          }
        }
      }
    };

    // 触摸手势支持
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        isDraggingRef.current = true;
        isTargetingRef.current = false;
        prevMouseRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (isDraggingRef.current && e.touches.length === 1 && globeGroupRef.current) {
        const deltaX = e.touches[0].clientX - prevMouseRef.current.x;
        const deltaY = e.touches[0].clientY - prevMouseRef.current.y;
        const rotY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), deltaX * 0.007);
        const rotX = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), deltaY * 0.007);
        globeGroupRef.current.quaternion.premultiply(rotY);
        globeGroupRef.current.quaternion.multiply(rotX);
        prevMouseRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    };

    const handleTouchEnd = () => {
      isDraggingRef.current = false;
    };

    container.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    container.addEventListener('click', handleClick);
    container.addEventListener('touchstart', handleTouchStart);
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleTouchEnd);

    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const newW = container.clientWidth;
      const newH = container.clientHeight;
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, newH);
    };
    window.addEventListener('resize', handleResize);

    // 13. 动画主循环
    let reqId = 0;
    const clock = new THREE.Clock();

    const animate = () => {
      const delta = clock.getDelta();
      const now = performance.now();

      // 目标点位平滑插值旋转对准相机
      if (isTargetingRef.current && targetQuaternionRef.current && globeGroupRef.current) {
        globeGroupRef.current.quaternion.slerp(targetQuaternionRef.current, Math.min(1, delta * 4.2));
        if (globeGroupRef.current.quaternion.angleTo(targetQuaternionRef.current) < 0.01) {
          isTargetingRef.current = false;
        }
      } else if (!isDraggingRef.current && globeGroupRef.current) {
        // 轻柔定格自转
        const slowSpin = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), delta * 0.035);
        globeGroupRef.current.quaternion.premultiply(slowSpin);
      }

      // 微云缓慢公转
      satellitesGroup.rotation.y -= delta * 0.05;

      // 新落图钉的物理下落与回弹动画（定格泥塑入土震荡）
      if (dropAnimRef.current) {
        const { startTime, pinGroup, rippleMesh } = dropAnimRef.current;
        const elapsed = (now - startTime) / 1000;

        if (pinGroup) {
          const earthR = 2.0;
          if (elapsed < 0.9) {
            // 定格弹力函数：先从高空自由落体砸入，再剧烈回弹2次
            const bounce = Math.sin(elapsed * 16) * Math.exp(-elapsed * 5.0) * 0.45;
            const dropAltitude = earthR + 0.05 + Math.max(0, bounce) + (elapsed < 0.22 ? (0.22 - elapsed) * 2.5 : 0);
            
            // 沿自身法线更新高度
            const dir = pinGroup.position.clone().normalize();
            pinGroup.position.copy(dir.multiplyScalar(dropAltitude));
          } else {
            // 恢复稳态高度
            const dir = pinGroup.position.clone().normalize();
            pinGroup.position.copy(dir.multiplyScalar(earthR + 0.05));
          }
        }

        // 地面泥土震荡光圈扩展
        if (rippleMesh) {
          if (elapsed < 1.4) {
            const scale = 1.0 + elapsed * 2.8;
            rippleMesh.scale.set(scale, scale, 1);
            const mat = rippleMesh.material as THREE.MeshBasicMaterial;
            mat.opacity = Math.max(0, 0.7 - elapsed * 0.5);
          } else {
            rippleMesh.visible = false;
          }
        }

        if (elapsed > 1.5) {
          dropAnimRef.current = null;
        }
      }

      renderer.render(scene, camera);
      reqId = requestAnimationFrame(animate);
    };

    reqId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(reqId);
      container.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      container.removeEventListener('click', handleClick);
      container.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('resize', handleResize);

      earthGeom.dispose();
      earthMat.dispose();
      wireGeom.dispose();
      wireMat.dispose();
      renderer.dispose();
    };
  }, [onSelectPin]);

  // 14. 核心：动态生成 3D 泥塑图钉 Mesh，并为新落钉挂载跳跃回弹动效与手绘撕纸旗标
  useEffect(() => {
    const pinsGroup = pinsGroupRef.current;
    const ripplesGroup = ripplesGroupRef.current;
    if (!pinsGroup || !ripplesGroup) return;

    // 清理旧 Mesh
    while (pinsGroup.children.length > 0) {
      const obj = pinsGroup.children[0] as THREE.Group;
      obj.traverse((child) => {
        if ((child as THREE.Mesh).geometry) (child as THREE.Mesh).geometry.dispose();
      });
      pinsGroup.remove(obj);
    }

    while (ripplesGroup.children.length > 0) {
      const obj = ripplesGroup.children[0] as THREE.Mesh;
      if (obj.geometry) obj.geometry.dispose();
      ripplesGroup.remove(obj);
    }

    const earthRadius = 2.0;

    pins.forEach((pin, index) => {
      const isNewDrop = pin.id === newlyDroppedPinId;
      const pinPos = latLonToVector3(pin.lat, pin.lon, earthRadius + 0.05);

      const pinGroup = new THREE.Group();
      pinGroup.position.copy(pinPos);
      pinGroup.lookAt(pinPos.clone().multiplyScalar(2));
      pinGroup.userData.pinData = pin;

      const isTeacher = pin.role === 'TEACHER';
      const headColor = isTeacher ? 0xE27D60 : (index % 2 === 0 ? 0xC38D9E : 0xFFDE59);

      // (1) 泥塑球头（定格手工质感）
      const headGeom = new THREE.SphereGeometry(0.095, 18, 18);
      const headMat = new THREE.MeshStandardMaterial({
        color: headColor,
        roughness: 0.8,
        metalness: 0.08,
      });
      const headMesh = new THREE.Mesh(headGeom, headMat);
      headMesh.position.set(0, 0, 0.13);
      headMesh.userData.pinData = pin;
      pinGroup.add(headMesh);

      // (2) 针身
      const needleGeom = new THREE.CylinderGeometry(0.016, 0.006, 0.15, 8);
      const needleMat = new THREE.MeshStandardMaterial({
        color: 0x1A3320,
        roughness: 0.65,
        metalness: 0.35,
      });
      const needleMesh = new THREE.Mesh(needleGeom, needleMat);
      needleMesh.rotation.x = Math.PI / 2;
      needleMesh.position.set(0, 0, 0.06);
      needleMesh.userData.pinData = pin;
      pinGroup.add(needleMesh);

      // (3) 底座泥土落坑微环
      const baseRingGeom = new THREE.RingGeometry(0.035, 0.12, 16);
      const baseRingMat = new THREE.MeshBasicMaterial({
        color: 0x1A3320,
        transparent: true,
        opacity: 0.32,
        side: THREE.DoubleSide,
      });
      const baseRing = new THREE.Mesh(baseRingGeom, baseRingMat);
      pinGroup.add(baseRing);

      // (4) 3D 手绘浮动纸质旗标牌（始终悬浮在图钉上方）
      const labelTexture = createPinLabelTexture(pin.city, pin.name, isTeacher);
      const labelMat = new THREE.SpriteMaterial({
        map: labelTexture,
        transparent: true,
      });
      const labelSprite = new THREE.Sprite(labelMat);
      labelSprite.scale.set(0.65, 0.22, 1);
      labelSprite.position.set(0, 0.18, 0.18);
      labelSprite.userData.pinData = pin;
      pinGroup.add(labelSprite);

      pinsGroup.add(pinGroup);

      // (5) 如果是刚刚新增的图钉，为其绑定专属震荡波与掉落物理动画
      if (isNewDrop) {
        // 创建震荡涟漪环
        const rippleGeom = new THREE.RingGeometry(0.08, 0.16, 32);
        const rippleMat = new THREE.MeshBasicMaterial({
          color: 0xFFDE59,
          transparent: true,
          opacity: 0.7,
          side: THREE.DoubleSide,
        });
        const rippleMesh = new THREE.Mesh(rippleGeom, rippleMat);
        rippleMesh.position.copy(pinPos);
        rippleMesh.lookAt(pinPos.clone().multiplyScalar(2));
        ripplesGroup.add(rippleMesh);

        // 启动动画调度
        dropAnimRef.current = {
          pinId: pin.id,
          startTime: performance.now(),
          pinGroup,
          rippleMesh,
        };
      }
    });
  }, [pins, newlyDroppedPinId]);

  return (
    <div className="relative w-full h-full overflow-hidden select-none">
      {/* Three.js 挂载节点 */}
      <div 
        ref={mountRef} 
        className="w-full h-full cursor-grab active:cursor-grabbing" 
      />

      {/* 悬停微卡片提示 */}
      {hoveredPin && (
        <div
          className="absolute z-30 pointer-events-none transform -translate-x-1/2 -translate-y-full mb-3"
          style={{ left: `${hoveredPin.x}px`, top: `${hoveredPin.y - 12}px` }}
        >
          <div className="bg-[#FAF7EE] text-[#1A3320] text-xs px-3.5 py-2 rounded hand-drawn-border hand-drawn-box flex items-center gap-2 whitespace-nowrap shadow-xl">
            <span className="text-base">📍</span>
            <div>
              <div className="font-bold text-sm text-[#1A3320]">{hoveredPin.pin.city}</div>
              <div className="text-[#52796F] text-[11px]">{hoveredPin.pin.name}</div>
            </div>
          </div>
        </div>
      )}

      {/* 底部交互指引小徽章 */}
      <div className="absolute bottom-4 left-6 z-20 pointer-events-none flex items-center gap-2 text-xs text-[#52796F] bg-[#FAF7EE]/90 px-3 py-1.5 rounded-full hand-drawn-border hand-drawn-box-sm">
        <span>🖐️ 鼠标拖拽地球全景</span>
        <span>·</span>
        <span>📍 轻触图钉翻阅课题手记</span>
      </div>
    </div>
  );
}
