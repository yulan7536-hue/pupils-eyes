import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { storySound } from '../utils/sound';
import {
  createClayAlbedoTexture,
  createClayNormalTexture,
  createClayTree,
  createClayMountain,
  createClayMoon,
} from '../utils/clayTextures';

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
  selectedPin?: PinItem | null;
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

// 动态创建手绘撕纸图钉旗标
function createPinLabelTexture(cityName: string, title: string, isTeacher: boolean): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 84;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    // 粗糙撕纸底色
    ctx.fillStyle = '#FAF5E8';
    ctx.strokeStyle = '#1E3824';
    ctx.lineWidth = 3.5;

    ctx.beginPath();
    ctx.roundRect(6, 6, 244, 72, 8);
    ctx.fill();
    ctx.stroke();

    // 顶部黏土贴胶
    ctx.fillStyle = isTeacher ? '#D47A6A' : '#6E9277';
    ctx.fillRect(16, 2, 50, 10);

    // 城市文字
    ctx.fillStyle = '#1E3824';
    ctx.font = 'bold 22px "Noto Serif SC", serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const displayCity = cityName.split('·').pop() || cityName;
    ctx.fillText(`📍 ${displayCity}`, 18, 36);

    ctx.fillStyle = '#52796F';
    ctx.font = '15px "Noto Serif SC", serif';
    const shortTitle = title.length > 9 ? title.slice(0, 9) + '...' : title;
    ctx.fillText(shortTitle, 20, 60);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export default function ClayGlobe({
  pins,
  onSelectPin,
  selectedPin,
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
  const selectedPinRef = useRef<PinItem | null>(null);

  // 同步选中的图钉引用用于相机推拉镜头动效（学习参考视频的聚焦拉近体验）
  useEffect(() => {
    selectedPinRef.current = selectedPin || null;
  }, [selectedPin]);

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

  // 响应外部新坐标：利用四元数把该点精准旋转对准摄像机视野正中心
  useEffect(() => {
    if (!activeTargetCoord || !globeGroupRef.current || !cameraRef.current) return;
    const { lat, lon } = activeTargetCoord;

    const localTarget = latLonToVector3(lat, lon, 1.0).normalize();
    const desiredDir = new THREE.Vector3(0, 0.22, 1.0).normalize();

    const targetQuat = new THREE.Quaternion().setFromUnitVectors(localTarget, desiredDir);
    targetQuaternionRef.current = targetQuat;
    isTargetingRef.current = true;

    storySound.playPinDrop();
  }, [activeTargetCoord]);

  // 初始化 Three.js 场景
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    // 摄像机放置在正中央，确保地球完全显现在网页中央、无任何偏位与遮挡
    camera.position.set(0, 0, 5.4);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 1. 定格动画影棚温暖灯光 RIG（3200K 白炽暖光 Key Light + 抹茶绿漫射 Fill Light）
    const ambientLight = new THREE.AmbientLight(0xfff5e6, 1.35);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xfff0d0, 2.4);
    keyLight.position.set(4.5, 6.0, 4.2);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x7fa389, 1.1);
    fillLight.position.set(-4.5, -2.5, -3.2);
    scene.add(fillLight);

    // 2. 地球总组
    const globeGroup = new THREE.Group();
    // 初始角度朝向中国区域（东经 105°，北纬 35°）
    const initialTarget = latLonToVector3(35, 105, 1.0).normalize();
    const initialDesired = new THREE.Vector3(0, 0.2, 1.0).normalize();
    globeGroup.quaternion.setFromUnitVectors(initialTarget, initialDesired);
    scene.add(globeGroup);
    globeGroupRef.current = globeGroup;

    // 3. 核心：手捏黏土纹理地球主体 (Stop-Motion Clay Earth)
    const earthRadius = 2.0;
    const earthGeom = new THREE.SphereGeometry(earthRadius, 64, 64);

    // 手捏不规则变形（大拇指按压起伏）
    const posAttr = earthGeom.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i);
      const vy = posAttr.getY(i);
      const vz = posAttr.getZ(i);
      const len = Math.sqrt(vx * vx + vy * vy + vz * vz);
      // 复合手捏起伏
      const thumbDents = Math.sin(vx * 3.5) * Math.cos(vy * 3.5) * 0.028 + Math.sin(vz * 6.0) * 0.015;
      posAttr.setXYZ(i, (vx / len) * (earthRadius + thumbDents), (vy / len) * (earthRadius + thumbDents), (vz / len) * (earthRadius + thumbDents));
    }
    earthGeom.computeVertexNormals();

    // 注入手捏指纹法线与大理石抹茶软陶泥漫反射
    const clayAlbedo = createClayAlbedoTexture(1024, 512);
    const clayNormal = createClayNormalTexture(512, 512);

    const earthMat = new THREE.MeshStandardMaterial({
      map: clayAlbedo,
      normalMap: clayNormal,
      normalScale: new THREE.Vector2(0.85, 0.85),
      roughness: 0.86,
      metalness: 0.03,
    });
    const earthMesh = new THREE.Mesh(earthGeom, earthMat);
    globeGroup.add(earthMesh);

    // 4. 定格大陆板块厚切泥片 (Clay Cutout Continents)
    // 中国区域厚切陶土块（像用擀面杖压扁切好的厚泥片贴在球体上）
    const chinaCenter = latLonToVector3(35, 105, earthRadius + 0.03);
    const chinaGroup = new THREE.Group();
    chinaGroup.position.copy(chinaCenter);
    chinaGroup.lookAt(chinaCenter.clone().multiplyScalar(2));

    // 厚泥片大陆边缘
    const slabGeom = new THREE.CylinderGeometry(0.78, 0.82, 0.04, 32);
    const slabMat = new THREE.MeshStandardMaterial({
      color: 0x98B99D, // 浅抹茶黄泥
      roughness: 0.82,
      metalness: 0.02,
    });
    const chinaSlab = new THREE.Mesh(slabGeom, slabMat);
    chinaSlab.rotation.x = Math.PI / 2;
    chinaGroup.add(chinaSlab);

    // 金黄色温暖漫射光晕
    const glowCircleGeom = new THREE.RingGeometry(0.76, 1.05, 32);
    const glowCircleMat = new THREE.MeshBasicMaterial({
      color: 0xE6B84A,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
    });
    const glowCircle = new THREE.Mesh(glowCircleGeom, glowCircleMat);
    chinaGroup.add(glowCircle);

    globeGroup.add(chinaGroup);

    // 5. 球体上散落的手捏 3D 定格山峦与松树 (Procedural Mountains & Trees)
    const landscapeGroup = new THREE.Group();

    // 在青藏高原与大理苍山位置种上手捏小山峰
    const mountain1 = createClayMountain(0.22);
    const posMount1 = latLonToVector3(32, 92, earthRadius + 0.02);
    mountain1.position.copy(posMount1);
    mountain1.lookAt(posMount1.clone().multiplyScalar(2));
    mountain1.rotateX(Math.PI / 2);
    landscapeGroup.add(mountain1);

    const mountain2 = createClayMountain(0.18);
    const posMount2 = latLonToVector3(26, 100, earthRadius + 0.02);
    mountain2.position.copy(posMount2);
    mountain2.lookAt(posMount2.clone().multiplyScalar(2));
    mountain2.rotateX(Math.PI / 2);
    landscapeGroup.add(mountain2);

    // 在安吉竹林、四川盆地种上手捏黏土树
    const tree1 = createClayTree(0.16);
    const posTree1 = latLonToVector3(30, 119, earthRadius + 0.02);
    tree1.position.copy(posTree1);
    tree1.lookAt(posTree1.clone().multiplyScalar(2));
    tree1.rotateX(Math.PI / 2);
    landscapeGroup.add(tree1);

    const tree2 = createClayTree(0.14);
    const posTree2 = latLonToVector3(29, 103, earthRadius + 0.02);
    tree2.position.copy(posTree2);
    tree2.lookAt(posTree2.clone().multiplyScalar(2));
    tree2.rotateX(Math.PI / 2);
    landscapeGroup.add(tree2);

    globeGroup.add(landscapeGroup);

    // 6. 环绕公转的手捏陶土月球伴星
    const moonOrbitGroup = new THREE.Group();
    const clayMoon = createClayMoon();
    clayMoon.position.set(3.0, 0.6, -0.5);
    moonOrbitGroup.add(clayMoon);
    scene.add(moonOrbitGroup);

    // 7. 定格手捏蓬松白泥小云团
    const cloudsGroup = new THREE.Group();
    for (let c = 0; c < 8; c++) {
      const angle = (c / 8) * Math.PI * 2;
      const dist = earthRadius + 0.52 + Math.sin(c * 3) * 0.15;
      const cy = Math.cos(c * 2) * 0.85;

      const cloudComposite = new THREE.Group();
      const cloudMat = new THREE.MeshStandardMaterial({
        color: 0xFAF5E8,
        roughness: 0.95,
      });

      // 3 个手捏小泥球并排捏成一朵云
      const b1 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.11, 1), cloudMat);
      const b2 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.15, 1), cloudMat);
      b2.position.set(0.12, 0.03, 0);
      const b3 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.10, 1), cloudMat);
      b3.position.set(0.24, -0.02, 0);
      cloudComposite.add(b1, b2, b3);

      cloudComposite.position.set(Math.cos(angle) * dist, cy, Math.sin(angle) * dist);
      cloudComposite.scale.set(0.9, 0.9, 0.9);
      cloudsGroup.add(cloudComposite);
    }
    globeGroup.add(cloudsGroup);

    // 8. 图钉与震荡波总组
    const pinsGroup = new THREE.Group();
    globeGroup.add(pinsGroup);
    pinsGroupRef.current = pinsGroup;

    const ripplesGroup = new THREE.Group();
    globeGroup.add(ripplesGroup);
    ripplesGroupRef.current = ripplesGroup;

    // 9. 鼠标与触摸交互
    const handleMouseDown = (e: MouseEvent) => {
      isDraggingRef.current = true;
      isTargetingRef.current = false;
      prevMouseRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      if (isDraggingRef.current && globeGroupRef.current) {
        const deltaX = e.clientX - prevMouseRef.current.x;
        const deltaY = e.clientY - prevMouseRef.current.y;

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

    // 10. 定格动画 12FPS 步进动画主循环 (Stop-Motion Framerate Stepping)
    let reqId = 0;
    const clock = new THREE.Clock();
    let stopMotionAccum = 0;
    const stopMotionInterval = 1 / 14; // 约 14 帧/秒 定格质感

    const animate = () => {
      const delta = clock.getDelta();
      const now = performance.now();
      stopMotionAccum += delta;

      // 目标点位平滑插值旋转
      if (isTargetingRef.current && targetQuaternionRef.current && globeGroupRef.current) {
        globeGroupRef.current.quaternion.slerp(targetQuaternionRef.current, Math.min(1, delta * 4.5));
        if (globeGroupRef.current.quaternion.angleTo(targetQuaternionRef.current) < 0.01) {
          isTargetingRef.current = false;
        }
      } else if (!isDraggingRef.current && globeGroupRef.current) {
        // 定格动画抽帧旋转节奏（模拟逐帧拍摄微动）
        if (stopMotionAccum >= stopMotionInterval) {
          stopMotionAccum = 0;
          const frameStep = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.0035);
          globeGroupRef.current.quaternion.premultiply(frameStep);
        }
      }

      // 月球伴星轻柔公转与自转
      moonOrbitGroup.rotation.y += delta * 0.07;
      clayMoon.rotation.y += delta * 0.18;

      // 定格微云飘动
      cloudsGroup.rotation.y -= delta * 0.04;

      // 新落图钉的物理下落与回弹动画
      if (dropAnimRef.current) {
        const { startTime, pinGroup, rippleMesh } = dropAnimRef.current;
        const elapsed = (now - startTime) / 1000;

        if (pinGroup) {
          const earthR = 2.0;
          if (elapsed < 0.9) {
            const bounce = Math.sin(elapsed * 16) * Math.exp(-elapsed * 5.0) * 0.45;
            const dropAltitude = earthR + 0.06 + Math.max(0, bounce) + (elapsed < 0.22 ? (0.22 - elapsed) * 2.5 : 0);
            const dir = pinGroup.position.clone().normalize();
            pinGroup.position.copy(dir.multiplyScalar(dropAltitude));
          } else {
            const dir = pinGroup.position.clone().normalize();
            pinGroup.position.copy(dir.multiplyScalar(earthR + 0.06));
          }
        }

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

      // 学习参考视频的镜头聚焦推进动效：点击图钉时相机顺滑推进，关闭时拉远恢复全景
      const targetZ = selectedPinRef.current ? 4.35 : 5.4;
      camera.position.z = THREE.MathUtils.damp(camera.position.z, targetZ, 3.2, delta);

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
      clayAlbedo.dispose();
      clayNormal.dispose();
      renderer.dispose();
    };
  }, [onSelectPin]);

  // 11. 动态生成 3D 泥塑图钉 Mesh
  useEffect(() => {
    const pinsGroup = pinsGroupRef.current;
    const ripplesGroup = ripplesGroupRef.current;
    if (!pinsGroup || !ripplesGroup) return;

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
      const pinPos = latLonToVector3(pin.lat, pin.lon, earthRadius + 0.06);

      const pinGroup = new THREE.Group();
      pinGroup.position.copy(pinPos);
      pinGroup.lookAt(pinPos.clone().multiplyScalar(2));
      pinGroup.userData.pinData = pin;

      const isTeacher = pin.role === 'TEACHER';
      // 真实软陶色号：红陶色、鼠尾草绿陶色、芥末黄泥色
      const headColor = isTeacher ? 0xD47A6A : (index % 2 === 0 ? 0xC38D9E : 0xE6B84A);

      // (1) 手捏泥塑球头（带微凹凸软陶手捏感）
      const headGeom = new THREE.DodecahedronGeometry(0.105, 2);
      const headMat = new THREE.MeshStandardMaterial({
        color: headColor,
        roughness: 0.82,
        metalness: 0.05,
      });
      const headMesh = new THREE.Mesh(headGeom, headMat);
      headMesh.position.set(0, 0, 0.15);
      headMesh.userData.pinData = pin;
      pinGroup.add(headMesh);

      // (2) 竹签 / 金属牙签细针身
      const needleGeom = new THREE.CylinderGeometry(0.016, 0.006, 0.16, 8);
      const needleMat = new THREE.MeshStandardMaterial({
        color: 0x4A3525, // 细竹木棕色
        roughness: 0.75,
        metalness: 0.15,
      });
      const needleMesh = new THREE.Mesh(needleGeom, needleMat);
      needleMesh.rotation.x = Math.PI / 2;
      needleMesh.position.set(0, 0, 0.07);
      needleMesh.userData.pinData = pin;
      pinGroup.add(needleMesh);

      // (3) 底座橡皮泥小团底托
      const baseBlobGeom = new THREE.SphereGeometry(0.05, 12, 12);
      const baseBlobMat = new THREE.MeshStandardMaterial({
        color: 0x7FA389,
        roughness: 0.9,
      });
      const baseBlob = new THREE.Mesh(baseBlobGeom, baseBlobMat);
      baseBlob.scale.set(1.4, 1.4, 0.5);
      pinGroup.add(baseBlob);

      // (4) 3D 手绘撕纸旗标牌
      const labelTexture = createPinLabelTexture(pin.city, pin.name, isTeacher);
      const labelMat = new THREE.SpriteMaterial({
        map: labelTexture,
        transparent: true,
      });
      const labelSprite = new THREE.Sprite(labelMat);
      labelSprite.scale.set(0.72, 0.24, 1);
      labelSprite.position.set(0, 0.20, 0.20);
      labelSprite.userData.pinData = pin;
      pinGroup.add(labelSprite);

      pinsGroup.add(pinGroup);

      // (5) 为新图钉绑定震荡波
      if (isNewDrop) {
        const rippleGeom = new THREE.RingGeometry(0.08, 0.18, 32);
        const rippleMat = new THREE.MeshBasicMaterial({
          color: 0xE6B84A,
          transparent: true,
          opacity: 0.75,
          side: THREE.DoubleSide,
        });
        const rippleMesh = new THREE.Mesh(rippleGeom, rippleMat);
        rippleMesh.position.copy(pinPos);
        rippleMesh.lookAt(pinPos.clone().multiplyScalar(2));
        ripplesGroup.add(rippleMesh);

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
      <div 
        ref={mountRef} 
        className="w-full h-full cursor-grab active:cursor-grabbing" 
      />

      {/* 悬停微卡片提示 */}
      {hoveredPin && (
        <div
          className="absolute z-30 pointer-events-none transform -translate-x-1/2 -translate-y-full mb-3"
          style={{ left: `${hoveredPin.x}px`, top: `${hoveredPin.y - 14}px` }}
        >
          <div className="clay-card px-4 py-2.5 flex items-center gap-2.5 whitespace-nowrap shadow-2xl">
            <span className="text-xl">📍</span>
            <div>
              <div className="font-bold text-sm text-[#1E3824]">{hoveredPin.pin.city}</div>
              <div className="text-[#52796F] text-xs font-serif">{hoveredPin.pin.name}</div>
            </div>
          </div>
        </div>
      )}

      {/* 底部黏土印章互动指引徽章（学习参考视频：置于底部中央，保证中央 3D 球体 100% 无任何遮挡） */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 pointer-events-none flex items-center gap-2 clay-card px-4 py-1.5 text-xs text-[#52796F] whitespace-nowrap shadow-md">
        <span className="text-sm">🖐️</span>
        <span className="font-bold text-[#1E3824]">拖拽旋转定格黏土星球</span>
        <span>·</span>
        <span>📍 轻触图钉推进视角</span>
      </div>
    </div>
  );
}
