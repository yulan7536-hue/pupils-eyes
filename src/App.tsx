import { useCallback, useEffect, useRef, useState } from 'react';
import OpeningVideo from './components/OpeningVideo';
import LightChase from './components/LightChase';
import MainLawn from './components/MainLawn';
import BookSpread from './components/BookSpread';
import WorkSheet from './components/WorkSheet';
import RegionDialog from './components/RegionDialog';
import RoleDialog from './components/RoleDialog';
import PinBurst from './components/PinBurst';
import { loadSavedPins, loadSavedWorks, savePins, saveWorks } from './data/initialWorks';
import type { LocationChoice, PinItem, SubmissionPayload, WorkItem } from './types';
import { storySound } from './utils/sound';

/** 四阶段时间轴：开场 → 追光 → 主场景 → 沉浸交互 */
type Step = 'INTRO' | 'CHASE' | 'LAWN';

export default function App() {
  // #lawn 可直接落到主场景，开会演示与逐屏校对时省掉前两段
  const [step, setStep] = useState<Step>(() =>
    typeof window !== 'undefined' && window.location.hash === '#lawn' ? 'LAWN' : 'INTRO'
  );
  const [chaseAlive, setChaseAlive] = useState(false);

  const [pins, setPins] = useState<PinItem[]>(() => loadSavedPins());
  const [works, setWorks] = useState<WorkItem[]>(() => loadSavedWorks());

  const [globeOpen, setGlobeOpen] = useState(false);
  const [target, setTarget] = useState<{ lat: number; lon: number } | null>(null);
  const [newPinId, setNewPinId] = useState<string | null>(null);

  const [book, setBook] = useState<'note' | 'album' | null>(null);
  const [sheet, setSheet] = useState<WorkItem | null>(null);

  const [regionOpen, setRegionOpen] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);
  const [draftLoc, setDraftLoc] = useState<LocationChoice | null>(null);
  const [burst, setBurst] = useState(false);
  const [burstAt, setBurstAt] = useState<{ x: number; y: number } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

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

  /* ---------------- 阶段 4：上传课题三步 ---------------- */

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

    // 地球仪居中放大并转向落点，背景同时被高斯模糊
    setGlobeOpen(true);
    setTarget(coord);

    // 特写：图钉"啪"地钉上去
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
      // 身份弹窗要等「落钉特写」演完再进来，否则高斯模糊会把这一镜头吃掉
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

    setPins((prev) => [pin, ...prev.filter((p) => !p.id.startsWith('draft-'))]);
    setNewPinId(pin.id);
    setWorks((prev) => [
      {
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
      },
      ...prev,
    ]);

    setRoleOpen(false);
    setGlobeOpen(false);
    later(() => setNewPinId(null), 2400);
    say(`图钉已定格 · 童眼看 ${payload.district}`);
  };

  /* ---------------- 阅读与点赞 ---------------- */

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

  const modalOpen = book !== null || sheet !== null;

  return (
    <>
      {/* 阶段 1：10 秒开场，结束后淡出接入全黑 */}
      {step === 'INTRO' && (
        <OpeningVideo
          onComplete={() => {
            setChaseAlive(true);
            setStep('CHASE');
          }}
        />
      )}

      {/* 阶段 3 / 4：主场景。在追光阶段就预先挂上，让白光散开时场景已就绪 */}
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
          onSelectPin={openPin}
          onReplay={replay}
        />
      )}

      {/* 阶段 2：光晕追光 */}
      {chaseAlive && (
        <LightChase
          onReveal={() => setStep('LAWN')}
          onDone={() => setChaseAlive(false)}
        />
      )}

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

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
