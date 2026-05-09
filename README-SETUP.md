# 反 FOMO - 优先级联网搜索 + AI 分析配置指南

## 功能概述

该项目采用**优先级联网搜索 + AI 分析**架构：

1. **优先级联网搜索** - 按重要性分层搜索：
   - **第一优先**: GitHub 代码实现和讨论
   - **第二优先**: 技术论文（arXiv、IEEE、NeurIPS 等）
   - **第三优先**: 技术博客、官方文档等通用内容
2. **AI 分析** - 基于优先级搜索结果生成结构化理性拆解

所有搜索在后台并行执行，然后按优先级聚合结果，让 AI 获得最质量的上下文信息。

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 配置 API Keys

#### 2.1 Anthropic Claude API

1. 访问 [Anthropic Console](https://console.anthropic.com/account/keys)
2. 创建新的 API Key
3. 设置环境变量：

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
```

或在 `.env` 文件中配置：

```
ANTHROPIC_API_KEY=sk-ant-...
```

**免费额度**: $5（足以测试）

#### 2.2 Tavily 搜索 API

1. 访问 [Tavily.com](https://tavily.com/)
2. 注册免费账号
3. 创建 API Key
4. 设置环境变量：

```bash
export TAVILY_API_KEY="tvly-..."
```

或在 `.env` 文件中配置：

```
TAVILY_API_KEY=tvly-...
```

**免费额度**: 1000 次搜索/月

### 3. 运行服务

#### 方式 1：直接运行

```bash
export ANTHROPIC_API_KEY="your-key-here"
export TAVILY_API_KEY="your-key-here"
python3 app.py
```

#### 方式 2：使用启动脚本

```bash
chmod +x start.sh
ANTHROPIC_API_KEY="your-key" TAVILY_API_KEY="your-key" ./start.sh
```

#### 方式 3：使用 Docker

```bash
docker build -t anti-fomo .
docker run -e ANTHROPIC_API_KEY="your-key" \
           -e TAVILY_API_KEY="your-key" \
           -p 5000:5000 \
           anti-fomo
```

### 4. 测试

访问 http://localhost:5000 并输入任意 AI 技术名词（如 "Mamba"、"Vision Transformer" 等）

## API 端点

### POST /api/analyze

请求体：
```json
{
  "term": "Mamba"
}
```

响应体：
```json
{
  "term": "Mamba",
  "verdict": "yellow",
  "verdictReason": "长序列建模有优势，但通用能力尚未完全超越 Transformer",
  "firstPrinciples": "...",
  "truth": "...",
  "hypeVsReality": [
    {
      "hype": "常见夸大说法",
      "reality": "实际情况"
    }
  ]
}
```

## 环境变量

| 变量名 | 说明 | 必需 | 示例 |
|--------|------|------|------|
| `ANTHROPIC_API_KEY` | Claude API Key | 是 | `sk-ant-...` |
| `TAVILY_API_KEY` | Tavily 搜索 Key | 是 | `tvly-...` |
| `SECRET_KEY` | Flask 安全密钥 | 否 | 任意字符串 |
| `FLASK_ENV` | Flask 环境 | 否 | `production` |

## 常见问题

### Q: 没有 API Key 可以运行吗？

A: 不可以。联网搜索和 AI 分析都需要对应的 API Key。

### Q: 成本是多少？

**Anthropic Claude**
- 免费试用: $5
- 正式费用: 按 token 计费
  - 输入: $3 / 100万 token
  - 输出: $15 / 100万 token
- 每个分析大约 200-400 个 token，$5 足以做 100+ 次分析

**Tavily**
- 免费: 1000 次/月
- 付费: $50/月（25000 次）

### Q: 如何部署到生产环境？

生产环境建议：

1. **使用 Docker** (见上文)
2. **配置 CI/CD** (GitHub Actions / GitLab CI)
3. **安全存储 API Key** (环境变量、密钥管理服务)
4. **配置反向代理** (Nginx)
5. **启用 HTTPS**

## 数据库

- 使用 SQLite (`anti_fomo.db`)
- 记录：搜索历史、用户信息
- 管理员账号: `admin` / `admin123` (仅用于演示，生产环境请修改)

## 故障排查

### 502 错误或超时

- 检查 Tavily/Anthropic 服务状态
- 检查网络连接
- 增加超时时间（修改代码中的 `timeout=10`）

### API Key 无效

- 确保 Key 正确复制（无空格、无换行）
- 访问对应服务的控制台验证 Key 是否有效
- 检查 Key 是否被禁用

### 搜索结果不理想

- Tavily 默认搜索英文，尝试用英文搜索
- 可修改 `app.py` 中 `_search_github`/`_search_papers`/`_search_general` 的查询关键词

---

## 优先级搜索的工作原理

### 架构

`search_tavily()` 函数现在分为三个并行搜索任务：

```
搜索请求 (RAG)
    ↓
┌─────────────────────────────────────────┐
│ concurrent.futures.ThreadPoolExecutor   │
├─────────────────────────────────────────┤
│ ① _search_github()  → [GitHub]          │
│ ② _search_papers()  → [arXiv/IEEE/...]  │
│ ③ _search_general() → [Blog/Docs/...]   │
└─────────────────────────────────────────┘
    ↓
聚合结果（按优先级）
    ↓
发送给 Gemini 分析
```

### 支持的论文来源

- **arXiv** (arxiv.org) - 计算机科学论文
- **IEEE** (ieeexplore.ieee.org) - IEEE 期刊/会议
- **Papers with Code** (paperswithcode.com) - 论文+代码对标
- **Semantic Scholar** (semanticscholar.org) - AI 驱动的学术搜索
- **ACM DL** (dl.acm.org) - 计算机协会数字库
- **NeurIPS** (proceedings.neurips.cc) - NeurIPS 会议论文
- **OpenReview** (openreview.net) - 机器学习会议审稿平台
- **Google Scholar** (scholar.google.com) - 通用学术搜索

### 性能特点

- ✅ **并行搜索** - 三个搜索任务同时执行，总耗时 ≈ max(搜索耗时)，而非 3× 耗时
- ✅ **智能聚合** - GitHub 和论文结果始终排在前面，让 AI 优先看到高质量信息
- ✅ **域名过滤** - 使用 Tavily 的 `include_domains` / `exclude_domains` 精确控制搜索范围
- ✅ **结果标记** - 每条结果都带有来源标签（[GitHub] / [论文] / [网络]），便于追踪

## 贡献

欢迎提交 Issue 或 Pull Request！

## 许可证

MIT
