import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import OpeningVideo from './components/OpeningVideo';
import LightChase from './components/LightChase';
import MainLawn from './components/MainLawn';
import BookSpread from './components/BookSpread';
import WorkSheet from './components/WorkSheet';
import RegionDialog from './components/RegionDialog';
import RoleDialog from './components/RoleDialog';
import CollageScene from './components/CollageScene';
import PinBurst from './components/PinBurst';
import LoginDialog from './auth/LoginDialog';
import { useAuth } from './auth/useAuth';
import AdminGate from './admin/AdminGate';
import AdminConsole from './admin/AdminConsole';
import { loadSavedPins, loadSavedWorks, savePins, saveWorks } from './data/initialWorks';
import {
  addComment,
  createWork,
  getWorkImage,
  listComments,
  listMyLikes,
  listWorks,
  toggleLike,
  type CloudWork,
} from './utils/worksStore';
import type { LocationChoice, PinItem, SubmissionPayload, WorkItem } from './types';
import { storySound } from './utils/sound';
import { analyzeLesson, analyzeLessonSync } from './utils/aiLesson';
import { bumpTask } from './utils/stickerStore';
import { buildArtifact, buildLightRig } from './three/artifactModels';
import type { ArtifactKey } from './three/artifactModels';

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

/**
 * 作品 → 地球仪上的图钉。
 * 图钉原本是独立存的一份数据，上云后统一从作品派生：一门课只有一份真相，
 * 不会出现「球上有钉、相册里没有」这种两处不同步的情况。
 */
function pinsFromWorks(works: WorkItem[]): PinItem[] {
  return works.map((w) => ({
    id: w.id,
    name: w.title,
    city: w.region,
    lat: w.lat,
    lon: w.lon,
    school: w.school,
    desc: w.content.slice(0, 96) + (w.content.length > 96 ? '…' : ''),
    author: w.author,
    role: w.role,
    date: w.date,
  }));
}

export default function App() {
  const { requireAuth, status, label } = useAuth();

  // 原有状态：全量保留
  const [step, setStep] = useState<Step>(() =>
    typeof window !== 'undefined' && ['#lawn', '#note', '#album', '#collage', '#admin'].includes(window.location.hash)
      ? 'LAWN'
      : 'INTRO'
  );
  const [chaseAlive, setChaseAlive] = useState(false);
  const [pins, setPins] = useState<PinItem[]>(() => loadSavedPins());
  const [works, setWorks] = useState<WorkItem[]>(() => loadSavedWorks());

  /**
   * 球面上哪些灯是亮的。
   * 灯的 id 与它对应的成果 id 一致（都是 `pin-…`），所以这里只要从 works 里
   * 捞出被点亮的那几份，地球仪就知道该让哪盏灯发光。
   */
  const litPinIds = useMemo(
    () => new Set(works.filter((w) => w.lit).map((w) => w.id)),
    [works]
  );

  /**
   * 从云端拉作品库。
   *
   * 登录态一变就重拉：RLS 决定「能看到哪些」——匿名只看得到审核通过的，
   * 登录后自己的待审稿会一起回来。拉不到（离线/域名不对）就继续用本地缓存，
   * 不白屏，这是能离线看的前提。
   */
  useEffect(() => {
    if (status === 'loading') return;
    let alive = true;

    void (async () => {
      try {
        const [remote, liked] = await Promise.all([
          listWorks(),
          // 只读自己的点赞：匿名时表里也读不到任何行（策略只给登录用户）
          status === 'authed' ? listMyLikes().catch(() => new Set<string>()) : Promise.resolve(new Set<string>()),
        ]);
        if (!alive) return;
        const merged = remote.map((w) => ({ ...w, lit: liked.has(w.id) }));
        setWorks(merged);
        setPins((prev) => [
          ...pinsFromWorks(merged),
          ...prev.filter((p) => p.id.startsWith('draft-')),
        ]);
      } catch (err) {
        console.warn('[works] 云端读取失败，继续用本地缓存', err);
      }
    })();

    return () => {
      alive = false;
    };
  }, [status]);

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

  const [globeOpen, setGlobeOpen] = useState(false);  const [target, setTarget] = useState<{ lat: number; lon: number } | null>(null);
  const [newPinId, setNewPinId] = useState<string | null>(null);

  const [book, setBook] = useState<'note' | 'album' | null>(() =>
    typeof window !== 'undefined' && (window.location.hash === '#note' || window.location.hash === '#album')
      ? window.location.hash === '#note' ? 'note' : 'album'
      : null
  );
  const [sheet, setSheet] = useState<WorkItem | null>(null);

  // 拼贴花园模式
  const [collageOpen, setCollageOpen] = useState<boolean>(
    () => typeof window !== 'undefined' && window.location.hash === '#collage'
  );

  // 开发者后台：隐藏入口（标题连点 5 次，或直接 #admin）
  const [adminOpen, setAdminOpen] = useState<boolean>(
    () => typeof window !== 'undefined' && window.location.hash === '#admin'
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
    // 写操作要身份：未登录先弹登录框，登录成功后自动把这一步续上
    requireAuth(() => {
      storySound.playPaperTurn();
      setRegionOpen(true);
    });
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
          desc: `已点亮一盏小灯，正在为【${locationString}】录入成果`,
          role: 'STUDENT',
          date: '刚刚点亮',
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

  /**
   * 提交一份成果/课题。
   *
   * 先落云端，成功后才更新界面——反过来的话网络一失败，用户就会看到一条
   * 「看起来发出去了、刷新就没了」的幽灵记录。数据库那边 RLS 强制 pending，
   * 所以这份东西只有作者自己看得到，等后台审核通过才出现在公开列表里。
   */
  const submitWork = async (payload: SubmissionPayload, image?: File | null): Promise<boolean> => {
    const draftPin: PinItem = {
      id: `draft-${payload.id}`,
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

    say('正在归档…');

    let created: CloudWork;
    try {
      created = await createWork({ payload, image });
    } catch (err) {
      say(err instanceof Error ? err.message : '归档失败，请稍后再试');
      return false;
    }

    const pin = { ...draftPin, id: created.id };

    setPins((prev) => [pin, ...prev.filter((p) => !p.id.startsWith('draft-') && p.id !== created.id)]);
    setWorks((prev) => [created, ...prev.filter((w) => w.id !== created.id)]);
    setNewPinId(pin.id);
    setRoleOpen(false);
    setGlobeOpen(false);

    if (payload.role === 'TEACHER' && payload.radar?.source !== 'ai') {
      analyzeLesson(payload.content)
        .then((analysis) => {
          setWorks((prev) => prev.map((w) => (w.id === created.id ? { ...w, radar: analysis } : w)));
        })
        .catch(() => {});
    }

    later(() => setNewPinId(null), 2400);
    say(`已提交审核 · 童眼看 ${payload.district} · 通过后所有人可见`);
    return true;
  };

  const openPin = (pin: PinItem) => {
    const district = pin.city.split('·').pop() ?? '';
    const hit =
      works.find((w) => w.id === pin.id) ??
      works.find((w) => w.city === pin.city && w.district === district) ??
      works.find((w) => w.title === pin.name);
    if (!hit) {
      say(`这里还没有成果，${pin.name}`);
      return;
    }

    setSheet(hit);

    // 列表只带缩略图，点开这一刻才去取原图与评论 —— 否则一次要拉几十兆
    void (async () => {
      try {
        const [img, comments] = await Promise.all([
          getWorkImage(hit.id),
          listComments(hit.id).catch(() => [] as typeof hit.comments),
        ]);
        setWorks((prev) =>
          prev.map((w) =>
            w.id === hit.id ? { ...w, imageUrl: img ?? w.imageUrl, comments } : w
          )
        );
      } catch {
        /* 取不到就保持缩略图，不打断阅读 */
      }
    })();
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

    let renderer: any, scene: any, camera: any, animId: number;

    const setupThreeViewer = () => {
      const container = viewerMountRef.current;
      if (!container) return;

      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(42, container.clientWidth / container.clientHeight, 0.1, 1000);

      // WebGL 不可用（老设备 / 关闭硬件加速 / 无头环境）时不要抛错炸掉整个弹窗，
      // 降级成一张静态提示，左侧文物档案照常可读。
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      } catch (err) {
        console.warn('[artifact viewer] WebGL 不可用，已降级为文字档案', err);
        const tip = document.createElement('div');
        tip.className = 'tr-viewer-fallback';
        tip.textContent = '当前设备暂不支持 3D 预览 · 左侧档案仍可查看';
        container.appendChild(tip);
        return;
      }
      renderer.setSize(container.clientWidth, container.clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      container.appendChild(renderer.domElement);

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.06;
      controls.target.set(0, 0, 0);
      // 交给 OrbitControls 自转：用户一拖就停，松手后继续，不会和拖拽打架
      controls.autoRotate = true;
      controls.autoRotateSpeed = 1.0;
      controls.enablePan = false;

      scene.add(buildLightRig());

      const currentData = artifactDatabase[activeArtifactKey];
      const model = buildArtifact(activeArtifactKey as ArtifactKey, currentData.color);
      scene.add(model.group);
      scene.add(model.shadow);

      // 相机按外接球反解距离：三件文物尺寸差很多（亭子高瘦、拱门宽扁），
      // 写死机位必然有一件被裁，用 fov 反解才能都刚好占满画面。
      const fovRad = (camera.fov * Math.PI) / 180;
      const dist = (model.radius / Math.sin(fovRad / 2)) * 1.15;
      camera.position.set(dist * 0.14, dist * 0.18, dist * 0.97);
      camera.lookAt(0, 0, 0);
      controls.minDistance = dist * 0.55;
      controls.maxDistance = dist * 1.9;
      controls.update();

      const renderLoop = () => {
        animId = requestAnimationFrame(renderLoop);
        controls.update();
        renderer.render(scene, camera);
      };
      renderLoop();
    };

    // three 已随项目打包，无需再从 CDN 动态加载
    setupThreeViewer();

    return () => {
      cancelAnimationFrame(animId);
      if (renderer && renderer.domElement) {
        renderer.domElement.remove();
      }
    };
  }, [activeArtifactKey]);

  const modalOpen = book !== null || sheet !== null;
  /**
   * 详情页永远读 works 里的最新那份，而不是点击瞬间的快照。
   * 否则"点亮"之后卡片上的灯还暗着、数字也不动，得关掉再开才刷新。
   */
  const sheetWork = sheet ? works.find((w) => w.id === sheet.id) ?? sheet : null;
  const currentArtifact = activeArtifactKey ? artifactDatabase[activeArtifactKey] : null;

  // 后台是另一个界面：整屏接管，不需要开场动画、地球仪和 3D 场景
  if (adminOpen) {
    return (
      <AdminGate>{(password) => <AdminConsole password={password} />}</AdminGate>
    );
  }

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
          litPinIds={litPinIds}
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
            bumpTask('read');
            setBook(b);
          }}
          onOpenUpload={openUpload}
          onOpenCollage={() => {
            requireAuth(() => {
              storySound.playPaperTurn();
              setCollageOpen(true);
            });
          }}
          onSelectPin={openPin}
          onReplay={replay}
          onInspectArtifact={(key: string) => setActiveArtifactKey(key)}
          onOpenAdmin={() => setAdminOpen(true)}
        />
      )}

      {/* 拼贴花园模式 */}
      {collageOpen && (
        <CollageScene
          onClose={() => {
            storySound.playPaperTurn();
            setCollageOpen(false);
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

      {sheetWork && (
        <WorkSheet
          work={sheetWork}
          onClose={() => setSheet(null)}
          onLike={(id) => {
            requireAuth(() => {
              void (async () => {
                try {
                  const res = await toggleLike(id);
                  setWorks((prev) =>
                    prev.map((w) => (w.id === id ? { ...w, likes: res.likes, lit: res.liked } : w))
                  );
                  if (res.liked) {
                    bumpTask('like');
                    say('球面上的小灯亮了 · 这份成果被点亮');
                  }
                } catch (e) {
                  say(e instanceof Error ? e.message : '点亮失败，请稍后再试');
                }
              })();
            });
          }}
          onComment={(id, text) => {
            requireAuth(() => {
              void (async () => {
                try {
                  const c = await addComment(id, text, label ? `同行 ${label}` : '同行学者');
                  setWorks((prev) =>
                    prev.map((w) => (w.id === id ? { ...w, comments: [...w.comments, c] } : w))
                  );
                } catch (e) {
                  say(e instanceof Error ? e.message : '便签没贴上去，稍后再试');
                }
              })();
            });
          }}
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
            say('小灯已留在球面上，随时可以补上成果');
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

      <LoginDialog />

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
