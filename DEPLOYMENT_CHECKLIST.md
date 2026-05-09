# 反 FOMO v2.0 部署清单

## 📋 部署前检查

- [ ] 代码已提交到 GitHub (`tulip627722-byte/Anti-fomo`)
- [ ] 所有改动都在 `main` 分支上
- [ ] 本地构建成功 (`npm run build`)

---

## 🔧 Vercel 配置清单

### Step 1: 连接 GitHub
- [ ] 访问 https://vercel.com/new
- [ ] 选择 "Import Git Repository"
- [ ] 选择 `Anti-fomo` 仓库
- [ ] 点击 Import

### Step 2: 配置环境变量

在项目设置 → Environment Variables 中添加：

#### 必需：
- [ ] `DATABASE_URL` = PostgreSQL 连接字符串
  - 来自 Neon 或其他数据库提供商
  - 格式：`postgresql://user:password@host:5432/dbname?sslmode=require`

#### 可选（推荐）：
- [ ] `SEARCH_PROVIDER` = `serpapi`
- [ ] `SERPAPI_API_KEY` = SerpAPI 的 API Key
  - 免费注册：https://serpapi.com
  - 免费额度：100 次/月

### Step 3: 部署设置
- [ ] Framework Preset: **Next.js**
- [ ] Root Directory: `.` (默认)
- [ ] Build Command: `next build` (默认)
- [ ] Output Directory: `.next` (默认)

### Step 4: 点击部署
- [ ] 点击 **Deploy** 按钮
- [ ] 等待构建完成（通常 2-3 分钟）
- [ ] 访问提供的 URL 验证部署

---

## ✅ 部署后验证

### 访问应用
- [ ] 打开 Vercel 提供的 URL
- [ ] 页面能正常加载

### 测试登录
- [ ] 用户名：`admin`
- [ ] 密码：`admin123`
- [ ] 能成功登录

### 测试分析功能
- [ ] 输入技术名词（如 "RAG"）
- [ ] 能看到三维度分析：
  - [ ] 本质 (essence)
  - [ ] 核心价值 (coreValue)
  - [ ] 应用前景 (applicationProspect)
  - [ ] 学习成本 (learningCost)
  - [ ] 判决理由 (verdictReason)

### 测试数据持久化
- [ ] 输入几个技术名词进行分析
- [ ] 点击"个人历史"标签
- [ ] 能看到历史记录列表

### 测试搜索功能（如配置了 API）
- [ ] 如果配置了 SERPAPI_API_KEY
- [ ] 分析结果应该包含最新的搜索信息
- [ ] 否则使用本地预设知识库（也能正常工作）

---

## 🚨 常见问题速查

| 问题 | 解决方案 |
|------|--------|
| 部署失败 | 检查 `package.json` 依赖，运行 `npm install` |
| 数据库连接错误 | 检查 DATABASE_URL 格式和 Vercel 环境变量设置 |
| 页面加载超时 | 检查网络，Vercel 构建日志中是否有错误 |
| 分析返回通用结果 | 正常，表示未配置搜索 API 或搜索失败（自动降级） |
| 登录失败 | 确认输入 `admin/admin123`，检查数据库连接 |

---

## 📊 项目信息

| 项目 | 详情 |
|------|------|
| **名称** | Anti-FOMO |
| **仓库** | https://github.com/tulip627722-byte/Anti-fomo |
| **框架** | Next.js 14 |
| **数据库** | PostgreSQL (Neon) |
| **搜索** | SerpAPI（可选） |
| **部署** | Vercel |
| **费用** | 完全免费（Hobby 计划） |

---

## 🎯 部署完成后

### 推荐操作：
1. [ ] 生产环境更改默认密码
2. [ ] 配置自定义域名（可选）
3. [ ] 启用 Vercel Analytics（可选）
4. [ ] 设置 GitHub 自动部署 Webhook（自动）

### 后续维护：
- GitHub 上的任何推送自动触发重新部署
- 监控 Vercel Dashboard 的构建状态
- 定期查看数据库存储使用情况

---

## 📞 获取帮助

- **Vercel 文档**: https://vercel.com/docs
- **Next.js 文档**: https://nextjs.org/docs
- **项目 README**: 查看 `/d/桌面/反fomo/anti-fomo-backend/README.md`
- **部署指南**: 查看 `VERCEL_DEPLOY.md`

---

## 🎉 成功标志

部署成功的迹象：
```
✅ Vercel URL 能访问
✅ 可以登录（admin/admin123）
✅ 能输入技术名词
✅ 收到三维度分析结果
✅ 历史记录能保存
```

如果以上都符合，恭喜！部署完成！ 🎊
