import { neon } from "@neondatabase/serverless";
import type { AnalysisResult, HistoryItem } from "@/lib/types";

type HistoryRow = {
  term: string;
  verdict: string;
  essence: string;
  core_value: unknown;
  application_prospect: unknown;
  learning_cost: unknown;
  verdict_reason: string;
  created_at: string;
};

let sqlInstance: ReturnType<typeof neon> | null = null;
let schemaReady = false;

function getSql() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }

  if (!sqlInstance) {
    sqlInstance = neon(process.env.DATABASE_URL);
  }

  return sqlInstance;
}

async function ensureSchema() {
  if (schemaReady) return;

  const sql = getSql();

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      username TEXT PRIMARY KEY,
      role TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS search_logs (
      id BIGSERIAL PRIMARY KEY,
      username TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
      term TEXT NOT NULL,
      verdict TEXT NOT NULL,
      essence TEXT NOT NULL,
      core_value JSONB NOT NULL,
      application_prospect JSONB NOT NULL,
      learning_cost JSONB NOT NULL,
      verdict_reason TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS search_logs_username_created_at_idx
    ON search_logs (username, created_at DESC)
  `;

  schemaReady = true;
}

export async function upsertUser(username: string, role: string) {
  await ensureSchema();
  const sql = getSql();

  await sql`
    INSERT INTO users (username, role)
    VALUES (${username}, ${role})
    ON CONFLICT (username)
    DO UPDATE SET role = EXCLUDED.role
  `;
}

export async function insertSearchLog(input: {
  username: string;
  result: AnalysisResult;
}) {
  await ensureSchema();
  const sql = getSql();

  const { username, result } = input;

  await sql`
    INSERT INTO search_logs (
      username,
      term,
      verdict,
      essence,
      core_value,
      application_prospect,
      learning_cost,
      verdict_reason
    )
    VALUES (
      ${username},
      ${result.term},
      ${result.verdict},
      ${result.essence},
      ${JSON.stringify(result.coreValue)},
      ${JSON.stringify(result.applicationProspect)},
      ${JSON.stringify(result.learningCost)},
      ${result.verdictReason}
    )
  `;
}

function parseDimension(value: unknown): { description: string; conclusion: string } {
  if (!value) return { description: "", conclusion: "" };
  if (typeof value === "string") return JSON.parse(value) as { description: string; conclusion: string };
  return value as { description: string; conclusion: string };
}

export async function getSearchHistory(username: string): Promise<HistoryItem[]> {
  await ensureSchema();
  const sql = getSql();

  const rows = (await sql`
    SELECT
      term,
      verdict,
      essence,
      core_value,
      application_prospect,
      learning_cost,
      verdict_reason,
      created_at
    FROM search_logs
    WHERE username = ${username}
    ORDER BY created_at DESC
    LIMIT 12
  `) as HistoryRow[];

  return rows.map((row) => ({
    term: row.term,
    verdict: row.verdict as HistoryItem["verdict"],
    essence: row.essence,
    coreValue: parseDimension(row.core_value),
    applicationProspect: parseDimension(row.application_prospect),
    learningCost: parseDimension(row.learning_cost),
    verdictReason: row.verdict_reason,
    createdAt: row.created_at,
  }));
}
