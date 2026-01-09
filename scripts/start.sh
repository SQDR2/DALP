#!/bin/bash
# DALP (Dual-Agent Loop Protocol) 服务启动脚本
# 适用于 Linux/macOS

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# 检查 Node.js 是否已安装
if ! command -v node &> /dev/null; then
    echo "错误: 未找到 Node.js，请先安装 Node.js 18+"
    exit 1
fi

# 检查 Node.js 版本
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "错误: Node.js 版本过低 (当前 v$NODE_VERSION)，需要 v18+"
    exit 1
fi

# 检查 dist 目录是否存在
if [ ! -f "$PROJECT_DIR/dist/index.js" ]; then
    echo "错误: 未找到 dist/index.js，请先运行 'npm run package'"
    exit 1
fi

cd "$PROJECT_DIR"

echo "启动 DALP 服务..."
echo "Dashboard: http://localhost:3000"
echo "SSE Endpoint: http://localhost:3000/sse"
echo ""

node dist/index.js
