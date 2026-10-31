# 童眼看世界 · 定格泥塑手绘美学教育展示空间
*Through Children's Eyes — Stop-Motion Clay Planet & Co-Creation Space*

充满定格动画与手绘纸质温润质感的全栈教育展示网站。融合 3D 黏土星体交互、层级精确到区县的自然观察站、师生分流成果共创画卷与手写便利贴互动。

---

## 🌿 核心功能亮点

1. **3D 定格泥塑手绘地球 (Stop-Motion Clay Planet)**
   - 基于 Three.js 的程序化泥塑着色与指纹光影质感（12–14 FPS 定格动效节奏）。
   - 居中呈现无遮挡，支持自由拖拽旋转与点位平滑推拉（Smooth Zoom-In / Zoom-Out）。
   - 动态在 3D 星体表面精准定格落钉。

2. **级联精准定格与点位生成**
   - 手绘填空交互：“童眼看 _____”。
   - 四级联动地区选择器（国家 -> 省 -> 市 -> 区/县）。
   - 选定坐标后在 3D 地球表面“吧嗒”声动态插上定格图钉。

3. **师生双通道定制化上传**
   - **👨‍🏫 教师通道**：支持教案设计、实施实录照片、示范课录像外链录入。
   - **👧 学生通道**：支持自然泥塑小品、儿童观察日记手记上传。

4. **秘密花园成果画卷 (Masonry Grid) 与手写便利贴**
   - 不规则手绘质感卡片瀑布流，支持分类筛选。
   - 读者便利贴留言抽屉与点赞互动，数据本地即时同步。

5. **纯代码程序化 Web Audio 合成音效**
   - 翻书纸音、陶土入泥音、自然清脆音叉与右下角旋转同心圆八音盒挂件。

---

## 🛠 技术栈

- **框架**：React 19, TypeScript
- **构建工具**：Vite 8
- **3D 渲染**：Three.js
- **样式**：Tailwind CSS 4
- **图标**：Lucide React
- **动效**：Motion / CSS Stop-Motion Keyframes
- **音效**：Web Audio API (无需外部音频文件)

---

## 🚀 本地开发与启动

```bash
# 1. 安装依赖
npm install

# 2. 启动开发服务器 (默认端口 3000)
npm run dev

# 3. 构建生产版本
npm run build

# 4. 代码类型检查
npm run lint
```

---

## 📦 推送到 GitHub

```bash
# 1. 添加你的 GitHub 远程仓库
git remote add origin https://github.com/<你的用户名>/<你的仓库名>.git

# 2. 推送至 main 分支
git push -u origin main
```
