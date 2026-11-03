#!/usr/bin/env bash
# 童眼成果墙 · 云服务器一键部署
#
# 用法（在服务器上，项目目录内）：
#   sudo bash setup-server.sh
#
# 做的事：装 Node → 加 swap → 写 .env → 构建 → pm2 常驻 + 开机自启。
# Key 只写进 .env（权限 600），由 server.js 读取转发，**不会打进前端 JS**。
set -euo pipefail

APP_NAME="pupils-eyes"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$HERE"

echo "======== 童眼成果墙 · 部署 ========"

# ---- 0. 权限 ----
if [ "$(id -u)" -ne 0 ]; then
  echo "!! 需要 root（要装 Node、用 80 端口、写 /etc）"
  echo "   请改用：sudo bash setup-server.sh"
  exit 1
fi

# ---- 1. Node.js ----
need_node=1
if command -v node >/dev/null 2>&1; then
  major="$(node -v | sed 's/^v\([0-9]*\).*/\1/')"
  [ "$major" -ge 20 ] && need_node=0
  echo ">> 现有 Node: $(node -v)"
fi
if [ "$need_node" -eq 1 ]; then
  echo ">> 安装 Node.js 20 ..."
  if command -v apt-get >/dev/null 2>&1; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
  elif command -v dnf >/dev/null 2>&1; then
    curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
    dnf install -y nodejs
  else
    echo "!! 没有 apt/dnf，请手动安装 Node 20 后重跑"; exit 1
  fi
fi
echo ">> Node 版本: $(node -v)"

# ---- 2. swap（1~2G 内存的机器直接 vite build 会 OOM）----
mem_mb=$(free -m | awk '/^Mem:/{print $2}')
swap_mb=$(free -m | awk '/^Swap:/{print $2}')
if [ "$swap_mb" -lt 1024 ] && [ "$mem_mb" -lt 3000 ]; then
  echo ">> 内存 ${mem_mb}MB，加 2G swap 防止构建被杀 ..."
  if [ ! -f /swapfile ]; then
    fallocate -l 2G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=2048 status=none
    chmod 600 /swapfile
    mkswap /swapfile >/dev/null
    swapon /swapfile
    grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  else
    swapon /swapfile 2>/dev/null || true
  fi
  echo ">> swap 已启用"
fi

# ---- 3. 豆包 Key → .env（不进前端）----
KEY="${DOUBAO_API_KEY:-}"
if [ -z "$KEY" ] && [ -f .env ]; then
  KEY="$(sed -n 's/^DOUBAO_API_KEY=//p' .env | head -1)"
fi
if [ -z "$KEY" ]; then
  read -rp ">> 粘贴豆包 API Key（ark- 开头，直接回车则跳过 AI）: " KEY
fi
if [ -n "$KEY" ]; then
  umask 077
  printf 'DOUBAO_API_KEY=%s\n' "$KEY" > .env
  umask 022
  chmod 600 .env
  echo ">> 已写入 .env（权限 600，仅 root 可读）"
else
  echo ">> 没填 Key：部署后 AI 重绘会跳过，其余功能正常"
fi

# ---- 4. 依赖 + 构建 ----
echo ">> 安装依赖（首次约 2-4 分钟）..."
if [ -f package-lock.json ]; then npm ci; else npm install; fi
echo ">> 构建前端 ..."
npm run build
[ -f dist/index.html ] || { echo "!! 构建失败：dist/index.html 不存在"; exit 1; }

# ---- 5. pm2 常驻 + 开机自启 ----
if ! command -v pm2 >/dev/null 2>&1; then
  echo ">> 安装 pm2 ..."
  npm install -g pm2
fi
pm2 delete "$APP_NAME" >/dev/null 2>&1 || true
PORT=80 pm2 start server.js --name "$APP_NAME" --update-env
pm2 save
# 生成开机自启（systemd）
pm2 startup systemd -u root --hp /root >/dev/null 2>&1 || true
echo ">> pm2 已托管，开机自启已配置"

# ---- 6. 自检 ----
sleep 2
if curl -fsS --max-time 5 http://127.0.0.1/ai-status >/dev/null 2>&1; then
  echo ">> 本地自检通过"
else
  echo "!! 本地自检失败，看日志：pm2 logs $APP_NAME --lines 50"
fi

IP=$(curl -s --max-time 5 https://ifconfig.me 2>/dev/null || echo "服务器公网IP")
echo ""
echo "======== 部署完成 ========"
echo "访问：http://${IP}"
echo ""
echo "如果打不开，去云控制台『防火墙 / 安全组』放行 TCP 80 端口。"
echo ""
echo "常用命令："
echo "  pm2 status            运行状态"
echo "  pm2 logs ${APP_NAME}  看日志"
echo "  pm2 restart ${APP_NAME}"
echo "  改 Key：编辑 .env 后 pm2 restart ${APP_NAME}"
