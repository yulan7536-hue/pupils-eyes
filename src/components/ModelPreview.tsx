/**
 * 3D 摆件的预览确认框。
 *
 * 用一个独立的小渲染器把 glb 转起来，用户能拖拽从各个角度看，
 * 确认造型没问题再放进花园（3D 生成一次要几分钟，值得多看一眼）。
 */
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { Model3DItem } from '../utils/modelStore';

interface ModelPreviewProps {
  item: Model3DItem;
  onConfirm: () => void;
  onRetry: () => void;
  onDiscard: () => void;
}

export default function ModelPreview({ item, onConfirm, onRetry, onDiscard }: ModelPreviewProps) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    const w = el.clientWidth || 360;
    const h = el.clientHeight || 260;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, w / h, 0.1, 100);
    camera.position.set(0, 1.7, 5.4);
    camera.lookAt(0, 0.9, 0);

    scene.add(new THREE.AmbientLight(0xfff9ef, 1.1));
    const d1 = new THREE.DirectionalLight(0xffffff, 1.5);
    d1.position.set(3, 6, 5);
    scene.add(d1);
    const d2 = new THREE.DirectionalLight(0xffe8cf, 0.7);
    d2.position.set(-4, 2, -3);
    scene.add(d2);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.minDistance = 2.5;
    controls.maxDistance = 9;
    controls.target.set(0, 0.9, 0);
    // 进场先自转半圈，让用户看到这是立体的
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.6;

    let disposed = false;
    const url = URL.createObjectURL(item.glb);
    new GLTFLoader().load(
      url,
      (gltf) => {
        URL.revokeObjectURL(url);
        if (disposed) return;
        const obj = gltf.scene;
        const box = new THREE.Box3().setFromObject(obj);
        const size = new THREE.Vector3();
        box.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        obj.scale.setScalar(2.4 / maxDim);
        const box2 = new THREE.Box3().setFromObject(obj);
        const center = new THREE.Vector3();
        box2.getCenter(center);
        obj.position.x -= center.x;
        obj.position.z -= center.z;
        obj.position.y -= box2.min.y;
        scene.add(obj);
      },
      undefined,
      (err) => {
        URL.revokeObjectURL(url);
        console.warn('[modelPreview] 模型加载失败', err);
      }
    );

    let animId = 0;
    const tick = () => {
      animId = requestAnimationFrame(tick);
      controls.update();
      renderer.render(scene, camera);
    };
    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(animId);
      controls.dispose();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat?.dispose();
      });
      renderer.dispose();
      if (renderer.domElement.parentElement === el) el.removeChild(renderer.domElement);
    };
  }, [item]);

  return (
    <div className="sticker-preview" role="dialog" aria-modal="true" aria-label="3D 摆件预览">
      <div className="sticker-preview__card">
        <button type="button" className="sticker-preview__close" onClick={onDiscard} aria-label="关闭">
          <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
            <path d="M3 3l12 12M15 3L3 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>

        <h3 className="sticker-preview__title">3D 摆件做好啦</h3>
        <p className="sticker-preview__sub">拖动可以转着看看，确认了就摆进花园</p>

        <div className="sticker-preview__stage sticker-preview__stage--3d" ref={mountRef} />

        <div className="sticker-preview__actions">
          <button type="button" className="sticker-preview__primary" onClick={onConfirm}>
            摆进花园
          </button>
          <button type="button" className="sticker-preview__ghost" onClick={onRetry}>
            换一张照片
          </button>
        </div>
      </div>
    </div>
  );
}
