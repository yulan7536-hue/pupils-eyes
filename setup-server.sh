#!/usr/bin/env bash
# 童眼成果墙 · 腾讯云轻量服务器一键部署脚本
# 用法：在服务器上，cd 到项目目录后执行  bash setup-server.sh
set -euo pipefail

echo "======== 童眼成果墙 · 一键部署 ========"

# 1) 装 Node（没有才装）
if ! command -v node >/dev/null 2>&1; then
  echo ">> 未检测到 Node.js，开始安装 Node 20 ..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
echo ">> Node 版本: $(node -v)"

# 2) 豆包 Key（没有环境变量则交互输入）
if [ -z "${VITE_DOUBAO_API_KEY:-}" ]; then
  read -rp ">> 粘贴豆包 API Key（ark- 开头）：" VITE_DOUBAO_API_KEY
fi
export VITE_DOUBAO_API_KEY

# 3) 安装依赖 + 构建前端
echo ">> 安装依赖（约 1-2 分钟）..."
npm install
echo ">> 构建前端（会把豆包 Key 打进静态文件）..."
npm run build

# 4) 装 pm2 进程守护
if ! command -v pm2 >/dev/null 2>&1; then
  echo ">> 安装 pm2 ..."
  npm install -g pm2
fi

# 5) 启动（用 80 端口，浏览器直接 http://IP 访问，无需端口号）
pm2 delete pupils-eyes 2>/dev/null || true
PORT=80 pm2 start server.js --name pupils-eyes
pm2 save

IP=$(curl -s --max-time 5 ifconfig.me 2>/dev/null || echo "你的服务器公网IP")
echo ""
echo "======== 部署完成 ========"
echo "在浏览器打开： http://${IP}"
echo ""
echo "常用命令："
echo "  看运行状态： pm2 status"
echo "  看日志：     pm2 logs pupils-eyes"
echo "  重启：       pm2 restart pupils-eyes"
echo "  开机自启：   pm2 startup  # 然后复制它输出的那一行命令执行"
