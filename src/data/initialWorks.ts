import { GalleryItem } from '../components/GalleryWall';
import { PinItem } from '../components/ClayGlobe';

export const INITIAL_PINS: PinItem[] = [
  {
    id: 'pin-1',
    name: '安吉竹林听笋与竹壳定格泥塑',
    city: '浙江省·湖州市·安吉县',
    lat: 30.63,
    lon: 119.68,
    school: '安吉绿水青山实验学堂',
    role: 'TEACHER',
    author: '林木老师',
    date: '3天前',
    desc: '带一年级孩子们去后山敲击不同年份的竹子，青竹清脆，老竹沉厚。孩子们用拾落的竹壳制作了第一批定格泥塑小笋人。',
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
    desc: '今天在洱海湿地画了海菜花，白色的三片花瓣，金黄的花蕊。老师说水要特别特别干净它们才会开花，像小小的星星漂浮在水面上。',
  },
  {
    id: 'pin-3',
    name: '胡同古槐树三百年的树洞笔记',
    city: '北京市·东城区',
    lat: 39.93,
    lon: 116.42,
    school: '北京童年自然工坊',
    role: 'TEACHER',
    author: '陈立教研员',
    date: '5天前',
    desc: '在北京老胡同里，孩子们通过手掌测量、树皮拓印和听诊器听大树吸水的声音，将历史与自然物候交融记录在手作羊皮纸上。',
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
    desc: '在橘子园里闻到了很甜的花香，我用泥巴捏了一只小蜜蜂，还给它插了两片落叶当翅膀，放在花枝上等真蜜蜂来找它玩。',
  },
  {
    id: 'pin-5',
    name: '秦岭红腹锦鸡羽毛与泥土色谱',
    city: '陕西省·汉中市·佛坪县',
    lat: 33.52,
    lon: 107.99,
    school: '秦岭自然小卫士营地',
    role: 'TEACHER',
    author: '秦岭杨老师',
    date: '上周',
    desc: '带领孩子们收集林间落叶、松果与不同层位的红黄黑泥土，在水彩纸上研磨出大山原本的色彩，完成了一幅定格大自然的色彩轮谱。',
  }
];

export const INITIAL_WORKS: GalleryItem[] = [
  {
    id: 'pin-1',
    region: '浙江省 · 湖州市 · 安吉县',
    province: '浙江省',
    city: '湖州市',
    district: '安吉县',
    lat: 30.63,
    lon: 119.68,
    title: '安吉竹林听笋与竹壳定格泥塑',
    role: 'TEACHER',
    school: '安吉绿水青山实验学堂',
    author: '林木老师',
    date: '3天前',
    content: '【教学目标】引导一年级孩子用听觉（敲击青竹/老竹的声音差别）与触觉（竹笋茸毛与竹节粗糙度）感知自然生命力。\n【实施步骤】\n1. 晨间步入安吉大竹海，闭眼倾听风穿过竹叶的声音；\n2. 采集自然脱落的笋壳、干竹枝，用陶土手捏竹节小精灵；\n3. 孩子自主为泥塑命名，在教室窗台搭建微型竹林剧场。',
    likes: 48,
    comments: [
      { id: 'c1', user: '安吉家长张阿姨', text: '孩子回家后拉着我们敲击竹筷子辨别高低音，特别有成就感！', time: '前天' },
      { id: 'c2', user: '杭州李校长', text: '非常生动的跨学科自然美育案例，教案已下载借鉴。', time: '昨天' }
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
    content: '今天在洱海边的木栈道上，我第一次看到了真正的海菜花。白色的三片小花瓣像纸一样薄，浮在清清的水面上。老师说，水变脏了花就会消失。我要保护好这片水，让小星星一直漂着。',
    likes: 96,
    comments: [
      { id: 'c3', user: '自然守望者', text: '“水变脏了花就会消失”，孩子的语言比诗还要纯净。', time: '1小时前' }
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
    school: '北京童年自然工坊',
    author: '陈立教研员',
    date: '5天前',
    content: '【课题构思】城市里的孩子往往觉得自然很远。我们把课堂搬到东四胡同，带孩子们用听诊器贴在三百岁老槐树树干上，听地下水在树干木质部输送的沙沙轻响。\n【成果呈现】结合宣纸拓印与泥塑小叶片，孩子们绘制了长达5米的《胡同大树生命年轮图》。',
    likes: 62,
    comments: [
      { id: 'c4', user: '史家胡同街坊', text: '看到孩子们在大树前围坐，整个胡同都变得年轻了。', time: '3天前' }
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
    content: '橘子花开的时候，树林里像下了雪一样白，好香好香！我用果园地里的黄泥巴捏了一只小蜜蜂，用捡来的两片干叶子当翅膀，轻轻放在花朵旁边。我怕它找不到妈妈，就用树枝给它搭了一个小伞。',
    likes: 74,
    comments: [
      { id: 'c5', user: '成都志愿者林姐姐', text: '小伞的设计太暖了，像给小蜜蜂撑起的大自然保护伞！', time: '2天前' }
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
    school: '秦岭自然小卫士营地',
    author: '秦岭杨老师',
    date: '上周',
    content: '【课程目标】让大山深处的孩子看见家乡生物多样性的瑰宝。收集自然掉落的红腹锦鸡艳丽绒羽，与秦岭不同海拔的土壤、苔藓研磨汁液进行对比，制作天然矿物植物画作。',
    likes: 51,
    comments: [
      { id: 'c6', user: '西安美院李老师', text: '大自然是最好的调色板，质感极佳！', time: '4天前' }
    ]
  }
];

// 本地存储读写辅助
const STORAGE_KEY_WORKS = 'tongyan_nature_works_v2';
const STORAGE_KEY_PINS = 'tongyan_nature_pins_v2';

export function loadSavedWorks(): GalleryItem[] {
  if (typeof window === 'undefined') return INITIAL_WORKS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_WORKS);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse local works', e);
  }
  return INITIAL_WORKS;
}

export function saveWorks(works: GalleryItem[]) {
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
