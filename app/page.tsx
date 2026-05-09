"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type User = {
  username: string;
  role: "admin";
};

type Dimension = {
  description: string;
  conclusion: string;
};

type AnalysisResult = {
  term: string;
  verdict: "green" | "yellow" | "red";
  essence: string;
  coreValue: Dimension;
  applicationProspect: Dimension;
  learningCost: Dimension;
  verdictReason: string;
};

type HistoryItem = AnalysisResult & {
  createdAt: string;
};

type ViewMode = "analyze" | "history";

const colorStyles = {
  green: {
    label: "绿色",
    dot: "bg-emerald-500",
    panel: "border-emerald-300 bg-emerald-50 text-emerald-950",
    badge: "bg-emerald-600 text-white",
    surface: "bg-emerald-100",
  },
  yellow: {
    label: "黄色",
    dot: "bg-yellow-700",
    panel: "border-yellow-400 bg-yellow-100 text-yellow-950",
    badge: "bg-yellow-400 text-yellow-950",
    surface: "bg-yellow-50",
  },
  red: {
    label: "红色",
    dot: "bg-red-500",
    panel: "border-red-300 bg-red-50 text-red-950",
    badge: "bg-red-600 text-white",
    surface: "bg-red-100",
  },
} satisfies Record<
  AnalysisResult["verdict"],
  {
    label: string;
    dot: string;
    panel: string;
    badge: string;
    surface: string;
  }
>;

const starterTerms = ["RAG", "Mamba", "LoRA", "AI Agent", "harness"];

export default function Home() {
  const [term, setTerm] = useState("");
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("analyze");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const storedUser = window.localStorage.getItem("anti-fomo-user");
    const storedToken = window.localStorage.getItem("anti-fomo-token");

    if (storedUser && storedToken) {
      setUser(JSON.parse(storedUser) as User);
      setToken(storedToken);
    }
  }, []);

  useEffect(() => {
    if (!token) return;

    void loadHistory(token);
  }, [token]);

  const canAnalyze = useMemo(
    () => Boolean(user && token && term.trim() && !isAnalyzing),
    [isAnalyzing, term, token, user],
  );

  async function loadHistory(activeToken: string) {
    setIsLoadingHistory(true);

    try {
      const response = await fetch("/api/history", {
        headers: {
          Authorization: `Bearer ${activeToken}`,
        },
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "历史记录加载失败");
      }

      setHistory(data.history as HistoryItem[]);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "历史记录加载失败",
      );
    } finally {
      setIsLoadingHistory(false);
    }
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsLoggingIn(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "登录失败");
      }

      setUser(data.user);
      setToken(data.token);
      setViewMode("analyze");
      window.localStorage.setItem("anti-fomo-user", JSON.stringify(data.user));
      window.localStorage.setItem("anti-fomo-token", data.token);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "登录失败");
    } finally {
      setIsLoggingIn(false);
    }
  }

  function handleLogout() {
    setUser(null);
    setToken("");
    setResult(null);
    setHistory([]);
    setViewMode("analyze");
    window.localStorage.removeItem("anti-fomo-user");
    window.localStorage.removeItem("anti-fomo-token");
  }

  async function handleAnalyze(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    if (!canAnalyze) {
      if (!user) setError("请先使用 admin/admin123 登录");
      return;
    }

    setError("");
    setIsAnalyzing(true);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ term: term.trim() }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "分析失败");
      }

      setResult(data);
      await loadHistory(token);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "分析失败");
    } finally {
      setIsAnalyzing(false);
    }
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-stone-950 px-5 py-8 text-white">
        <section className="w-full max-w-[390px] rounded-[32px] border border-white/10 bg-stone-900 p-4 shadow-2xl">
          <div className="rounded-[24px] bg-paper px-5 pb-6 pt-8 text-ink">
            <div className="mx-auto mb-6 h-1.5 w-16 rounded-full bg-stone-300" />
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-stone-500">
              Anti-FOMO
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">登录</h1>
            <p className="mt-2 text-sm leading-6 text-stone-500">
              README 默认账号：admin / admin123
            </p>

            <form className="mt-8 space-y-5" onSubmit={handleLogin}>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-stone-700">
                  用户名
                </span>
                <input
                  className="h-12 w-full rounded-xl border border-stone-300 bg-white px-4 text-base outline-none transition focus:border-ink focus:ring-2 focus:ring-stone-200"
                  onChange={(event) => setUsername(event.target.value)}
                  value={username}
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-stone-700">
                  密码
                </span>
                <input
                  className="h-12 w-full rounded-xl border border-stone-300 bg-white px-4 text-base outline-none transition focus:border-ink focus:ring-2 focus:ring-stone-200"
                  onChange={(event) => setPassword(event.target.value)}
                  type="password"
                  value={password}
                />
              </label>
              {error ? (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </p>
              ) : null}
              <button
                className="h-12 w-full rounded-xl bg-ink font-semibold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-400"
                disabled={isLoggingIn}
                type="submit"
              >
                {isLoggingIn ? "验证中" : "进入应用"}
              </button>
            </form>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-stone-100 px-4 py-5 text-ink">
      <section className="mx-auto flex min-h-[calc(100vh-40px)] w-full max-w-[440px] flex-col rounded-[32px] border border-stone-200 bg-paper shadow-2xl">
        <header className="px-5 pb-3 pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">
                Anti-FOMO
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight">
                反焦虑学习台
              </h1>
            </div>
            <button
              className="rounded-full border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700"
              onClick={handleLogout}
              type="button"
            >
              退出
            </button>
          </div>

          <div className="mt-5 grid grid-cols-2 rounded-2xl bg-stone-200 p-1">
            <TabButton
              active={viewMode === "analyze"}
              label="AI 名词分析"
              onClick={() => setViewMode("analyze")}
            />
            <TabButton
              active={viewMode === "history"}
              label="个人历史"
              onClick={() => setViewMode("history")}
            />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-5 pb-6">
          {viewMode === "analyze" ? (
            <AnalyzeView
              canAnalyze={canAnalyze}
              error={error}
              handleAnalyze={handleAnalyze}
              isAnalyzing={isAnalyzing}
              result={result}
              setTerm={setTerm}
              term={term}
            />
          ) : (
            <HistoryView
              history={history}
              isLoading={isLoadingHistory}
              onPick={(item) => {
                setTerm(item.term);
                setResult(item);
                setViewMode("analyze");
              }}
            />
          )}
        </div>
      </section>
    </main>
  );
}

function TabButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`h-10 rounded-xl text-sm font-semibold transition ${
        active ? "bg-white text-ink shadow-sm" : "text-stone-500"
      }`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function AnalyzeView({
  canAnalyze,
  error,
  handleAnalyze,
  isAnalyzing,
  result,
  setTerm,
  term,
}: {
  canAnalyze: boolean;
  error: string;
  handleAnalyze: (event?: FormEvent<HTMLFormElement>) => void;
  isAnalyzing: boolean;
  result: AnalysisResult | null;
  setTerm: (term: string) => void;
  term: string;
}) {
  return (
    <div className="space-y-4">
      <form
        className="rounded-2xl border border-stone-200 bg-white p-4"
        onSubmit={handleAnalyze}
      >
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-stone-700">
            AI 技术名词
          </span>
          <input
            className="h-12 w-full rounded-xl border border-stone-300 px-4 text-lg outline-none transition focus:border-ink focus:ring-2 focus:ring-stone-200"
            onChange={(event) => setTerm(event.target.value)}
            placeholder="例如：RAG、Mamba、harness"
            value={term}
          />
        </label>

        <div className="mt-3 flex flex-wrap gap-2">
          {starterTerms.map((starterTerm) => (
            <button
              className="rounded-full border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700"
              key={starterTerm}
              onClick={() => setTerm(starterTerm)}
              type="button"
            >
              {starterTerm}
            </button>
          ))}
        </div>

        <button
          className="mt-4 h-12 w-full rounded-xl bg-ink font-semibold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-400"
          disabled={!canAnalyze}
          type="submit"
        >
          {isAnalyzing ? "分析中" : "开始分析"}
        </button>
      </form>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {result ? (
        <ResultCard result={result} />
      ) : (
        <section className="rounded-2xl border border-dashed border-stone-300 bg-white p-8 text-center">
          <p className="font-medium text-stone-700">
            输入名词后，这里会显示三色判定和第一性原理拆解。
          </p>
        </section>
      )}
    </div>
  );
}

function HistoryView({
  history,
  isLoading,
  onPick,
}: {
  history: HistoryItem[];
  isLoading: boolean;
  onPick: (item: HistoryItem) => void;
}) {
  if (isLoading) {
    return (
      <section className="rounded-2xl border border-dashed border-stone-300 bg-white p-8 text-center">
        <p className="font-medium text-stone-700">正在同步数据库记录</p>
      </section>
    );
  }

  if (!history.length) {
    return (
      <section className="rounded-2xl border border-dashed border-stone-300 bg-white p-8 text-center">
        <p className="font-medium text-stone-700">暂无个人历史</p>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      {history.map((item) => (
        <button
          className="w-full rounded-2xl border border-stone-200 bg-white p-4 text-left shadow-sm transition hover:border-stone-400"
          key={`${item.term}-${item.createdAt}`}
          onClick={() => onPick(item)}
          type="button"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-lg font-semibold">{item.term}</p>
              <p className="mt-1 text-sm text-stone-500">{item.verdictReason}</p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-sm font-semibold ${colorStyles[item.verdict].badge}`}
            >
              {colorStyles[item.verdict].label}
            </span>
          </div>
        </button>
      ))}
    </section>
  );
}

function ResultCard({ result }: { result: AnalysisResult }) {
  const styles = colorStyles[result.verdict];
  const verdictLabel = { green: "投入学习", yellow: "持续关注", red: "暂时观望" }[result.verdict];

  return (
    <section className={`rounded-2xl border-2 p-5 shadow-soft ${styles.panel}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] opacity-70">
            {result.term}
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">
            {verdictLabel}
          </h2>
        </div>
        <div
          className={`flex items-center gap-2 rounded-xl px-3 py-2 ${styles.badge}`}
        >
          <span className={`h-4 w-4 rounded ${styles.dot}`} />
          <span className="font-semibold">{styles.label}</span>
        </div>
      </div>

      <p className="mt-5 text-base leading-7">{result.verdictReason}</p>

      <div className={`mt-5 rounded-xl p-4 ${styles.surface}`}>
        <p className="text-sm font-semibold opacity-70">
          本质（一句话说清楚）
        </p>
        <p className="mt-2 text-base font-semibold leading-7">
          {result.essence}
        </p>
      </div>

      <div className="mt-4 space-y-3">
        <DimensionBlock title="核心价值" dimension={result.coreValue} />
        <DimensionBlock title="应用前景" dimension={result.applicationProspect} />
        <DimensionBlock title="学习成本" dimension={result.learningCost} />
      </div>
    </section>
  );
}

function DimensionBlock({
  title,
  dimension,
}: {
  title: string;
  dimension: Dimension;
}) {
  return (
    <article className="rounded-xl bg-white/75 p-4">
      <h3 className="font-semibold text-ink">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-stone-700">{dimension.description}</p>
      <p className="mt-3 text-sm font-semibold text-stone-600 border-t border-stone-200 pt-2">
        结论：{dimension.conclusion}
      </p>
    </article>
  );
}
