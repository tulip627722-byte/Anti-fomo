import { NextResponse } from "next/server";
import { MOCK_ADMIN, getUsernameFromRequest } from "@/lib/auth";
import { insertSearchLog, upsertUser } from "@/lib/db";
import type { AnalysisResult, Verdict } from "@/lib/types";

type AnalyzeBody = { term?: string };
type SearchSource = "tech" | "general";
type SearchResult = { title: string; snippet: string; link: string };
type PartialModelResult = Partial<Omit<AnalysisResult, "term">>;

const TECH_SITE_FILTER = "(site:github.com OR site:arxiv.org OR site:paperswithcode.com OR site:stackoverflow.com OR site:dev.to OR site:medium.com OR site:towardsdatascience.com OR site:openreview.net OR site:huggingface.co)";

const SYSTEM_PROMPT = `你是一个帮助开发者判断“某项 AI 技术是否值得现在投入学习”的分析助手。
用户会给你一个 AI 名词，并提供全网搜索结果。你必须优先基于这些搜索资料进行第一性原理分析，不要臆测。

你要完成：
1) 一句话说明本质：
“[技术名词] 的本质是：用 [核心机制] 解决 [之前无法很好解决的问题]。”

2) 三维度分析：
- 核心价值：指出它解决了什么过去做不好的问题，与替代方案相比不可替代性在哪里。
- 应用前景：给出未来 1-2 年普通开发者遇到它的概率判断，以及具体落地场景。
- 学习成本：给出从零到能在项目独立使用的大致时间，必须点明前置知识。

3) 综合判决：verdict 只能是 green / yellow / red，并说明为什么是这个颜色。

只输出 JSON，不要 Markdown，不要额外文本。
JSON 结构必须是：
{
  "verdict": "green" | "yellow" | "red",
  "essence": "...",
  "coreValue": { "description": "...", "conclusion": "..." },
  "applicationProspect": { "description": "...", "conclusion": "..." },
  "learningCost": { "description": "...", "conclusion": "..." },
  "verdictReason": "..."
}`;

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as AnalyzeBody;
    const term = body.term?.trim();
    if (!term) {
      return NextResponse.json({ message: "请输入 AI 名词" }, { status: 400 });
    }

    const result = await analyzeTerm(term);
    const username = getUsernameFromRequest(request) ?? MOCK_ADMIN.username;

    try {
      await upsertUser(username, MOCK_ADMIN.role);
      await insertSearchLog({ username, result });
    } catch (dbError) {
      console.error("Failed to persist analyze result:", dbError);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Analyze route failed:", error);
    return NextResponse.json(
      { message: "分析服务暂时不可用，请稍后重试" },
      { status: 500 },
    );
  }
}

async function analyzeTerm(term: string): Promise<AnalysisResult> {
  let searchResults: SearchResult[] = [];
  try { searchResults = await searchWeb(term); } catch { searchResults = []; }

  const apiKey = process.env.API_KEY;
  if (apiKey) {
    try {
      const parsed = isDashScopeCompatible()
        ? await callDashScopeModel(term, apiKey, searchResults)
        : await callOpenAICompatibleModel(term, apiKey, searchResults);
      if (parsed && hasModelPayload(parsed)) return normalizeModelResult(term, parsed);
    } catch {}
  }

  if (searchResults.length > 0) return generateFromSearchResults(term, searchResults);

  return {
    term,
    verdict: "yellow",
    essence: `${term} 的公开资料不足，当前无法建立稳定的一阶判断。`,
    coreValue: { description: `未检索到足够权威且一致的资料来证明 ${term} 的核心机制和不可替代价值。`, conclusion: "价值待评估，信息不足。" },
    applicationProspect: { description: `缺少可验证的落地案例，无法判断 ${term} 在未来 1-2 年的真实采用概率。`, conclusion: "前景不明，建议持续观察。" },
    learningCost: { description: "当前无法从公开资料评估学习路径、前置知识与上手成本。", conclusion: "成本未知，暂不建议重投入。" },
    verdictReason: "全网信息不足，先保持关注，待出现更多高质量资料后再决定投入深度。",
  };
}

async function searchWeb(term: string): Promise<SearchResult[]> {
  const provider = process.env.SEARCH_PROVIDER ?? "serpapi";
  const [techRes, generalRes] = await Promise.allSettled([
    searchWithProvider(provider, term, "tech"),
    searchWithProvider(provider, term, "general"),
  ]);

  const merged: SearchResult[] = [];
  const seen = new Set<string>();
  const pushUnique = (items: SearchResult[]) => {
    for (const item of items) {
      const link = item.link.trim().toLowerCase();
      if (!link || seen.has(link)) continue;
      seen.add(link);
      merged.push(item);
    }
  };

  if (techRes.status === "fulfilled") pushUnique(techRes.value);
  if (generalRes.status === "fulfilled") pushUnique(generalRes.value);
  return merged;
}

async function searchWithProvider(provider: string, term: string, source: SearchSource): Promise<SearchResult[]> {
  if (provider === "google") return searchGoogle(term, source);
  if (provider === "bing") return searchBing(term, source);
  return searchSerpApi(term, source);
}

function buildQuery(term: string, source: SearchSource) { return source === "tech" ? `${term} AI ${TECH_SITE_FILTER}` : `${term} AI`; }

async function searchSerpApi(term: string, source: SearchSource): Promise<SearchResult[]> {
  const apiKey = process.env.SERPAPI_API_KEY;
  if (!apiKey) throw new Error("SERPAPI_API_KEY is required when SEARCH_PROVIDER=serpapi");

  const url = new URL("https://serpapi.com/search");
  url.searchParams.set("engine", "google");
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("q", buildQuery(term, source));
  url.searchParams.set("num", "8");
  url.searchParams.set("hl", "zh-cn");

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error("SerpAPI request failed");

  const data = (await res.json()) as { organic_results?: Array<{ title: string; snippet?: string; link: string }> };
  return (data.organic_results ?? []).map((item) => ({ title: item.title, snippet: item.snippet ?? "", link: item.link }));
}

async function searchGoogle(term: string, source: SearchSource): Promise<SearchResult[]> {
  const apiKey = process.env.GOOGLE_API_KEY;
  const cseId = process.env.GOOGLE_CSE_ID;
  if (!apiKey || !cseId) throw new Error("GOOGLE_API_KEY and GOOGLE_CSE_ID are required when SEARCH_PROVIDER=google");

  const url = new URL("https://www.googleapis.com/customsearch/v1");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("cx", cseId);
  url.searchParams.set("q", buildQuery(term, source));
  url.searchParams.set("num", "8");

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error("Google request failed");

  const data = (await res.json()) as { items?: Array<{ title: string; snippet?: string; link: string }> };
  return (data.items ?? []).map((item) => ({ title: item.title, snippet: item.snippet ?? "", link: item.link }));
}

async function searchBing(term: string, source: SearchSource): Promise<SearchResult[]> {
  const apiKey = process.env.BING_API_KEY;
  if (!apiKey) throw new Error("BING_API_KEY is required when SEARCH_PROVIDER=bing");

  const res = await fetch(`https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(buildQuery(term, source))}&count=8`, {
    headers: { "Ocp-Apim-Subscription-Key": apiKey },
  });
  if (!res.ok) throw new Error("Bing request failed");

  const data = (await res.json()) as { webPages?: { value?: Array<{ name: string; snippet?: string; url: string }> } };
  return (data.webPages?.value ?? []).map((item) => ({ title: item.name, snippet: item.snippet ?? "", link: item.url }));
}

function formatSearchContext(results: SearchResult[]) {
  return results.map((item, index) => `${index + 1}. 标题: ${item.title}\n摘要: ${item.snippet}\n链接: ${item.link}`).join("\n\n");
}

async function callOpenAICompatibleModel(term: string, apiKey: string, searchResults: SearchResult[]) {
  const response = await fetch(`${getApiBaseUrl()}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: process.env.AI_MODEL ?? "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `AI 名词: ${term}\n\n全网搜索结果:\n${formatSearchContext(searchResults) || "无"}` },
      ],
    }),
  });

  if (!response.ok) throw new Error("Model request failed");
  const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return parseModelJSON(data.choices?.[0]?.message?.content);
}

async function callDashScopeModel(term: string, apiKey: string, searchResults: SearchResult[]) {
  const response = await fetch(`${getApiBaseUrl()}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: process.env.AI_MODEL ?? "qvq-max",
      stream: true,
      temperature: 0.2,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `AI 名词: ${term}\n\n全网搜索结果:\n${formatSearchContext(searchResults) || "无"}` },
      ],
    }),
  });

  if (!response.ok || !response.body) throw new Error("DashScope request failed");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";

    for (const event of events) {
      for (const line of event.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const chunk = JSON.parse(payload) as { choices?: Array<{ delta?: { content?: string }; message?: { content?: string } }> };
          const choice = chunk.choices?.[0];
          content += choice?.delta?.content ?? choice?.message?.content ?? "";
        } catch {}
      }
    }
  }

  return parseModelJSON(content);
}

function parseModelJSON(content?: string): PartialModelResult | null {
  if (!content) return null;
  try { return JSON.parse(content) as PartialModelResult; } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try { return JSON.parse(match[0]) as PartialModelResult; } catch { return null; }
  }
}

function getApiBaseUrl() { return process.env.API_BASE_URL ?? "https://api.openai.com/v1"; }
function isDashScopeCompatible() { const base = getApiBaseUrl().toLowerCase(); const model = (process.env.AI_MODEL ?? "").toLowerCase(); return base.includes("dashscope") || model.startsWith("qvq"); }

function hasModelPayload(result: PartialModelResult) {
  return Boolean(result.verdict || result.essence || result.coreValue || result.applicationProspect || result.learningCost || result.verdictReason);
}

function normalizeModelResult(term: string, result: PartialModelResult): AnalysisResult {
  return {
    term,
    verdict: isVerdict(result.verdict) ? result.verdict : "yellow",
    essence: result.essence ?? `${term} 的本质仍需结合具体资料进一步确认。`,
    coreValue: result.coreValue ?? { description: `当前可得资料对 ${term} 的核心收益仍有分歧，建议结合具体场景验证。`, conclusion: "价值中等，建议先小范围试用。" },
    applicationProspect: result.applicationProspect ?? { description: `公开资料显示 ${term} 有一定热度，但落地密度和场景稳定性仍需持续观察。`, conclusion: "前景尚早，先关注演进。" },
    learningCost: result.learningCost ?? { description: "建议先完成概念级理解与最小实践，再决定是否深投入。", conclusion: "成本中等，按项目需求投入。" },
    verdictReason: result.verdictReason ?? "目前信息支持继续关注，待场景明确后再加码投入。",
  };
}

function generateFromSearchResults(term: string, results: SearchResult[]): AnalysisResult {
  const text = results.flatMap((item) => [item.title, item.snippet, item.link]).join(" ").toLowerCase();
  const hasTutorial = /tutorial|guide|get started|quickstart|教程|入门/.test(text);
  const hasProduction = /production|deploy|deployment|enterprise|案例|生产/.test(text);
  const hasGitHub = /github\.com/.test(text);
  const hasPaper = /arxiv|paper|论文|research/.test(text);

  if (hasTutorial && hasProduction && hasGitHub) {
    return {
      term,
      verdict: "green",
      essence: `${term} 的本质是通过特定机制解决可复用的工程问题，并已出现稳定实践路径。`,
      coreValue: { description: "检索结果同时出现教程、开源代码和生产实践，说明它不仅能讲清楚，还能被反复落地。", conclusion: "价值高，具备明显实用性和可迁移性。" },
      applicationProspect: { description: "技术站与通用站点都出现真实应用信息，表明其在未来 1-2 年内仍会高频出现于开发工作流。", conclusion: "前景明确，适合当前投入。" },
      learningCost: { description: "已有较完整入门路径，可通过官方文档和开源示例快速建立最小可用能力。", conclusion: "成本中等偏低，投入产出比好。" },
      verdictReason: "搜索证据链完整（教程 + GitHub + 生产实践），现在投入学习收益更大。",
    };
  }

  if (hasGitHub || hasPaper) {
    return {
      term,
      verdict: "yellow",
      essence: `${term} 的本质已可从开源或论文资料中抽象出来，但工程成熟度仍在演进。`,
      coreValue: { description: "有技术原理或实现线索，但可复用的标准实践尚不统一。", conclusion: "价值中等，先做概念和最小验证。" },
      applicationProspect: { description: "可见度较高，但生产化场景密度不足，需要继续跟踪主流框架和生态整合进度。", conclusion: "前景尚早，建议持续关注。" },
      learningCost: { description: "学习资料存在但分散，可能需要补齐模型原理、工程部署或数据处理等前置知识。", conclusion: "成本中等，先按需投入。" },
      verdictReason: "已有技术信号但成熟度未完全收敛，当前适合关注和试水而非重仓。",
    };
  }

  return {
    term,
    verdict: "yellow",
    essence: `${term} 的公开资料较稀疏，暂难形成可靠的第一性原理判定。`,
    coreValue: { description: "未出现稳定且可交叉验证的高质量资料。", conclusion: "价值待评估。" },
    applicationProspect: { description: "缺少明确落地证据，难判断短期实际采用率。", conclusion: "前景不明。" },
    learningCost: { description: "学习路径不清晰，前置要求难以准确估算。", conclusion: "成本未知。" },
    verdictReason: "信息不足，先保持关注，等待更多可验证资料。",
  };
}

function isVerdict(value: unknown): value is Verdict { return value === "green" || value === "yellow" || value === "red"; }
