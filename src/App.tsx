import { useCallback, useEffect, useRef, useState } from 'react';
import OpeningVideo from './components/OpeningVideo';
import LightChase from './components/LightChase';
import MainLawn from './components/MainLawn';
import BookSpread from './components/BookSpread';
import WorkSheet from './components/WorkSheet';
import RegionDialog from './components/RegionDialog';
import RoleDialog from './components/RoleDialog';
import XingzhiStudio from './components/XingzhiStudio';
import PinBurst from './components/PinBurst';
import { loadSavedPins, loadSavedWorks, savePins, saveWorks } from './data/initialWorks';
import type { LocationChoice, PinItem, SubmissionPayload, WorkItem } from './types';
import { storySound } from './utils/sound';
import { analyzeLesson, analyzeLessonSync } from './utils/aiLesson';

/** 四阶段时间轴：开场 → 追光 → 主场景 → 沉浸交互 */
type Step = 'INTRO' | 'CHASE' | 'LAWN';

// 《古墓丽影》风格文物数据库（新增）
const artifactDatabase: Record<string, {
  titleCn: string;
  titleEn: string;
  region: string;
  style: string;
  desc: string;
  color: number;
}> = {
  pavilion: {
    titleCn: '中式开放水榭凉亭',
    titleEn: 'Chinese Open-Air Water Pavilion',
    region: '亚洲 · 中国江南水乡与西南侗寨',
    style: '传统木构榫卯 · 歇山飞檐翼角',
    desc: '四面通透敞开，设有美人靠雕花围栏与穿斗式梁柱。飞檐起翘如鸟翼，夜幕下悬挂暖光八角宫灯，倒映于清幽水面之上。',
    color: 0xd59b57
  },
  arch: {
    titleCn: '古罗马科林斯石柱拱门',
    titleEn: 'Greco-Roman Colonnade Arch',
    region: '欧洲 · 地中海古典文明',
    style: '古典柱式架构 · 大理石凿刻拱券',
    desc: '采用精美复合柱头，石质厚重温润。圆拱两侧环绕着常春藤蔓，象征时间与古文明的永恒对话。',
    color: 0xd8d4cb
  },
  opera: {
    titleCn: '悉尼歌剧院帆影拱顶',
    titleEn: 'Sydney Opera House Vaulted Sails',
    region: '大洋洲 · 澳大利亚悉尼海湾',
    style: '现代表现主义 · 仿生贝壳薄壳结构',
    desc: '约恩·乌松设计的世界文化遗产。层叠交错的风帆状薄壳如白珍珠贝母般排列，迎风展翅于海港水畔。',
    color: 0xf0f3f6
  }
};

export default function App() {
  // 原有状态：全量保留
  const [step, setStep] = useState<Step>(() =>
    typeof window !== 'undefined' && ['#lawn', '#note', '#album', '#studio'].includes(window.location.hash)
      ? 'LAWN'
      : 'INTRO'
  );
  const [chaseAlive, setChaseAlive] = useState(false);
  const [pins, setPins] = useState<PinItem[]>(() => loadSavedPins());
  const [works, setWorks] = useState<WorkItem[]>(() => loadSavedWorks());

  // 原有大模型教案雷达图逻辑：全量保留
  useEffect(() => {
    setWorks((prev) => {
      let changed = false;
      const next = prev.map((w) => {
        if (w.role === 'TEACHER' && !w.radar) {
          changed = true;
          return { ...w, radar: analyzeLessonSync(w.content) };
        }
        return w;
      });
      return changed ? next : prev;
    });
  }, []);

  const [globeOpen, setGlobeOpen] = useState(false);
  const [target, setTarget] = useState<{ lat: number; lon: number } | null>(null);
  const [newPinId, setNewPinId] = useState<string | null>(null);

  const [book, setBook] = useState<'note' | 'album' | null>(() =>
    typeof window !== 'undefined' && (window.location.hash === '#note' || window.location.hash === '#album')
      ? window.location.hash === '#note' ? 'note' : 'album'
      : null
  );
  const [sheet, setSheet] = useState<WorkItem | null>(null);

  const [studio, setStudio] = useState<boolean>(
    () => typeof window !== 'undefined' && window.location.hash === '#studio'
  );

  const [regionOpen, setRegionOpen] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);
  const [draftLoc, setDraftLoc] = useState<LocationChoice | null>(null);
  const [burst, setBurst] = useState(false);
  const [burstAt, setBurstAt] = useState<{ x: number; y: number } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // 新增：3D 文物全景检视器激活状态
  const [activeArtifactKey, setActiveArtifactKey] = useState<string | null>(null);
  const viewerMountRef = useRef<HTMLDivElement>(null);

  const timers = useRef<number[]>([]);
  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);

  useEffect(() => {
    const t = timers.current;
    return () => t.forEach((id) => window.clearTimeout(id));
  }, []);

  useEffect(() => {
    if (!studio) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setStudio(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [studio]);

  useEffect(() => {
    saveWorks(works);
  }, [works]);

  useEffect(() => {
    savePins(pins);
  }, [pins]);

  const say = (msg: string) => {
    setToast(msg);
    later(() => setToast(null), 4200);
  };

  /* ---------------- 上传课题全流程：全量保留 ---------------- */
  const openUpload = () => {
    storySound.playPaperTurn();
    setRegionOpen(true);
  };

  const confirmLocation = (
    coord: { lat: number; lon: number },
    locationString: string,
    details: { province: string; city: string; district: string }
  ) => {
    setRegionOpen(false);
    setDraftLoc({ ...details, lat: coord.lat, lon: coord.lon, locationString });
    setGlobeOpen(true);
    setTarget(coord);

    later(() => {
      const id = `draft-${Date.now()}`;
      setPins((prev) => [
        {
          id,
          name: `童眼看${details.district}`,
          city: locationString,
          lat: coord.lat,
          lon: coord.lon,
          school: '行智开物工作站',
          desc: `已落钉，正在为【${locationString}】录入成果`,
          role: 'STUDENT',
          date: '刚刚落钉',
        },
        ...prev.filter((p) => !p.id.startsWith('draft-')),
      ]);
      setNewPinId(id);
      setBurst(true);
      later(() => setBurst(false), 1350);
      later(() => setNewPinId(null), 3200);
      later(() => setRoleOpen(true), 2350);
    }, 780);
  };

  const submitWork = (payload: SubmissionPayload) => {
    const pin: PinItem = {
      id: `pin-${payload.id}`,
      name: payload.title,
      city: payload.region,
      lat: payload.lat,
      lon: payload.lon,
      school: payload.school,
      role: payload.role,
      author: payload.author,
      date: payload.date,
      desc: payload.content.slice(0, 96) + (payload.content.length > 96 ? '…' : ''),
    };

    const work: WorkItem = {
      ...payload,
      id: `pin-${payload.id}`,
      region: payload.region,
      likes: 1,
      comments: [
        {
          id: `c-${Date.now()}`,
          user: '行智开物导师',
          text: `已归档至课桌，童眼看 ${payload.district} 又多了一份实践。`,
          time: '刚刚',
        },
      ],
      radar: payload.radar,
    };

    setPins((prev) => [pin, ...prev.filter((p) => !p.id.startsWith('draft-'))]);
    setNewPinId(pin.id);
    setWorks((prev) => [work, ...prev]);

    if (payload.role === 'TEACHER' && payload.radar?.source !== 'ai') {
      analyzeLesson(payload.content)
        .then((analysis) => {
          setWorks((prev) => prev.map((w) => (w.id === work.id ? { ...w, radar: analysis } : w)));
        })
        .catch(() => {});
    }

    setRoleOpen(false);
    setGlobeOpen(false);
    later(() => setNewPinId(null), 2400);
    say(`图钉已定格 · 童眼看 ${payload.district}`);
  };

  const openPin = (pin: PinItem) => {
    const district = pin.city.split('·').pop() ?? '';
    const hit =
      works.find((w) => w.id === pin.id) ??
      works.find((w) => w.city === pin.city && w.district === district) ??
      works.find((w) => w.title === pin.name);
    if (hit) {
      setSheet(hit);
      return;
    }
    say(`这里还没有成果，${pin.name}`);
  };

  const replay = () => {
    setGlobeOpen(false);
    setBook(null);
    setSheet(null);
    setRegionOpen(false);
    setRoleOpen(false);
    setBurst(false);
    setChaseAlive(false);
    setStep('INTRO');
  };

  // 新增：渲染 3D 检视器引擎
  useEffect(() => {
    if (!activeArtifactKey || !viewerMountRef.current) return;

    let renderer: any, scene: any, camera: any, meshGroup: any, animId: number;

    const setupThreeViewer = () => {
      const container = viewerMountRef.current;
      if (!container) return;
      const THREE = (window as any).THREE;
      if (!THREE) return;

      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
      camera.position.set(0, 1.8, 6.5);

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(container.clientWidth, container.clientHeight);
      renderer.setPixelRatio(window.devicePixelRatio);
      container.appendChild(renderer.domElement);

      const OrbitControls = (window as any).THREE.OrbitControls;
      let controls: any;
      if (OrbitControls) {
        controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
      }

      scene.add(new THREE.AmbientLight(0xfff5e6, 0.7));
      const dirLight = new THREE.DirectionalLight(0xffecd2, 1.3);
      dirLight.position.set(5, 8, 5);
      scene.add(dirLight);

      meshGroup = new THREE.Group();
      const currentData = artifactDatabase[activeArtifactKey];
      const toonMat = new THREE.MeshToonMaterial({ color: currentData.color });

      if (activeArtifactKey === 'pavilion') {
        const roof = new THREE.Mesh(new THREE.ConeGeometry(2, 1.2, 4), toonMat);
        roof.position.y = 1.1;
        roof.rotation.y = Math.PI / 4;
        const base = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.8, 0.35, 8), toonMat);
        base.position.y = -1;
        meshGroup.add(roof, base);
      } else if (activeArtifactKey === 'opera') {
        for (let i = 0; i < 3; i++) {
          const sail = new THREE.Mesh(new THREE.ConeGeometry(1.3 - i * 0.28, 2.2 - i * 0.35, 3), toonMat);
          sail.position.set(-0.7 + i * 0.7, -0.2 + i * 0.2, i * 0.18);
          sail.rotation.z = -0.3;
          meshGroup.add(sail);
        }
      } else {
        const arch = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.24, 8, 24, Math.PI), toonMat);
        arch.position.y = 0.5;
        const p1 = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 2, 12), toonMat);
        p1.position.set(-1.2, -0.5, 0);
        const p2 = p1.clone();
        p2.position.set(1.2, -0.5, 0);
        meshGroup.add(arch, p1, p2);
      }

      scene.add(meshGroup);

      const renderLoop = () => {
        animId = requestAnimationFrame(renderLoop);
        if (controls) controls.update();
        if (meshGroup) meshGroup.rotation.y += 0.003;
        renderer.render(scene, camera);
      };
      renderLoop();
    };

    if (!(window as any).THREE) {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
      script.onload = () => {
        const controlScript = document.createElement('script');
        controlScript.src = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js';
        controlScript.onload = setupThreeViewer;
        document.head.appendChild(controlScript);
      };
      document.head.appendChild(script);
    } else {
      setupThreeViewer();
    }

    return () => {
      cancelAnimationFrame(animId);
      if (renderer && renderer.domElement) {
        renderer.domElement.remove();
      }
    };
  }, [activeArtifactKey]);

  const modalOpen = book !== null || sheet !== null;
  const currentArtifact = activeArtifactKey ? artifactDatabase[activeArtifactKey] : null;

  return (
    <>
      {/* 阶段 1：开场视频全量保留 */}
      {step === 'INTRO' && (
        <OpeningVideo
          onComplete={() => {
            setChaseAlive(true);
            setStep('CHASE');
          }}
        />
      )}

      {/* 阶段 3 / 4：主场景（长凳、草坪与地球仪） */}
      {step !== 'INTRO' && (
        <MainLawn
          pins={pins}
          works={works}
          globeOpen={globeOpen}
          globeChrome={globeOpen && !roleOpen && !regionOpen}
          onToggleGlobe={() => {
            storySound.playPaperTurn();
            setGlobeOpen((v) => !v);
          }}
          activeTargetCoord={target}
          newlyDroppedPinId={newPinId}
          onPinAnchor={setBurstAt}
          onOpenBook={(b) => {
            storySound.playPaperTurn();
            setBook(b);
          }}
          onOpenUpload={openUpload}
          onOpenStudio={() => {
            storySound.playPaperTurn();
            setStudio(true);
          }}
          onSelectPin={openPin}
          onReplay={replay}
          onInspectArtifact={(key: string) => setActiveArtifactKey(key)}
        />
      )}

      {/* 工作台全量保留 */}
      {studio && (
        <XingzhiStudio
          onClose={() => {
            storySound.playPaperTurn();
            setStudio(false);
          }}
          onSync={(filled) => {
            say(
              filled >= 4
                ? '四维打磨记录与童眼作品已同步至行智开物主平台【学生个人数字资产包】'
                : `已同步 ${filled} 维记录，补齐四维才会生成完整作品档案`
            );
          }}
        />
      )}

      {/* 阶段 2：追光全量保留 */}
      {chaseAlive && (
        <LightChase
          onReveal={() => setStep('LAWN')}
          onDone={() => setChaseAlive(false)}
        />
      )}

      {/* 翻书与作品详情全量保留 */}
      {book && (
        <BookSpread
          book={book}
          works={works}
          onClose={() => setBook(null)}
          onOpenWork={(w) => setSheet(w)}
        />
      )}

      {sheet && (
        <WorkSheet
          work={sheet}
          onClose={() => setSheet(null)}
          onLike={(id) =>
            setWorks((prev) =>
              prev.map((w) => (w.id === id ? { ...w, likes: w.likes + 1 } : w))
            )
          }
          onComment={(id, text) =>
            setWorks((prev) =>
              prev.map((w) =>
                w.id === id
                  ? {
                      ...w,
                      comments: [
                        ...w.comments,
                        { id: `c-${Date.now()}`, user: '同行学者', text, time: '刚刚' },
                      ],
                    }
                  : w
              )
            )
          }
        />
      )}

      {regionOpen && !modalOpen && (
        <RegionDialog onClose={() => setRegionOpen(false)} onConfirm={confirmLocation} />
      )}

      {roleOpen && draftLoc && (
        <RoleDialog
          location={draftLoc}
          onClose={() => {
            setRoleOpen(false);
            say('图钉已留在球面上，随时可以补上成果');
          }}
          onSubmit={submitWork}
        />
      )}

      {burst && <PinBurst at={burstAt} />}

      {/* 新增：《古墓丽影》风格 3D 文物全局检视弹窗 */}
      {currentArtifact && (
        <div className="tr-modal-overlay" onClick={() => setActiveArtifactKey(null)}>
          <div className="tr-modal-container" onClick={(e) => e.stopPropagation()}>
            <aside className="tr-info-panel">
              <div className="tr-panel-tag">ARTIFACT ARCHIVE · 文物档案</div>
              <h2 className="tr-title-cn">{currentArtifact.titleCn}</h2>
              <div className="tr-title-en">{currentArtifact.titleEn}</div>

              <div className="tr-meta-grid">
                <div className="meta-item">
                  <span className="meta-label">地理区域 / Region</span>
                  <span className="meta-val">{currentArtifact.region}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">建筑风格 / Style</span>
                  <span className="meta-val">{currentArtifact.style}</span>
                </div>
              </div>

              <div className="tr-description-box">
                <div className="desc-heading">造型与工艺特征 / Features</div>
                <p className="desc-content">{currentArtifact.desc}</p>
              </div>

              <div className="tr-tip-note">
                <span>🖱️ 按住鼠标左键/右键拖拽可 360° 旋转观察，滚轮可缩放细节</span>
              </div>
            </aside>

            <main className="tr-viewer-viewport" ref={viewerMountRef}>
              <button className="tr-close-btn" onClick={() => setActiveArtifactKey(null)}>
                ✕ 关闭
              </button>
            </main>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
