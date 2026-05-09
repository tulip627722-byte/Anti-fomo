import { NextResponse } from "next/server";
import { MOCK_ADMIN, getUsernameFromRequest } from "@/lib/auth";
import { insertSearchLog, upsertUser } from "@/lib/db";
import { GoogleGenerativeAI } from "@google/generative-ai";

type Verdict = "green" | "yellow" | "red";

type Dimension = {
  description: string;
  conclusion: string;
};

type AnalyzeBody = {
  term?: string;
};

type AnalyzeResult = {
  term: string;
  verdict: Verdict;
  essence: string;
  coreValue: Dimension;
  applicationProspect: Dimension;
  learningCost: Dimension;
  verdictReason: string;
};

type KnowledgeProfile = {
  verdict: Verdict;
  essence: string;
  coreValue: Dimension;
  applicationProspect: Dimension;
  learningCost: Dimension;
  verdictReason: string;
};

const SYSTEM_PROMPT = `你是一个帮助开发者判断"某项 AI 技术是否值得现在投入学习"的分析助手。

用户输入的词一定是真实存在的 AI 技术或概念，你都必须直接对它本身进行分析。
如果这个词是一个大类（如 AIGC、LLM），就分析这个大类本身的核心机制和当前状态。

用户会给出一个 AI 技术名词，你需要完成以下分析并以 JSON 返回：

第一步：一句话说清楚本质
「[技术名] 的本质是：用 [核心机制] 解决 [之前无法很好解决的具体问题]。」
要求：必须点出核心机制，必须指出它解决的问题。

第二步：三维度判断
1. 核心价值：它解决了什么之前做不到或做不好的具体问题？和替代方案相比的不可替代性。最后一句话结论。
2. 应用前景：未来 1-2 年普通开发者遇到的概率？已有哪些具体落地场景？最后一句话结论。
3. 学习成本：从零到能独立使用需要多少时间？必须掌握哪些前置知识？最后一句话结论。

第三步：给出判决
基于三维度，综合给出判决颜色和 1-2 句话说明理由。

只输出 JSON，不要输出 Markdown。必须符合以下格式：
{
  "verdict": "green" | "yellow" | "red",
  "essence": "一句话本质（[技术名] 的本质是：...）",
  "coreValue": {
    "description": "核心价值具体说明（2-3句）",
    "conclusion": "价值高 / 价值中等 / 价值存疑，理由是……"
  },
  "applicationProspect": {
    "description": "应用前景具体说明（2-3句，要举具体场景）",
    "conclusion": "前景明确 / 前景尚早 / 前景局限，理由是……"
  },
  "learningCost": {
    "description": "学习成本具体说明（2-3句，列出前置知识）",
    "conclusion": "成本低 / 成本中等 / 成本高，理由是……"
  },
  "verdictReason": "判决理由（1-2句话说明为什么是这个颜色）"
}

判决标准：
- green（投入学习）：核心价值强且不可替代、落地场景明确、学习成本与收益匹配
- yellow（持续关注）：有潜力但至少一个维度尚不成熟，现在了解概念即可
- red（暂时观望）：价值不清、场景局限、或学习成本远超当前收益`;

const PROFILES: Record<string, KnowledgeProfile> = {
  rag: {
    verdict: "green",
    essence: "RAG 的本质是：用检索+生成的拼接机制，解决大模型知识截止日期和幻觉问题。",
    coreValue: {
      description:
        "它解决的是大模型不知道私有知识、知识过期、回答不可追溯的问题。核心价值不在生成，而在检索质量和引用依据。相比只微调模型的方案，RAG 能灵活更新知识库而无需重新训练。",
      conclusion: "价值高，解决了大模型应用中的核心问题。",
    },
    applicationProspect: {
      description:
        "客服、内部知识库、投研、法务和代码库问答都有生产案例。预计 1-2 年内普通开发者在构建 LLM 应用时大概率会接触到这个技术。",
      conclusion: "前景明确，落地场景丰富。",
    },
    learningCost: {
      description:
        "需要理解 embedding、向量库、chunking、rerank 和评测。预计 3-5 天的学习和实践。前置知识包括 LLM 基础、向量表示、SQL/NoSQL。",
      conclusion: "成本中等，有一定前置要求但可接受。",
    },
    verdictReason:
      "核心价值强、应用场景明确、学习成本合理，现在投入学习收益最大。",
  },
  mamba: {
    verdict: "yellow",
    essence:
      "Mamba 的本质是：用选择性状态空间模型替代注意力的一部分长序列计算。",
    coreValue: {
      description:
        "它尝试降低长上下文建模的计算和内存压力，价值集中在长序列、流式处理和特定硬件友好场景。相比 Transformer，在某些长序列场景下性能更优，但通用能力还未完全超越。",
      conclusion: "价值中等，在特定场景有优势但不可替代性待验证。",
    },
    applicationProspect: {
      description:
        "研究价值明确，但工程生态、预训练模型、工具链和主流 LLM 集成仍弱于 Transformer 路线。短期内适用场景有限。",
      conclusion: "前景尚早，生态成熟度需进一步观察。",
    },
    learningCost: {
      description:
        "需要线性系统、深度学习架构和序列建模基础。预计 5-7 天了解原理。前置知识包括状态空间模型、RNN 变体、计算复杂度分析。",
      conclusion: "成本中等，有一定数学基础要求。",
    },
    verdictReason:
      "有潜力但生态和通用性还不成熟，建议先了解概念，持续关注发展。",
  },
  lora: {
    verdict: "green",
    essence: "LoRA 的本质是：用低秩增量矩阵近似权重更新，解决大模型微调成本高的问题。",
    coreValue: {
      description:
        "它解决的是全量微调显存高、成本高、难管理的问题，让小数据定制和多 adapter 切换变得可行。相比全量微调，LoRA 参数量少 99%，训练速度快 10 倍。",
      conclusion: "价值高，已成为模型定制的标准方案。",
    },
    applicationProspect: {
      description:
        "在风格迁移、领域微调、图像模型和开源 LLM 定制中都很常见。生产级应用广泛，几乎所有开源大模型都支持 LoRA。",
      conclusion: "前景明确，生态成熟度最高。",
    },
    learningCost: {
      description:
        "成本较低，掌握矩阵分解直觉、训练数据格式和推理合并方式即可开始实践。预计 2-3 天能跑通完整工作流。",
      conclusion: "成本低，是微调入门的最佳选择。",
    },
    verdictReason:
      "成熟可靠、应用广泛、学习成本最低，现在投入学习收益明确。",
  },
  "ai agent": {
    verdict: "green",
    essence:
      "AI Agent 的本质是：让模型在目标、工具、记忆和反馈循环里完成多步任务。",
    coreValue: {
      description:
        "它解决的是单轮生成无法执行复杂工作流的问题，价值来自任务分解、工具调用和状态管理。相比传统编程，Agent 降低了自动化的编码成本。",
      conclusion: "价值高，是大模型落地的关键形态。",
    },
    applicationProspect: {
      description:
        "代码助手、数据分析、运维、销售运营和内部自动化都在落地。预计 1-2 年内会成为 LLM 应用的标准范式。",
      conclusion: "前景明确，应用方向多元。",
    },
    learningCost: {
      description:
        "需要会 prompt、函数调用、工作流编排、错误恢复和安全边界。预计 5-7 天从入门到能自己设计简单 agent。前置知识：LLM 基础、JSON 序列化、API 调用。",
      conclusion: "成本中等，涉及多个知识领域。",
    },
    verdictReason:
      "应用前景广、正在快速成熟，现在学习能抓住行业发展的新机遇。",
  },
  harness: {
    verdict: "yellow",
    essence:
      "Harness 的本质是：把模型、任务、数据、评测指标和运行环境固定成可重复的测试装置。",
    coreValue: {
      description:
        "它解决的不是模型能力本身，而是'怎么稳定比较、复现和回归验证模型表现'的工程问题。价值取决于你是否需要严谨的评测流程。",
      conclusion: "价值中等，主要解决工程问题而非能力问题。",
    },
    applicationProspect: {
      description:
        "在模型评测、agent 回归测试、prompt 版本管理和 CI 流程里有用，但通常作为基础设施的一部分出现，而非直接应用。",
      conclusion: "前景局限，是支撑性工具而非核心技术。",
    },
    learningCost: {
      description:
        "概念成本低，难点在指标设计、测试集质量和自动化接入。预计 3-5 天理解核心思路。",
      conclusion: "成本低，但深度应用需要更多工程经验。",
    },
    verdictReason:
      "有工程价值但适用面有限，建议先掌握评测思路，需要时再深入具体工具。",
  },
  transformer: {
    verdict: "green",
    essence:
      "Transformer 的本质是：用自注意力让序列里的每个 token 动态读取其他 token 的信息。",
    coreValue: {
      description:
        "它解决了长距离依赖和并行训练问题，是 LLM、视觉 Transformer 和多模态模型的共同底座。理解 Transformer 是读懂现代 AI 的基础。",
      conclusion: "价值高且不可替代，几乎所有主流模型都基于它。",
    },
    applicationProspect: {
      description:
        "几乎所有主流大模型都绕不开它，理解它能帮助你读论文、调模型、判断新架构宣传是否靠谱。",
      conclusion: "前景明确，长期学习价值最高。",
    },
    learningCost: {
      description:
        "学习成本中高，需要矩阵运算、注意力机制和训练流程基础。预计 7-10 天深入理解。但投入回报非常稳定。",
      conclusion: "成本高，但回报最为持久。",
    },
    verdictReason:
      "基础性知识、长期价值高，是深入 AI 的必修课。",
  },
};

// ==================== 搜索引擎配置 ====================

interface SearchResult {
  title: string;
  snippet: string;
  link: string;
}

/**
 * 通过 SerpAPI 进行全网搜索
 * 环境变量: SEARCH_PROVIDER=serpapi, SERPAPI_API_KEY
 */
async function searchWeb(term: string): Promise<SearchResult[]> {
  const provider = process.env.SEARCH_PROVIDER || "serpapi";

  switch (provider) {
    case "serpapi":
      return searchSerpApi(term);
    case "google":
      return searchGoogle(term);
    case "bing":
      return searchBing(term);
    default:
      return searchSerpApi(term);
  }
}

async function searchSerpApi(term: string): Promise<SearchResult[]> {
  const apiKey = process.env.SERPAPI_API_KEY;
  if (!apiKey) throw new Error("SerpAPI 未配置");

  const url = new URL("https://serpapi.com/search");
  url.searchParams.set("engine", "google");
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("q", `${term} AI`);
  url.searchParams.set("num", "8");
  url.searchParams.set("hl", "zh-cn");

  const response = await fetch(url.toString());
  if (!response.ok) throw new Error("SerpAPI 请求失败");

  const data = (await response.json()) as {
    organic_results?: Array<{ title: string; snippet: string; link: string }>;
  };

  return (data.organic_results || []).map((item) => ({
    title: item.title,
    snippet: item.snippet,
    link: item.link,
  }));
}

async function searchGoogle(term: string): Promise<SearchResult[]> {
  const apiKey = process.env.GOOGLE_API_KEY;
  const cseId = process.env.GOOGLE_CSE_ID;
  if (!apiKey || !cseId) throw new Error("Google Search API 未配置");

  const url = new URL("https://www.googleapis.com/customsearch/v1");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("cx", cseId);
  url.searchParams.set("q", `${term} AI`);
  url.searchParams.set("num", "8");

  const response = await fetch(url.toString());
  if (!response.ok) throw new Error("Google Search 请求失败");

  const data = (await response.json()) as {
    items?: Array<{ title: string; snippet: string; link: string }>;
  };

  return (data.items || []).map((item) => ({
    title: item.title,
    snippet: item.snippet,
    link: item.link,
  }));
}

async function searchBing(term: string): Promise<SearchResult[]> {
  const apiKey = process.env.BING_API_KEY;
  if (!apiKey) throw new Error("Bing Search API 未配置");

  const response = await fetch(
    `https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(`${term} AI`)}&count=8`,
    { headers: { "Ocp-Apim-Subscription-Key": apiKey } },
  );
  if (!response.ok) throw new Error("Bing Search 请求失败");

  const data = (await response.json()) as {
    webPages?: { value: Array<{ name: string; snippet: string; url: string }> };
  };

  return (data.webPages?.value || []).map((item) => ({
    title: item.name,
    snippet: item.snippet,
    link: item.url,
  }));
}

/**
 * 从全网搜索结果生成分析报告
 */
function generateFromSearchResults(
  term: string,
  results: SearchResult[],
): AnalyzeResult {
  const snippets = results
    .map((r) => r.snippet)
    .filter(Boolean)
    .join(" ");

  const hasTutorial = /教程|指南|tutorial|guide|getting started|入门/i.test(
    snippets,
  );
  const hasProduction = /生产|部署|production|deploy|enterprise/i.test(
    snippets,
  );
  const hasGitHub = /github|开源|open source/i.test(snippets);
  const hasPaper = /论文|paper|arxiv|研究|research/i.test(snippets);

  if (hasProduction && hasTutorial && hasGitHub) {
    return {
      term,
      verdict: "green",
      essence: `${term} 的本质可以从搜索结果中的多个权威资料找到，建议综合学习。`,
      coreValue: {
        description: `全网搜索显示该技术在社区和生产中被广泛讨论${
          hasProduction ? "，有生产级实践案例验证" : ""
        }。`,
        conclusion: "价值高，已有成熟应用验证。",
      },
      applicationProspect: {
        description: `搜索结果中${hasPaper ? "有学术论文" : ""}${
          hasGitHub ? "和开源项目" : ""
        }${hasProduction ? "且存在生产部署案例" : ""}。`,
        conclusion: "前景明确，应用场景广泛。",
      },
      learningCost: {
        description: `搜索结果中包含${
          hasTutorial ? "入门教程和最佳实践" : "丰富的技术资料"
        }，学习路径清晰。`,
        conclusion: "成本低，有充分学习资源。",
      },
      verdictReason: `全网搜索结果（${results.length} 条）显示该技术有完善的学习资源、开源实现和生产案例，现在投入学习收益最大。`,
    };
  }

  if (hasGitHub || hasPaper) {
    return {
      term,
      verdict: "yellow",
      essence: `${term} 的原理可从搜索到的${
        hasPaper ? "论文和" : ""
      }${hasGitHub ? "代码实现" : "文档"}中理解。`,
      coreValue: {
        description: `搜索结果中找到了该技术的${
          hasPaper ? "学术研究验证" : ""
        }${hasGitHub ? "和开源实现" : ""}，但核心价值和不可替代性需进一步理解。`,
        conclusion: "价值中等，研究阶段或早期应用。",
      },
      applicationProspect: {
        description: `目前${hasPaper ? "处于活跃研究阶段" : ""}，生产级应用案例正在发展，建议持续关注社区动态和新进展。`,
        conclusion: "前景尚早，需观察主流发展方向。",
      },
      learningCost: {
        description: `从搜索结果看有${
          hasTutorial ? "部分入门资料" : "相关技术资源"
        }，但深入理解需要一定基础。`,
        conclusion: "成本中等，取决于学习深度。",
      },
      verdictReason: `全网搜索显示该技术有学术和开源支持，但生产案例和教程还需进一步发展，建议持续关注。`,
    };
  }

  return {
    term,
    verdict: "yellow",
    essence: `${term} 是一个有关注价值的技术概念，具体定义建议从搜索到的权威来源获取。`,
    coreValue: {
      description: `搜索结果中提到了该技术，但判断其核心价值还需要更深入的行业洞察和实战验证。`,
      conclusion: "价值中等，信息分散需进一步整理。",
    },
    applicationProspect: {
      description: `搜索到${results.length}条结果，但落地方向和主流生态应用仍需进一步发展和验证。`,
      conclusion: "前景尚早，建议保持观察。",
    },
    learningCost: {
      description: `学习材料较为分散，建议先从搜索结果中的高质量权威来源开始了解基本概念。`,
      conclusion: "成本中等，学习路径不太清晰。",
    },
    verdictReason: `关于 ${term} 的信息还不够系统，建议先了解概念，再根据具体应用场景决定投入深度。`,
  };
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as AnalyzeBody;
  const term = body.term?.trim();

  if (!term) {
    return NextResponse.json(
      { message: "请输入 AI 技术名词" },
      { status: 400 },
    );
  }

  const result = await analyzeTerm(term);
  const username = getUsernameFromRequest(request) ?? MOCK_ADMIN.username;

  await upsertUser(username, MOCK_ADMIN.role);
  await insertSearchLog({
    username,
    term: result.term,
    verdict: result.verdict,
    essence: result.essence,
    coreValue: result.coreValue,
    applicationProspect: result.applicationProspect,
    learningCost: result.learningCost,
    verdictReason: result.verdictReason,
  });

  return NextResponse.json(result);
}

async function analyzeTerm(term: string): Promise<AnalyzeResult> {
  const apiKey = process.env.API_KEY;

  if (!apiKey) {
    return await fallbackAnalyze(term);
  }

  try {
    const parsed = isDashScopeCompatible()
      ? await callDashScopeModel(term, apiKey)
      : await callStandardModel(term, apiKey);

    if (!hasUsefulParsedResult(parsed)) {
      return await fallbackAnalyze(term);
    }

    return normalizeResult(term, parsed);
  } catch {
    return await fallbackAnalyze(term);
  }
}

async function callStandardModel(term: string, apiKey: string) {
  const response = await fetch(getApiBaseUrl() + "/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.AI_MODEL ?? "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `技术名词：${term}` },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error("model request failed");
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  return parseModelJson(data.choices?.[0]?.message?.content);
}

async function callDashScopeModel(term: string, apiKey: string) {
  const response = await fetch(getApiBaseUrl() + "/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.AI_MODEL ?? "qvq-max",
      stream: true,
      temperature: 0.2,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `技术名词：${term}` },
      ],
    }),
  });

  if (!response.ok || !response.body) {
    throw new Error("dashscope request failed");
  }

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
          const parsed = JSON.parse(payload) as {
            choices?: Array<{
              delta?: {
                content?: string;
                reasoning_content?: string;
              };
              message?: {
                content?: string;
              };
            }>;
          };

          const choice = parsed.choices?.[0];
          content += choice?.delta?.content ?? choice?.message?.content ?? "";
        } catch {
          continue;
        }
      }
    }
  }

  return parseModelJson(content);
}

function getApiBaseUrl() {
  return process.env.API_BASE_URL ?? "https://api.openai.com/v1";
}

function isDashScopeCompatible() {
  const apiBase = getApiBaseUrl().toLowerCase();
  const model = (process.env.AI_MODEL ?? "").toLowerCase();

  return apiBase.includes("dashscope") || model.startsWith("qvq");
}

function parseModelJson(content: string | undefined) {
  if (!content) return null;

  try {
    return JSON.parse(content) as Partial<AnalyzeResult>;
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return null;

    try {
      return JSON.parse(match[0]) as Partial<AnalyzeResult>;
    } catch {
      return null;
    }
  }
}

function hasUsefulParsedResult(result: Partial<AnalyzeResult> | null) {
  if (!result) return false;

  return Boolean(
    result.verdict ||
      result.essence ||
      result.coreValue ||
      result.applicationProspect ||
      result.learningCost ||
      result.verdictReason,
  );
}

function normalizeResult(
  term: string,
  result: Partial<AnalyzeResult> | null,
): AnalyzeResult {
  const verdict = isVerdict(result?.verdict) ? result.verdict : "yellow";

  return {
    term,
    verdict,
    essence:
      result?.essence ||
      `${term} 的本质是解决某个具体的技术或工程问题，建议从权威资料中获取准确定义。`,
    coreValue: result?.coreValue || {
      description: `先问 ${term} 解决的是能力、成本、数据还是流程问题，再判断它是否优于现有方案。`,
      conclusion: "价值中等，需要结合具体场景判断。",
    },
    applicationProspect: result?.applicationProspect || {
      description: `观察 ${term} 是否进入真实工具链、生产案例和稳定生态，而不只停留在讨论热度。`,
      conclusion: "前景尚早，建议继续关注。",
    },
    learningCost: result?.learningCost || {
      description: `先用一小时建立 ${term} 的概念地图，再用一个小实验验证是否值得深入。`,
      conclusion: "成本中等，取决于具体应用场景。",
    },
    verdictReason: result?.verdictReason || "该技术有观察价值，但需要结合具体场景判断投入深度。",
  };
}

async function fallbackAnalyze(term: string): Promise<AnalyzeResult> {
  // 1. 优先全网搜索
  try {
    const searchResults = await searchWeb(term);
    if (searchResults.length > 0) {
      return generateFromSearchResults(term, searchResults);
    }
  } catch {
    // 搜索失败，走本地兜底
  }

  // 2. 本地兜底：硬编码列表
  const lowerTerm = term.toLowerCase();
  const directKey = Object.keys(PROFILES).find(
    (key) => lowerTerm === key || lowerTerm.includes(key),
  );

  if (directKey) {
    return normalizeResult(term, PROFILES[directKey]);
  }

  // 3. 本地兜底：关键词推断
  const profile = inferProfile(term);
  return normalizeResult(term, profile);
}

function inferProfile(term: string): KnowledgeProfile {
  const lowerTerm = term.toLowerCase();

  if (
    lowerTerm.includes("web3") ||
    lowerTerm.includes("blockchain") ||
    lowerTerm.includes("metaverse")
  ) {
    return {
      verdict: "red",
      essence: `${term} 的本质是把热门叙事概念组合，但技术闭环和商业模式仍不清晰。`,
      coreValue: {
        description:
          "核心价值需要证明它比现有 AI 工作流多解决了什么问题。如果只是换包装，学习优先级应降低。",
        conclusion: "价值存疑，缺乏明确的实际应用场景。",
      },
      applicationProspect: {
        description:
          "短期更多是概念炒作，真实应用案例和稳定生态仍在探索中。",
        conclusion: "前景局限，建议观望主流方向的发展。",
      },
      learningCost: {
        description:
          "不建议现在系统投入，保持概念级了解即可，把时间留给更基础、更可迁移的技术。",
        conclusion: "成本低，但收益不确定。",
      },
      verdictReason:
        "价值模糊、应用案例不足、投入产出比不清晰，建议暂时观望。",
    };
  }

  if (
    lowerTerm.includes("eval") ||
    lowerTerm.includes("benchmark") ||
    lowerTerm.includes("test")
  ) {
    return {
      verdict: "yellow",
      essence: `${term} 的本质是把模型表现从主观感觉变成可重复、可比较的量化证据。`,
      coreValue: {
        description:
          "它解决模型效果难复现、版本难比较的问题。但指标设计不当会制造新的错觉，价值高度依赖具体场景。",
        conclusion: "价值中等，工程价值明确但不是核心能力。",
      },
      applicationProspect: {
        description:
          "适合进入团队的模型上线、prompt 迭代和 agent 回归流程。个人学习可先抓住评测方法论。",
        conclusion: "前景明确，但更多是支撑性工具。",
      },
      learningCost: {
        description:
          "概念不难，难点在指标设计、测试集质量和自动化接入。预计 3-5 天理解核心。",
        conclusion: "成本低，深度应用需要工程经验。",
      },
      verdictReason:
        "工程价值明确但适用面有限，可先掌握方法论，需要时再深入。",
    };
  }

  return {
    verdict: "yellow",
    essence: `${term} 的本质需要拆成"输入是什么、核心变换是什么、输出改善了什么"来判断。`,
    coreValue: {
      description: `判断 ${term} 时先看它是否解决一个根本问题，而不是只提供一个更好听的分类名。`,
      conclusion: "价值中等，需要结合具体应用判断。",
    },
    applicationProspect: {
      description:
        "如果已有稳定开源实现、真实客户案例和可衡量收益，才值得从关注升级为投入。",
      conclusion: "前景尚早，建议保持观察。",
    },
    learningCost: {
      description: `先读一篇权威介绍和一个最小实践，记录 ${term} 依赖的前置知识，再决定是否深入。`,
      conclusion: "成本中等，取决于具体应用。",
    },
    verdictReason: "它可能有价值，但成熟度和适用范围仍需观察。建议先了解概念。",
  };
}

function isVerdict(verdict: unknown): verdict is Verdict {
  return verdict === "green" || verdict === "yellow" || verdict === "red";
}
