export type Verdict = "green" | "yellow" | "red";

export type Dimension = {
  description: string;
  conclusion: string;
};

export type AnalysisResult = {
  term: string;
  verdict: Verdict;
  essence: string;
  coreValue: Dimension;
  applicationProspect: Dimension;
  learningCost: Dimension;
  verdictReason: string;
};

export type HistoryItem = AnalysisResult & {
  createdAt: string;
};

export type User = {
  username: string;
  role: "admin";
};

export type ViewMode = "analyze" | "history";
