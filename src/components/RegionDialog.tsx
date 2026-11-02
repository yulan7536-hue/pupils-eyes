import { useEffect, useRef, useState } from 'react';
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

/**
 * 坐标选择：国家 / 地区与省份 / 地级市 / 区县。
 * 三级都用自定义可滚动下拉面板（不再依赖原生 <select>），
 * 避免在部分浏览器上列表被截断、显示不全、无法滚动的问题。
 */
export default function RegionDialog({ onClose, onConfirm }: RegionDialogProps) {
  const [province, setProvince] = useState('浙江省');
  const [city, setCity] = useState('湖州市');
  const [district, setDistrict] = useState('安吉县');

  // 当前展开的是哪一级（'province' | 'city' | 'district' | null）
  const [open, setOpen] = useState<'province' | 'city' | 'district' | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // 点面板外部时收起下拉
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (listRef.current && !listRef.current.contains(e.target as Node)) setOpen(null);
    };
    window.addEventListener('mousedown', onDoc);
    return () => window.removeEventListener('mousedown', onDoc);
  }, [open]);

  const provinces = Object.keys(REGION_TREE);
  const cities = Object.keys(REGION_TREE[province] ?? {});
  const districts = REGION_TREE[province]?.[city] ?? [];

  const pickProvince = (next: string) => {
    storySound.playPaperTurn();
    setProvince(next);
    const firstCity = Object.keys(REGION_TREE[next] ?? {})[0] ?? '';
    setCity(firstCity);
    setDistrict(REGION_TREE[next]?.[firstCity]?.[0] ?? '');
    setOpen(null);
  };

  const pickCity = (next: string) => {
    storySound.playPaperTurn();
    setCity(next);
    setDistrict(REGION_TREE[province]?.[next]?.[0] ?? '');
    setOpen(null);
  };

  const pickDistrict = (next: string) => {
    storySound.playPaperTurn();
    setDistrict(next);
    setOpen(null);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const coord = getRegionCoordinates(province, city, district);
    onConfirm(coord, `${province}·${city}·${district}`, { province, city, district });
  };

  /** 通用可滚动选择面板 */
  const picker = (
    items: string[],
    value: string,
    onPick: (v: string) => void,
    kind: 'province' | 'city' | 'district'
  ) => (
    <div className="picker">
      <button
        type="button"
        className="picker__trigger"
        onClick={() => setOpen((o) => (o === kind ? null : kind))}
        aria-haspopup="listbox"
        aria-expanded={open === kind}
      >
        <span>{value}</span>
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <path
            d={open === kind ? 'M2.5 7.5L6 4l3.5 3.5' : 'M2.5 4.5L6 8l3.5-3.5'}
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open === kind && (
        <div className="picker__list" role="listbox" ref={listRef}>
          {items.map((item) => (
            <button
              key={item}
              type="button"
              className="picker__option"
              role="option"
              aria-selected={item === value}
              onClick={() => onPick(item)}
            >
              <span>{item}</span>
              {item === value && <span className="picker__check">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );

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
        <p className="dialog__sub">选好落点，确认后立即在地球仪上安放一盏小灯。</p>

        <form onSubmit={submit}>
          <label className="field">
            <span className="field__label">国家</span>
            <input className="input" value="中国" disabled />
          </label>

          <div className="field">
            <span className="field__label">地区 / 省份</span>
            {picker(provinces, province, pickProvince, 'province')}
          </div>

          <div className="field">
            <span className="field__label">地级市</span>
            {picker(cities, city, pickCity, 'city')}
          </div>

          <div className="field">
            <span className="field__label">区县</span>
            {picker(districts, district, pickDistrict, 'district')}
          </div>

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
