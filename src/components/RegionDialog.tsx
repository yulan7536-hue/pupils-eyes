import { useEffect, useState } from 'react';
import { REGION_TREE, getRegionCoordinates } from '../data/regions';
import { storySound } from '../utils/sound';

interface RegionDialogProps {
  onClose: () => void;
  onConfirm: (
    coord: { lat: number; lon: number },
    locationString: string,
    details: { province: string; city: string; district: string }
  ) => void;
}

/** 坐标选择：国家 / 地区与省份 / 地级市 / 区县 */
export default function RegionDialog({ onClose, onConfirm }: RegionDialogProps) {
  const [province, setProvince] = useState('浙江省');
  const [city, setCity] = useState('湖州市');
  const [district, setDistrict] = useState('安吉县');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const cities = Object.keys(REGION_TREE[province] ?? {});
  const districts = REGION_TREE[province]?.[city] ?? [];

  const pickProvince = (next: string) => {
    storySound.playPaperTurn();
    setProvince(next);
    const firstCity = Object.keys(REGION_TREE[next] ?? {})[0] ?? '';
    setCity(firstCity);
    setDistrict(REGION_TREE[next]?.[firstCity]?.[0] ?? '');
  };

  const pickCity = (next: string) => {
    storySound.playPaperTurn();
    setCity(next);
    setDistrict(REGION_TREE[province]?.[next]?.[0] ?? '');
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const coord = getRegionCoordinates(province, city, district);
    onConfirm(coord, `${province}·${city}·${district}`, { province, city, district });
  };

  return (
    <div
      className="veil veil--soft"
      role="dialog"
      aria-modal="true"
      aria-labelledby="region-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="dialog">
        <h2 className="dialog__title" id="region-title">
          选择课题坐标
        </h2>
        <p className="dialog__sub">选好落点，确认后立即在地球仪上钉一枚新图钉。</p>

        <form onSubmit={submit}>
          <label className="field">
            <span className="field__label">国家</span>
            <input className="input" value="中国" disabled />
          </label>

          <label className="field">
            <span className="field__label">地区 / 省份</span>
            <select
              className="input"
              value={province}
              onChange={(e) => pickProvince(e.target.value)}
            >
              {Object.keys(REGION_TREE).map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="field__label">地级市</span>
            <select className="input" value={city} onChange={(e) => pickCity(e.target.value)}>
              {cities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="field__label">区县</span>
            <select
              className="input"
              value={district}
              onChange={(e) => {
                storySound.playPaperTurn();
                setDistrict(e.target.value);
              }}
            >
              {districts.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>

          <p className="dialog__sub" style={{ margin: '6px 0 18px', textAlign: 'center' }}>
            落钉位置 ·{' '}
            <strong style={{ fontWeight: 500, color: 'var(--ink)' }}>童眼看 {district}</strong>
          </p>

          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="btn btn--quiet" onClick={onClose}>
              取消
            </button>
            <button type="submit" className="btn btn--full">
              确认坐标
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
