import { neon } from "@neondatabase/serverless";

type HistoryRow = {
  id: number;
  term: string;
  verdict: string;
  essence: string;
  core_value_description: string;
  core_value_conclusion: string;
  application_prospect_description: string;
  application_prospect_conclusion: string;
  learning_cost_description: string;
  learning_cost_conclusion: string;
  verdict_reason: string;
  username: string;
  created_at: string;
};

let sqlInstance: ReturnType<typeof neon> | null = null;
let schemaReady = false;

function getSql() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured");
  }

  if (!sqlInstance) {
    sqlInstance = neon(process.env.DATABASE_URL);
  }

  return sqlInstance;
}

export async function ensureSchema() {
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
      core_value_description TEXT NOT NULL,
      core_value_conclusion TEXT NOT NULL,
      application_prospect_description TEXT NOT NULL,
      application_prospect_conclusion TEXT NOT NULL,
      learning_cost_description TEXT NOT NULL,
      learning_cost_conclusion TEXT NOT NULL,
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
  term: string;
  verdict: string;
  essence: string;
  coreValue: { description: string; conclusion: string };
  applicationProspect: { description: string; conclusion: string };
  learningCost: { description: string; conclusion: string };
  verdictReason: string;
}) {
  await ensureSchema();
  const sql = getSql();

  await sql`
    INSERT INTO search_logs (
      username,
      term,
      verdict,
      essence,
      core_value_description,
      core_value_conclusion,
      application_prospect_description,
      application_prospect_conclusion,
      learning_cost_description,
      learning_cost_conclusion,
      verdict_reason
    )
    VALUES (
      ${input.username},
      ${input.term},
      ${input.verdict},
      ${input.essence},
      ${input.coreValue.description},
      ${input.coreValue.conclusion},
      ${input.applicationProspect.description},
      ${input.applicationProspect.conclusion},
      ${input.learningCost.description},
      ${input.learningCost.conclusion},
      ${input.verdictReason}
    )
  `;
}

export async function getSearchHistory(username: string) {
  await ensureSchema();
  const sql = getSql();

  const rows = (await sql`
    SELECT
      id,
      term,
      verdict,
      essence,
      core_value_description,
      core_value_conclusion,
      application_prospect_description,
      application_prospect_conclusion,
      learning_cost_description,
      learning_cost_conclusion,
      verdict_reason,
      username,
      created_at
    FROM search_logs
    WHERE username = ${username}
    ORDER BY created_at DESC
    LIMIT 12
  `) as HistoryRow[];

  return rows.map((row) => ({
    term: row.term,
    verdict: row.verdict,
    essence: row.essence,
    coreValue: {
      description: row.core_value_description,
      conclusion: row.core_value_conclusion,
    },
    applicationProspect: {
      description: row.application_prospect_description,
      conclusion: row.application_prospect_conclusion,
    },
    learningCost: {
      description: row.learning_cost_description,
      conclusion: row.learning_cost_conclusion,
    },
    verdictReason: row.verdict_reason,
    createdAt: row.created_at,
  }));
}
