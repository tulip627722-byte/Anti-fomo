# 反 FOMO 部署到 Vercel 指南

## 前置条件

- GitHub 账号（已连接项目）
- Vercel 账号（https://vercel.com）
- PostgreSQL 数据库（Neon 或其他）
- 搜索 API Key（可选，推荐 SerpAPI）

---

## 🚀 快速部署步骤

### 1. 连接 GitHub

1. 访问 https://vercel.com/new
2. 选择 "Import Git Repository"
3. 连接你的 GitHub 账号
4. 选择 `anti-fomo-backend` 仓库
5. 点击 Import

### 2. 配置环境变量

在 Vercel 项目设置中，添加以下环境变量：

#### **必需**
```
DATABASE_URL=postgresql://user:password@host/database
```

#### **可选（推荐 SerpAPI）**
```
SEARCH_PROVIDER=serpapi
SERPAPI_API_KEY=your_serpapi_api_key
```

#### **其他搜索 API（二选一）**

**Google Custom Search：**
```
SEARCH_PROVIDER=google
GOOGLE_API_KEY=your_key
GOOGLE_CSE_ID=your_cse_id
```

**Bing Search：**
```
SEARCH_PROVIDER=bing
BING_API_KEY=your_key
```

### 3. 部署

- 选择 Node.js 20.x
- 构建命令：`next build`
- 输出目录：`.next`
- 自动开始构建和部署

---

## 📊 项目结构

```
anti-fomo-backend/
├── app/
│   ├── api/
│   │   ├── analyze/        # AI 分析 API 入口
│   │   ├── auth/           # 认证接口
│   │   └── history/        # 用户历史
│   ├── page.tsx            # 前端 UI
│   ├── layout.tsx          # 布局
│   └── globals.css         # 全局样式
├── lib/
│   ├── db.ts              # PostgreSQL 操作
│   └── auth.ts            # 认证逻辑
├── package.json
├── vercel.json
├── tsconfig.json
└── .env.example
```

---

## 🔑 环境变量详解

### DATABASE_URL
- **来源**: Neon (https://neon.tech) 或其他 PostgreSQL 提供商
- **格式**: `postgresql://user:password@host/database?sslmode=require`
- **必需**: 是
- **说明**: 存储用户和分析历史

### SEARCH_PROVIDER & API_KEY
- **来源**: 
  - SerpAPI: https://serpapi.com
  - Google: https://programmablesearchengine.google.com
  - Bing: https://www.bing.com/webmaster
- **必需**: 否（不设置时使用本地知识库）
- **说明**: 支持全网搜索，但会增加 API 成本

---

## 💡 不同配置的行为

### ✅ 配置了搜索 API
```
用户输入 "RAG"
  ↓
调用搜索 API 获取最新信息
  ↓
用搜索结果 + AI 生成分析
  ↓
存储到数据库
```

### ⚡ 没有配置搜索 API
```
用户输入 "RAG"
  ↓
查找本地 PROFILES 知识库
  ↓
直接返回预设的三维度分析
  ↓
存储到数据库
```

本地知识库包括：RAG、Mamba、LoRA、AI Agent、Harness、Transformer

---

## 🧪 部署后测试

### 1. 访问应用
```
https://your-project.vercel.app
```

### 2. 测试登录
- 用户名: `admin`
- 密码: `admin123`

### 3. 测试分析
- 输入技术名词（如 "RAG"、"Mamba" 等）
- 应该看到三维度分析结果

### 4. 查看历史
- 切换到"个人历史"标签
- 应该能看到之前的分析记录

---

## 🔧 常见问题

### Q: 部署失败，说"DATABASE_URL not found"
**A**: 确保在 Vercel 项目设置中添加了 DATABASE_URL 环境变量

### Q: 分析结果是通用描述，没有搜索内容
**A**: 正常现象。这意味着：
- 搜索 API 未配置，使用本地知识库
- 或搜索 API 调用失败，自动降级

### Q: 想使用搜索功能，怎么配置？
**A**: 
1. 在 https://serpapi.com 免费注册
2. 获取 API Key
3. 在 Vercel 添加环境变量：`SERPAPI_API_KEY`
4. 设置 `SEARCH_PROVIDER=serpapi`
5. 重新部署

### Q: 如何更新部署代码？
**A**: 
1. 推送新代码到 GitHub
2. Vercel 自动检测并重新部署
3. 无需手动操作

---

## 📈 成本估算

| 组件 | 费用 | 说明 |
|------|------|------|
| Vercel | 免费 | Hobby 计划足够 |
| Neon (PostgreSQL) | 免费 + 付费 | 初期免费额度充足 |
| SerpAPI | 免费 + 付费 | 100 次/月 免费，后续按量计费 |
| **总计** | **免费开始** | 个人项目完全免费 |

---

## 🚨 安全提示

- ✅ 生产环境改掉默认密码 (`admin123`)
- ✅ 不要在代码中硬编码 API Key
- ✅ 定期轮换数据库密码
- ✅ 启用 Vercel 的审计日志

---

## 📚 更多资源

- [Next.js 文档](https://nextjs.org/docs)
- [Vercel 部署文档](https://vercel.com/docs)
- [Neon PostgreSQL](https://neon.tech/docs)
- [反 FOMO README](./README.md)
