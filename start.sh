#!/bin/bash
# 反 FOMO 后端启动脚本

echo "🚀 启动反 FOMO 后端服务..."

# 检查 Python 是否可用
if ! command -v python3 &> /dev/null; then
    echo "❌ 错误: 未找到 Python3"
    exit 1
fi

# 设置环境变量
export SECRET_KEY="${SECRET_KEY:-anti-fomo-secret-key-change-in-production}"
export FLASK_APP=app.py
export FLASK_ENV=production
export TAVILY_API_KEY="${TAVILY_API_KEY:-}"
export GEMINI_API_KEY="${GEMINI_API_KEY:-AIzaSyAckEjDhgs2Ve_ntyX0hsgR8rC135PTCCA}"

# 检查必要的 API key
if [ -z "$GEMINI_API_KEY" ]; then
    echo "⚠️  警告: 未设置 GEMINI_API_KEY，AI 分析功能将不可用"
fi

if [ -z "$TAVILY_API_KEY" ]; then
    echo "⚠️  警告: 未设置 TAVILY_API_KEY，联网搜索功能将不可用"
fi

# 启动服务
echo "📡 服务将在 http://0.0.0.0:5000 启动"
python3 app.py
