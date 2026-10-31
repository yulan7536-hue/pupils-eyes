import type { PinItem, WorkItem } from '../types';

export const INITIAL_PINS: PinItem[] = [
  {
    id: 'pin-1',
    name: '安吉竹林听笋与开物手作',
    city: '浙江省·湖州市·安吉县',
    lat: 30.63,
    lon: 119.68,
    school: '安吉行智开物实验学堂',
    role: 'TEACHER',
    author: '林木老师',
    date: '3天前',
    desc: '带领孩子们探索安吉竹器工艺与竹林生态，融合天工开物匠心与跨学科探索，完成定格竹艺手账。',
  },
  {
    id: 'pin-2',
    name: '海菜花像水上的小星星',
    city: '云南省·大理白族自治州·洱源县',
    lat: 26.11,
    lon: 99.95,
    school: '洱源茈碧湖中心小学',
    role: 'STUDENT',
    author: '小鹿同学 (8岁)',
    date: '昨天',
    desc: '今天在洱海湿地画了海菜花，记录水质净化的自然智慧，制作了数字化水生生态手账卡。',
  },
  {
    id: 'pin-3',
    name: '胡同古槐树三百年的树洞笔记',
    city: '北京市·东城区',
    lat: 39.93,
    lon: 116.42,
    school: '北京童年开物工坊',
    role: 'TEACHER',
    author: '陈立教研员',
    date: '5天前',
    desc: '在北京老胡同里，孩子们通过手掌测量、树皮拓印与听诊器探查，记录古树物候与城市建筑交融。',
  },
  {
    id: 'pin-4',
    name: '柑橘林里迷路的小泥蜂',
    city: '四川省·成都市·蒲江县',
    lat: 30.20,
    lon: 103.51,
    school: '蒲江鹤山小学',
    role: 'STUDENT',
    author: '阿川同学 (9岁)',
    date: '4天前',
    desc: '在橘子园里闻到了很甜的花香，我用泥巴捏了一只小蜜蜂，完成了一套物候手作模型。',
  },
  {
    id: 'pin-5',
    name: '秦岭红腹锦鸡羽毛与泥土色谱',
    city: '陕西省·汉中市·佛坪县',
    lat: 33.52,
    lon: 107.99,
    school: '秦岭开物实践基地',
    role: 'TEACHER',
    author: '秦岭杨老师',
    date: '上周',
    desc: '收集林间矿物土样与落羽，研磨出秦岭本土矿物色谱，设计了行智美育手账。',
  }
];

export const INITIAL_WORKS: WorkItem[] = [
  {
    id: 'pin-1',
    region: '浙江省 · 湖州市 · 安吉县',
    province: '浙江省',
    city: '湖州市',
    district: '安吉县',
    lat: 30.63,
    lon: 119.68,
    title: '安吉竹林听笋与开物手作',
    role: 'TEACHER',
    school: '安吉行智开物实验学堂',
    author: '林木老师',
    date: '3天前',
    content: '【教学目标】引导孩子们探究竹纤维特性与声波共鸣，融合现代工学与传统开物智慧。\n【实施步骤】\n1. 带领学生探访竹海，分析新老竹结构与声音震荡差异；\n2. 采集落笋壳，运用工程结构搭建微缩竹建筑模型；\n3. 记录教案反思，完成多维度跨学科美育实践。',
    likes: 48,
    comments: [
      { id: 'c1', user: '安吉家长张阿姨', text: '孩子回家后带着我们一起做竹制小装置，动手能力和思维都提升了！', time: '前天' },
      { id: 'c2', user: '杭州李校长', text: '行智开物跨学科教学的优秀典范，教案实录非常详实。', time: '昨天' }
    ]
  },
  {
    id: 'pin-2',
    region: '云南省 · 大理白族自治州 · 洱源县',
    province: '云南省',
    city: '大理白族自治州',
    district: '洱源县',
    lat: 26.11,
    lon: 99.95,
    title: '海菜花像水上的小星星',
    role: 'STUDENT',
    school: '洱源茈碧湖中心小学',
    author: '小鹿同学 (8岁)',
    date: '昨天',
    content: '今天在洱海湿地观察了海菜花的开花周期，记录了水质与光照数据。我用数字平板制作了一套动植物数字资源卡包，还绘制了海菜花观察日记！',
    likes: 96,
    comments: [
      { id: 'c3', user: '行智探索者', text: '“水变脏了花就会消失”，数据与童心交融的棒成果！', time: '1小时前' }
    ]
  },
  {
    id: 'pin-3',
    region: '北京市 · 北京市 · 东城区',
    province: '北京市',
    city: '北京市',
    district: '东城区',
    lat: 39.93,
    lon: 116.42,
    title: '胡同古槐树三百年的树洞笔记',
    role: 'TEACHER',
    school: '北京童年开物工坊',
    author: '陈立教研员',
    date: '5天前',
    content: '【课题构思】将城市建筑工程与物候测量结合，带领学生运用微型传感器与传统拓印记录树干微环境，完成长达5米的《胡同大树生命年轮图》。',
    likes: 62,
    comments: [
      { id: 'c4', user: '史家胡同街坊', text: '孩子们把古老胡同和现代实践结合得太生动了。', time: '3天前' }
    ]
  },
  {
    id: 'pin-4',
    region: '四川省 · 成都市 · 蒲江县',
    province: '四川省',
    city: '成都市',
    district: '蒲江县',
    lat: 30.20,
    lon: 103.51,
    title: '柑橘林里迷路的小泥蜂',
    role: 'STUDENT',
    school: '蒲江鹤山小学',
    author: '阿川同学 (9岁)',
    date: '4天前',
    content: '在橘子园里闻到了很甜的花香！我用泥巴捏了一只小蜜蜂，做了仿生授粉小实验，并且用手机拍下录制了我的柑橘微纪录片。',
    likes: 74,
    comments: [
      { id: 'c5', user: '成都志愿者林姐姐', text: '不仅有手作，还有数字资源包，太棒了！', time: '2天前' }
    ]
  },
  {
    id: 'pin-5',
    region: '陕西省 · 汉中市 · 佛坪县',
    province: '陕西省',
    city: '汉中市',
    district: '佛坪县',
    lat: 33.52,
    lon: 107.99,
    title: '秦岭红腹锦鸡羽毛与泥土色谱',
    role: 'TEACHER',
    school: '秦岭开物实践基地',
    author: '秦岭杨老师',
    date: '上周',
    content: '【课程目标】带领学生采集秦岭不同海拔的土壤、矿石与落羽，运用研磨蒸馏提取天然矿物染料，完成科学与美育结合的开物图谱。',
    likes: 51,
    comments: [
      { id: 'c6', user: '西安美院李老师', text: '行智开物的真谛就在于此，动手实践发现大美！', time: '4天前' }
    ]
  }
];

// 本地存储读写辅助
const STORAGE_KEY_WORKS = 'tongyan_nature_works_v2';
const STORAGE_KEY_PINS = 'tongyan_nature_pins_v2';

export function loadSavedWorks(): WorkItem[] {
  if (typeof window === 'undefined') return INITIAL_WORKS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_WORKS);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse local works', e);
  }
  return INITIAL_WORKS;
}

export function saveWorks(works: WorkItem[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_WORKS, JSON.stringify(works));
  } catch (e) {
    console.error('Failed to save works', e);
  }
}

export function loadSavedPins(): PinItem[] {
  if (typeof window === 'undefined') return INITIAL_PINS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PINS);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse local pins', e);
  }
  return INITIAL_PINS;
}

export function savePins(pins: PinItem[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_PINS, JSON.stringify(pins));
  } catch (e) {
    console.error('Failed to save pins', e);
  }
}
