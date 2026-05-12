"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type {
  AnalysisResult,
  Dimension,
  HistoryItem,
  User,
  Verdict,
  ViewMode,
} from "@/lib/types";

const QUICK_TERMS = ["RAG", "Mamba", "LoRA", "AI Agent", "harness"];

const verdictStyles: Record<
  Verdict,
  {
    label: string;
    panel: string;
    badge: string;
    surface: string;
  }
> = {
  green: {
    label: "绿色",
    panel: "border-emerald-300 bg-emerald-50 text-emerald-900",
    badge: "bg-emerald-600 text-white",
    surface: "bg-emerald-100",
  },
  yellow: {
    label: "黄色",
    panel: "border-amber-300 bg-amber-50 text-amber-900",
    badge: "bg-amber-500 text-amber-950",
    surface: "bg-amber-100",
  },
  red: {
    label: "红色",
    panel: "border-red-300 bg-red-50 text-red-900",
    badge: "bg-red-600 text-white",
    surface: "bg-red-100",
  },
};

export default function Home() {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("analyze");

  const [term, setTerm] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const storedUser = localStorage.getItem("anti-fomo-user");
    const storedToken = localStorage.getItem("anti-fomo-token");
    if (storedUser && storedToken) {
      setUser(JSON.parse(storedUser) as User);
      setToken(storedToken);
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    void fetchHistory(token);
  }, [token]);

  const canAnalyze = useMemo(() => {
    return Boolean(user && token && term.trim() && !isAnalyzing);
  }, [isAnalyzing, term, token, user]);

  async function fetchHistory(authToken: string) {
    setIsLoadingHistory(true);
    try {
      const res = await fetch("/api/history", {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "加载历史失败");
      setHistory(data.history as HistoryItem[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载历史失败");
    } finally {
      setIsLoadingHistory(false);
    }
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsLoggingIn(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.message || "登录失败");

      setUser(data.user as User);
      setToken(data.token as string);
      localStorage.setItem("anti-fomo-user", JSON.stringify(data.user));
      localStorage.setItem("anti-fomo-token", data.token as string);
    } catch (e) {
      setError(e instanceof Error ? e.message : "登录失败");
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
    localStorage.removeItem("anti-fomo-user");
    localStorage.removeItem("anti-fomo-token");
  }

  async function handleAnalyze(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!canAnalyze) return;

    setError("");
    setIsAnalyzing(true);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ term: term.trim() }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "分析失败");

      setResult(data as AnalysisResult);
      await fetchHistory(token);
    } catch (e) {
      setError(e instanceof Error ? e.message : "分析失败");
    } finally {
      setIsAnalyzing(false);
    }
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 py-10">
        <section className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-xl">
          <h1 className="text-2xl font-bold text-stone-900">Anti-FOMO 登录</h1>
          <p className="mt-2 text-sm text-stone-600">默认账号：admin / admin123</p>

          <form className="mt-6 space-y-4" onSubmit={handleLogin}>
            <input
              className="h-11 w-full rounded-xl border border-stone-300 px-3 outline-none focus:border-stone-700"
              onChange={(e) => setUsername(e.target.value)}
              value={username}
            />
            <input
              className="h-11 w-full rounded-xl border border-stone-300 px-3 outline-none focus:border-stone-700"
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              value={password}
            />
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <button
              className="h-11 w-full rounded-xl bg-stone-900 font-medium text-white disabled:bg-stone-400"
              disabled={isLoggingIn}
              type="submit"
            >
              {isLoggingIn ? "登录中..." : "登录"}
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-8">
      <section className="mx-auto w-full max-w-3xl rounded-3xl border border-stone-200 bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-stone-900">Anti-FOMO</h1>
            <p className="text-sm text-stone-600">AI 名词判决台</p>
          </div>
          <button className="rounded-lg border border-stone-300 px-3 py-2 text-sm" onClick={handleLogout} type="button">
            退出
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-stone-100 p-1">
          <button
            className={`h-10 rounded-lg text-sm font-medium ${viewMode === "analyze" ? "bg-white" : "text-stone-600"}`}
            onClick={() => setViewMode("analyze")}
            type="button"
          >
            分析
          </button>
          <button
            className={`h-10 rounded-lg text-sm font-medium ${viewMode === "history" ? "bg-white" : "text-stone-600"}`}
            onClick={() => setViewMode("history")}
            type="button"
          >
            历史
          </button>
        </div>

        {viewMode === "analyze" ? (
          <div className="mt-4 space-y-4">
            <form className="rounded-2xl border border-stone-200 p-4" onSubmit={handleAnalyze}>
              <input
                className="h-12 w-full rounded-xl border border-stone-300 px-3 text-lg outline-none focus:border-stone-700"
                onChange={(e) => setTerm(e.target.value)}
                placeholder="输入 AI 名词，如 RAG"
                value={term}
              />
              <div className="mt-3 flex flex-wrap gap-2">
                {QUICK_TERMS.map((item) => (
                  <button
                    className="rounded-full border border-stone-300 px-3 py-1 text-sm"
                    key={item}
                    onClick={() => setTerm(item)}
                    type="button"
                  >
                    {item}
                  </button>
                ))}
              </div>
              <button
                className="mt-4 h-11 w-full rounded-xl bg-stone-900 text-white disabled:bg-stone-400"
                disabled={!canAnalyze}
                type="submit"
              >
                {isAnalyzing ? "分析中..." : "开始分析"}
              </button>
            </form>

            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            {result ? <ResultCard result={result} /> : null}
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {isLoadingHistory ? <p className="text-sm text-stone-600">加载历史中...</p> : null}
            {!isLoadingHistory && history.length === 0 ? <p className="text-sm text-stone-600">暂无历史</p> : null}
            {history.map((item) => (
              <button
                className="w-full rounded-xl border border-stone-200 p-3 text-left"
                key={`${item.term}-${item.createdAt}`}
                onClick={() => {
                  setTerm(item.term);
                  setResult(item);
                  setViewMode("analyze");
                }}
                type="button"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-stone-900">{item.term}</p>
                    <p className="text-sm text-stone-600">{item.verdictReason}</p>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold ${verdictStyles[item.verdict].badge}`}>
                    {verdictStyles[item.verdict].label}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function ResultCard({ result }: { result: AnalysisResult }) {
  const style = verdictStyles[result.verdict];

  return (
    <section className={`rounded-2xl border p-4 ${style.panel}`}>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">{result.term}</h2>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${style.badge}`}>{style.label}</span>
      </div>

      <p className="mt-3 text-sm">{result.verdictReason}</p>
      <div className={`mt-3 rounded-xl p-3 ${style.surface}`}>
        <p className="text-xs font-semibold">本质</p>
        <p className="mt-1 text-sm">{result.essence}</p>
      </div>

      <div className="mt-3 space-y-2">
        <DimensionCard title="核心价值" dimension={result.coreValue} />
        <DimensionCard title="应用前景" dimension={result.applicationProspect} />
        <DimensionCard title="学习成本" dimension={result.learningCost} />
      </div>
    </section>
  );
}

function DimensionCard({ title, dimension }: { title: string; dimension: Dimension }) {
  return (
    <article className="rounded-xl bg-white/80 p-3">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm">{dimension.description}</p>
      <p className="mt-2 border-t border-stone-200 pt-2 text-sm font-medium text-stone-700">结论：{dimension.conclusion}</p>
    </article>
  );
}
