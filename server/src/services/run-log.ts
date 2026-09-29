// Every execution of the review agent is kept: a row in review_runs for the numbers, and a
// directory under data/runs/<runId>/ for what was said — the prompt, the raw stream-json
// events exactly as `claude -p` printed them, and stderr. Nothing is truncated.

import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { getDb } from "../db/schema";
import type { ReviewRunDto, ReviewRunRow, RunSessionDto } from "../../../shared/types";

const RUNS_DIR = path.join(process.cwd(), "data", "runs");
const PROMPT = "prompt.txt";
const STREAM = "stream.jsonl";
const STDERR = "stderr.log";

const runDir = (runId: string) => path.join(RUNS_DIR, runId);
// Run ids are ours (uuids), but the route passes one in from the URL.
const isRunId = (runId: string) => /^[0-9a-f-]{36}$/.test(runId);

export interface RunStats {
  sessionId?: string;
  numTurns?: number;
  durationMs?: number;
  costUsd?: number;
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheCreationTokens?: number;
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

/** The numbers carried by a stream-json `system/init` or `result` event; other events give nothing. */
export function statsFromEvent(event: unknown): RunStats {
  if (!event || typeof event !== "object") return {};
  const e = event as Record<string, unknown>;
  const sessionId = typeof e.session_id === "string" ? e.session_id : undefined;
  if (e.type === "system") return { sessionId };
  if (e.type !== "result") return {};
  const usage = (e.usage ?? {}) as Record<string, unknown>;
  return {
    sessionId,
    numTurns: num(e.num_turns),
    durationMs: num(e.duration_ms),
    costUsd: num(e.total_cost_usd) ?? num(e.cost_usd),
    inputTokens: num(usage.input_tokens),
    outputTokens: num(usage.output_tokens),
    cacheReadTokens: num(usage.cache_read_input_tokens),
    cacheCreationTokens: num(usage.cache_creation_input_tokens),
  };
}

export function createRun(reviewId: string, prompt: string, opts: { model?: string; effort?: string; maxTurns: number; skills: string[] }): string {
  const id = randomUUID();
  fs.mkdirSync(runDir(id), { recursive: true });
  fs.writeFileSync(path.join(runDir(id), PROMPT), prompt);
  getDb()
    .prepare(
      `INSERT INTO review_runs (id, review_id, status, model, effort, max_turns, skills, prompt_chars, started_at)
       VALUES (?, ?, 'running', ?, ?, ?, ?, ?, ?)`
    )
    .run(id, reviewId, opts.model ?? null, opts.effort ?? null, opts.maxTurns, JSON.stringify(opts.skills), prompt.length, new Date().toISOString());
  return id;
}

export function appendStreamLine(runId: string, line: string) {
  fs.appendFileSync(path.join(runDir(runId), STREAM), line + "\n");
}

export function appendStderr(runId: string, text: string) {
  fs.appendFileSync(path.join(runDir(runId), STDERR), text);
}

export function recordStats(runId: string, stats: RunStats) {
  const set: [string, unknown][] = [
    ["session_id", stats.sessionId],
    ["num_turns", stats.numTurns],
    ["duration_ms", stats.durationMs],
    ["cost_usd", stats.costUsd],
    ["input_tokens", stats.inputTokens],
    ["output_tokens", stats.outputTokens],
    ["cache_read_tokens", stats.cacheReadTokens],
    ["cache_creation_tokens", stats.cacheCreationTokens],
  ].filter(([, v]) => v !== undefined) as [string, unknown][];
  if (set.length === 0) return;
  getDb()
    .prepare(`UPDATE review_runs SET ${set.map(([k]) => `${k} = ?`).join(", ")} WHERE id = ?`)
    .run(...set.map(([, v]) => v), runId);
}

export function finishRun(runId: string, status: "reported" | "failed", error?: string) {
  getDb()
    .prepare("UPDATE review_runs SET status = ?, error = ?, finished_at = ? WHERE id = ?")
    .run(status, error ?? null, new Date().toISOString(), runId);
}

/** A run still marked running when the server starts was cut off by the restart. */
export function failInterruptedRuns() {
  getDb()
    .prepare("UPDATE review_runs SET status = 'failed', error = 'interrupted: the server restarted during the run', finished_at = ? WHERE status = 'running'")
    .run(new Date().toISOString());
}

function toRunDto(row: ReviewRunRow): ReviewRunDto {
  return {
    id: row.id,
    reviewId: row.review_id,
    status: row.status as ReviewRunDto["status"],
    model: row.model,
    effort: row.effort,
    maxTurns: row.max_turns,
    skills: JSON.parse(row.skills || "[]"),
    promptChars: row.prompt_chars,
    sessionId: row.session_id,
    numTurns: row.num_turns,
    durationMs: row.duration_ms,
    costUsd: row.cost_usd,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    cacheReadTokens: row.cache_read_tokens,
    cacheCreationTokens: row.cache_creation_tokens,
    error: row.error,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
  };
}

export function listRuns(reviewId: string): ReviewRunDto[] {
  const rows = getDb().prepare("SELECT * FROM review_runs WHERE review_id = ? ORDER BY started_at DESC").all(reviewId) as ReviewRunRow[];
  return rows.map(toRunDto);
}

const readIfExists = (file: string) => (fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "");

/** Parses the stream line by line; a line that is not JSON is kept as a string so nothing is lost. */
export function parseStream(text: string): unknown[] {
  return text
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return l;
      }
    });
}

export function getRunSession(runId: string): RunSessionDto | null {
  if (!isRunId(runId)) return null;
  const row = getDb().prepare("SELECT * FROM review_runs WHERE id = ?").get(runId) as ReviewRunRow | undefined;
  if (!row) return null;
  const dir = runDir(runId);
  return {
    run: toRunDto(row),
    prompt: readIfExists(path.join(dir, PROMPT)),
    events: parseStream(readIfExists(path.join(dir, STREAM))),
    stderr: readIfExists(path.join(dir, STDERR)),
  };
}
