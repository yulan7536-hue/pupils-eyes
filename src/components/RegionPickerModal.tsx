import { useState } from 'react';
import { X, MapPin, Check } from 'lucide-react';
import { REGION_TREE, getRegionCoordinates } from '../data/regions';
import { storySound } from '../utils/sound';

interface RegionPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (coord: { lat: number; lon: number }, locationString: string, details: { province: string; city: string; district: string }) => void;
}

export default function RegionPickerModal({ isOpen, onClose, onConfirm }: RegionPickerModalProps) {
  const [country] = useState('中国');
  const [province, setProvince] = useState('浙江省');
  const [city, setCity] = useState('湖州市');
  const [district, setDistrict] = useState('安吉县');
  const [customDistrict, setCustomDistrict] = useState('');
  const [isCustomMode, setIsCustomMode] = useState(false);

  if (!isOpen) return null;

  const handleProvinceChange = (p: string) => {
    setProvince(p);
    const cities = Object.keys(REGION_TREE[p] || {});
    const firstCity = cities[0] || '';
    setCity(firstCity);
    const districts = REGION_TREE[p]?.[firstCity] || [];
    setDistrict(districts[0] || '');
    storySound.playPaperTurn();
  };

  const handleCityChange = (c: string) => {
    setCity(c);
    const districts = REGION_TREE[province]?.[c] || [];
    setDistrict(districts[0] || '');
    storySound.playPaperTurn();
  };

  const finalDistrict = isCustomMode && customDistrict.trim() ? customDistrict.trim() : district;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const coord = getRegionCoordinates(province, city, finalDistrict);
    const locationString = `${province}·${city}·${finalDistrict}`;
    // 确认后立即关闭选择框并传递坐标
    onConfirm(coord, locationString, { province, city, district: finalDistrict });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-xs select-none">
      <div className="relative w-full max-w-sm bg-[#FAFBF8] rounded-2xl p-6 shadow-2xl border border-[#1E3824]/10 animate-in fade-in zoom-in-95 duration-200">
        
        {/* 顶部标题与关闭 */}
        <div className="flex items-center justify-between pb-3 border-b border-[#1E3824]/10 mb-4">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#2F6B3F] animate-pulse" />
            <h3 className="font-serif font-black text-base text-[#122818]">
              选择课题地区坐标
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-[#122818]/60 hover:text-[#122818] hover:bg-stone-200 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          {/* 国家 */}
          <div>
            <label className="block text-[11px] font-bold text-[#3B6647] mb-1">
              国家 / Country
            </label>
            <input
              type="text"
              disabled
              value={country}
              className="w-full px-3 py-2 clay-input font-bold text-[#122818] bg-stone-100"
            />
          </div>

          {/* 地区 / 省份 */}
          <div>
            <label className="block text-[11px] font-bold text-[#3B6647] mb-1">
              省份与直辖市 / Province *
            </label>
            <select
              value={province}
              onChange={(e) => handleProvinceChange(e.target.value)}
              className="w-full px-3 py-2 clay-input font-bold text-[#122818] focus:outline-none"
            >
              {Object.keys(REGION_TREE).map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* 市州 */}
          <div>
            <label className="block text-[11px] font-bold text-[#3B6647] mb-1">
              地级市·市州 / City *
            </label>
            <select
              value={city}
              onChange={(e) => handleCityChange(e.target.value)}
              className="w-full px-3 py-2 clay-input font-bold text-[#122818] focus:outline-none"
            >
              {Object.keys(REGION_TREE[province] || {}).map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* 区县 */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[11px] font-bold text-[#3B6647]">
                区县 / District *
              </label>
              <button
                type="button"
                onClick={() => setIsCustomMode(!isCustomMode)}
                className="text-[10px] text-[#2F6B3F] font-bold hover:underline"
              >
                {isCustomMode ? '从预设列表选' : '自定义填写'}
              </button>
            </div>
            {isCustomMode ? (
              <input
                type="text"
                placeholder="输入县或区名..."
                value={customDistrict}
                onChange={(e) => setCustomDistrict(e.target.value)}
                className="w-full px-3 py-2 clay-input font-bold text-[#122818] focus:outline-none"
              />
            ) : (
              <select
                value={district}
                onChange={(e) => {
                  setDistrict(e.target.value);
                  storySound.playPaperTurn();
                }}
                className="w-full px-3 py-2 clay-input font-bold text-[#122818] focus:outline-none"
              >
                {(REGION_TREE[province]?.[city] || []).map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            )}
          </div>

          {/* 实时预览 */}
          <div className="pt-2 text-center text-xs text-[#122818]">
            <span className="text-[#3B6647]">选定落钉位置：</span>
            <span className="font-bold text-[#2F6B3F] ml-1">
              童眼看 {finalDistrict}
            </span>
          </div>

          {/* 确认坐标按钮 */}
          <button
            type="submit"
            className="w-full py-2.5 mt-2 clay-btn font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
          >
            <Check size={15} />
            <span>确认坐标</span>
          </button>
        </form>
      </div>
    </div>
  );
}
