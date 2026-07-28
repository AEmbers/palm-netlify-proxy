#!/bin/bash
# Learning Hub 服务器启动脚本
# 用法: ./start.sh [port]

PORT=${1:-3000}
DIR="$(cd "$(dirname "$0")" && pwd)"

echo "╔══════════════════════════════════════════╗"
echo "║   Learning Hub Server 启动中...          ║"
echo "╚══════════════════════════════════════════╝"

# 检查 Node.js
if ! command -v node &> /dev/null; then
  echo "❌ 未安装 Node.js，请先安装: https://nodejs.org"
  exit 1
fi

# 检查依赖
if [ ! -d "$DIR/server/node_modules" ]; then
  echo "📦 首次运行，安装依赖..."
  cd "$DIR/server" && npm install
fi

# 启动服务器
export PORT=$PORT
cd "$DIR/server" && node index.js
