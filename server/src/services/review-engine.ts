import { spawn, spawnSync } from "node:child_process";
import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import os from "node:os";
import { getDb } from "../db/schema";
import {
  fetchPrDiff,
  fetchPrSnapshot,
  fetchExistingReviews,
  type PrSnapshot,
  type ExistingReview,
  type ExistingReviewComment,
} from "./github";
import { parseReport } from "./findings-parser";
import { splitUnifiedDiff } from "./diff-utils";
import { getLocalDiff, getLatestCommitMessage, localRepoIdentity } from "./local-git";
import type { Finding, Report, ReviewEvent } from "../../../shared/types";

export const reviewEvents = new EventEmitter();
reviewEvents.setMaxListeners(0);

const CLAUDE_CANDIDATES = ["claude", `${os.homedir()}/.local/bin/claude`, "/opt/homebrew/bin/claude", "/usr/local/bin/claude"];
const MAX_DIFF_CHARS_PER_FILE = 20_000;

let resolvedClaudePath: string | null = null;

function log(prefix: string, ...args: unknown[]): void {
  console.log(`[review-engine] [${prefix}]`, ...args);
}

export function reviewId(repo: string, number: number): string {
  return `${repo}#${number}`;
}

function emit(id: string, type: ReviewEvent["type"], data: unknown): void {
  const event: ReviewEvent = { type, reviewId: id, data };
  log("emit", `${type} for ${id}`, JSON.stringify(data).slice(0, 200));
  reviewEvents.emit(id, event);
}

function resolveClaudePath(): string {
  if (resolvedClaudePath) return resolvedClaudePath;

  log("claude", "resolving claude binary...");
  for (const candidate of CLAUDE_CANDIDATES) {
    log("claude", `trying ${candidate}...`);
    const probe = spawnSync(candidate, ["--version"], { timeout: 5_000 });
    if (!probe.error) {
      resolvedClaudePath = candidate;
      log("claude", `resolved to ${candidate} (${probe.stdout?.toString().trim()})`);
      return candidate;
    }
    log("claude", `${candidate} failed: ${probe.error.message}`);
  }

  log("claude", "WARNING: no claude binary found, defaulting to 'claude'");
  resolvedClaudePath = "claude";
  return resolvedClaudePath;
}

const FINDINGS_SCHEMA_TEXT = `{
  "summary": "short overall summary of the review",
  "findings": [
    {
      "file": "path/relative/to/repo/root.ts",
      "startLine": 10,
      "endLine": 12,
      "side": "RIGHT",
      "severity": "blocker | high | medium | low | nit",
      "category": "short category label",
      "title": "one line title",
      "summary": "one paragraph summary",
      "background": "why this matters",
      "problem": "what is wrong",
      "suggestedFix": "how to fix it",
      "suggestedComment": "the exact text to post as a PR review comment",
      "references": [{ "file": "path.ts", "startLine": 1, "endLine": 2, "note": "related context" }]
    }
  ]
}`;

function truncateDiff(diff: string): string {
  const files = splitUnifiedDiff(diff);
  if (files.length === 0) return diff;

  return files
    .map((f) =>
      f.patch.length > MAX_DIFF_CHARS_PER_FILE ? `${f.patch.slice(0, MAX_DIFF_CHARS_PER_FILE)}\n... [truncated]` : f.patch
    )
    .join("\n");
}

interface ExistingReviewContext {
  reviews: ExistingReview[];
  comments: ExistingReviewComment[];
}

function formatExistingReviews(ctx: ExistingReviewContext): string {
  const reviewBlocks = ctx.reviews
    .filter((r) => r.body.trim() !== "")
    .map((r) => `### Review de ${r.author} (${r.state})\n${r.body}`);

  const commentBlocks = ctx.comments.map((c) => {
    const where = c.path ? `${c.path}${c.line !== null ? `:${c.line}` : ""}` : "(général)";
    return `### ${c.author} sur \`${where}\`\n${c.body}`;
  });

  if (reviewBlocks.length === 0 && commentBlocks.length === 0) return "";

  return `
## Reviews existantes sur cette PR
Ces reviews ont déjà été postées (par Greptile ou d'autres reviewers). Ton rôle est de les CHALLENGER, pas de les répéter :
- Pour chaque point soulevé, vérifie-le dans le code : est-il fondé, exagéré, ou faux ?
- Signale les faux positifs et les points mal cadrés dans le \`summary\` global.
- Ne redonne PAS un finding pour un point déjà correctement soulevé — mentionne-le plutôt dans le summary comme « déjà couvert ».
- Cherche ce qu'elles ont MANQUÉ : c'est là que tu apportes de la valeur.
- Si un point existant mérite un contre-argument, produis un finding dont le \`suggestedComment\` répond explicitement à ce point.

${[...reviewBlocks, ...commentBlocks].join("\n\n")}
`;
}

interface PromptOptions {
  skills: string[];
  existing?: ExistingReviewContext;
}

function buildPrompt(subjectLine: string, snapshot: PrSnapshot, diff: string, options: PromptOptions): string {
  const { skills, existing } = options;
  const fileList = (snapshot.files ?? [])
    .map((f) => {
      const file = f as { path?: string; additions?: number; deletions?: number };
      return `- ${file.path} (+${file.additions ?? 0}/-${file.deletions ?? 0})`;
    })
    .join("\n");

  const instructions =
    skills.length > 0
      ? `Run each of these review skills, in order, and merge what they find:\n${skills.map((s) => `- ${s}`).join("\n")}`
      : "Review the change for correctness bugs, missing tests, security issues, and design problems.";

  const existingSection = existing ? formatExistingReviews(existing) : "";

  return `Tu n'as accès à AUCUN outil dans cet environnement (pas de Bash, pas de lecture de fichiers, pas de recherche). Tout le contexte nécessaire (diff complet, description, fichiers changés, reviews existantes) est déjà fourni ci-dessous. N'essaie PAS d'explorer le dépôt ou le système de fichiers : réponds directement avec le JSON demandé, en te basant uniquement sur ce qui suit.

${subjectLine}

## PR Description
${snapshot.body || "(no description)"}

## Changed files
${fileList}

## Diff
${truncateDiff(diff)}
${existingSection}
## Instructions
${instructions}

Ne rapporte que les findings que tu as vérifiés dans le code. Ignore ce que tu ne peux pas rattacher à un fichier et une ligne précis.

IMPORTANT : Rédige TOUT en français — summary, title, background, problem, suggestedFix, suggestedComment. Le suggestedComment sera posté tel quel sur GitHub.

STYLE (ELI12, obligatoire pour tous les champs texte) : écris comme si tu expliquais le bug à un ado de 12 ans qui n'a pas le code sous les yeux — simple et concret, mais pas bébé.
- Phrases courtes, mots simples, zéro jargon inutile (pas de "ledit", pas de vocabulaire d'architecture creux).
- Décris le symptôme concret : quoi casse, dans quelle situation, ce que l'utilisateur ou le code voit à la place de ce qui est attendu.
- Une idée par phrase. Pas de sous-phrases empilées avec plein de virgules.
- title : une ligne qui dit le symptôme, pas le mécanisme interne.
- summary/problem : 1 à 3 phrases courtes max.
- suggestedFix : dit quoi changer, en une ou deux phrases.
- Toujours nommer les vraies variables/fonctions/fichiers du code (pas de paraphrase vague), mais sans jargon autour.

Écris tes findings en JSON sur stdout avec ce schéma exact :
${FINDINGS_SCHEMA_TEXT}

\`suggestedComment\` est posté tel quel sur GitHub comme commentaire de review adressé à l'auteur de la PR — rédige-le en français, même style ELI5, court et concret.
Chaque path doit être le chemin complet relatif à la racine du repo.
Si tu ne trouves rien, output {"summary": "...", "findings": []}.

Ne poste RIEN sur GitHub. Ne modifie AUCUN fichier.`;
}

function extractJsonBlock(text: string): string | null {
  const start = text.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;
  let end = -1;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escape) escape = false;
      else if (ch === "\\") escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") depth++;
    if (ch === "}") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }

  return end === -1 ? null : text.slice(start, end + 1);
}

function handleStreamLine(id: string, line: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    log(id, `[stream] non-JSON line: ${line.slice(0, 200)}`);
    emit(id, "progress", { raw: line });
    return "";
  }

  const obj = parsed as Record<string, unknown>;
  log(id, `[stream] type=${obj.type ?? "?"}${obj.subtype ? ` subtype=${obj.subtype}` : ""}`);

  emit(id, "progress", parsed);

  if (parsed && typeof parsed === "object") {
    if (obj.type === "assistant") {
      const message = obj.message as { content?: { type: string; text?: string }[] } | undefined;
      const content = message?.content ?? [];
      const text = content
        .filter((c) => c.type === "text" && typeof c.text === "string")
        .map((c) => c.text as string)
        .join("");
      if (text) {
        log(id, `[stream] assistant text chunk (${text.length} chars): ${text.slice(0, 150)}...`);
        appendThreadLog(id, text);
      }
      const toolUses = content.filter((c) => c.type === "tool_use") as { name?: string; input?: unknown }[];
      for (const tool of toolUses) {
        const entry = `[tool] ${tool.name ?? "?"}(${JSON.stringify(tool.input ?? {}).slice(0, 120)})`;
        appendThreadLog(id, entry);
      }
      return text;
    }
    if (obj.type === "user") {
      const userContent = (obj.message as { content?: { type: string; content?: string; is_error?: boolean }[] })?.content ?? [];
      for (const item of userContent) {
        if (item.type === "tool_result") {
          const preview = (item.content ?? "").slice(0, 200);
          appendThreadLog(id, `[result]${item.is_error ? " ERROR:" : ""} ${preview}`);
        }
      }
    }
    if (obj.type === "result" && typeof obj.result === "string") {
      log(id, `[stream] result (${(obj.result as string).length} chars): ${(obj.result as string).slice(0, 150)}...`);
      return obj.result as string;
    }
  }

  return "";
}

const threadLogs = new Map<string, string[]>();

function appendThreadLog(id: string, entry: string): void {
  if (!threadLogs.has(id)) threadLogs.set(id, []);
  threadLogs.get(id)!.push(entry);
}

export function getThreadLog(id: string): string[] {
  return threadLogs.get(id) ?? [];
}

function runClaude(id: string, prompt: string, model?: string, maxTurns?: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const claudePath = resolveClaudePath();
    const args = ["-p", "--output-format", "stream-json", "--verbose", "--tools", ""];
    if (model) args.push("--model", model);
    if (maxTurns) args.push("--max-turns", String(maxTurns));
    log(id, `spawning: ${claudePath} ${args.join(" ")} (prompt via stdin: ${prompt.length} chars)`);

    const child = spawn(claudePath, args, {
      stdio: ["pipe", "pipe", "pipe"],
    });

    child.stdin.write(prompt);
    child.stdin.end();

    log(id, `claude process started, pid=${child.pid}, prompt written to stdin`);

    let buffer = "";
    let textOut = "";
    let stderrOut = "";
    let lineCount = 0;

    child.stdout.on("data", (chunk: Buffer) => {
      const chunkStr = chunk.toString("utf8");
      buffer += chunkStr;
      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);
        if (line) {
          lineCount++;
          textOut += handleStreamLine(id, line);
        }
      }
    });

    child.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      stderrOut += text;
      log(id, `[stderr] ${text.trim().slice(0, 500)}`);
    });

    child.on("error", (err) => {
      log(id, `claude process error: ${err.message}`);
      reject(err);
    });

    child.on("close", (code, signal) => {
      log(id, `claude process exited: code=${code} signal=${signal} lines=${lineCount} textOut=${textOut.length} chars`);
      if (buffer.trim()) {
        lineCount++;
        textOut += handleStreamLine(id, buffer.trim());
      }
      if (code !== 0 && textOut.length === 0) {
        log(id, `claude failed, stderr: ${stderrOut.slice(0, 1000)}`);
        reject(new Error(`claude exited with code ${code}: ${stderrOut.slice(0, 2000)}`));
        return;
      }
      log(id, `claude output total: ${textOut.length} chars, first 300: ${textOut.slice(0, 300)}`);
      resolve(textOut);
    });
  });
}

function importFindings(id: string, findings: Finding[]): void {
  log(id, `importing ${findings.length} findings`);
  const db = getDb();
  db.prepare("DELETE FROM findings WHERE review_id = ?").run(id);

  const insert = db.prepare(
    `INSERT INTO findings (
      id, review_id, ord, file, start_line, end_line, side, severity, category, title,
      summary, background, problem, suggested_fix, suggested_comment, draft_comment,
      state, comment_url, posted_at, posted_as, references_json
    ) VALUES (
      @id, @review_id, @ord, @file, @start_line, @end_line, @side, @severity, @category, @title,
      @summary, @background, @problem, @suggested_fix, @suggested_comment, @draft_comment,
      @state, @comment_url, @posted_at, @posted_as, @references_json
    )`
  );

  const insertMany = db.transaction((rows: Finding[]) => {
    rows.forEach((finding, index) => {
      log(id, `  finding ${index}: [${finding.severity}] ${finding.file}:${finding.startLine} — ${finding.title}`);
      insert.run({
        id: randomUUID(),
        review_id: id,
        ord: index,
        file: finding.file,
        start_line: finding.startLine,
        end_line: finding.endLine,
        side: finding.side,
        severity: finding.severity,
        category: finding.category,
        title: finding.title,
        summary: finding.summary,
        background: finding.background,
        problem: finding.problem,
        suggested_fix: finding.suggestedFix,
        suggested_comment: finding.suggestedComment,
        draft_comment: finding.suggestedComment,
        state: "open",
        comment_url: null,
        posted_at: null,
        posted_as: "comment",
        references_json: JSON.stringify(finding.references),
      });
    });
  });

  insertMany(findings);
  log(id, `imported ${findings.length} findings successfully`);
}

function failReview(id: string, message: string): void {
  log(id, `REVIEW FAILED: ${message}`);
  const db = getDb();
  db.prepare("UPDATE reviews SET status = 'failed', error = ?, updated_at = ? WHERE id = ?").run(
    message,
    new Date().toISOString(),
    id
  );
  emit(id, "status", { status: "failed", error: message });
}

const EFFORT_MAX_TURNS: Record<string, number> = {
  quick: 1,
  standard: 3,
  thorough: 10,
  exhaustive: 25,
};

interface RunOptions {
  skills: string[];
  model?: string;
  effort?: string;
  challengeExisting: boolean;
}

async function runReview(id: string, repo: string, number: number, subjectLine: string, snapshot: PrSnapshot, diff: string, opts: RunOptions): Promise<void> {
  const { skills, model, effort, challengeExisting } = opts;

  let existing: ExistingReviewContext | undefined;
  if (challengeExisting) {
    log(id, "fetching existing reviews and comments for challenge...");
    try {
      existing = await fetchExistingReviews(repo, number);
      log(id, `existing: ${existing.reviews.length} reviews, ${existing.comments.length} inline comments (authors: ${[...new Set([...existing.reviews, ...existing.comments].map((x) => x.author))].join(", ") || "none"})`);
    } catch (err) {
      log(id, `WARNING: could not fetch existing reviews: ${(err as Error).message}`);
    }
  }

  log(id, `building prompt (diff: ${diff.length} chars, files: ${(snapshot.files ?? []).length}, challenge=${challengeExisting})`);
  const prompt = buildPrompt(subjectLine, snapshot, diff, { skills, existing });
  log(id, `prompt built: ${prompt.length} chars`);

  const maxTurns = EFFORT_MAX_TURNS[effort ?? "standard"] ?? 3;
  log(id, `starting claude subprocess...${model ? ` model=${model}` : " (default model)"} effort=${effort ?? "standard"} maxTurns=${maxTurns}`);
  threadLogs.delete(id);
  const assistantText = await runClaude(id, prompt, model, maxTurns);
  log(id, `claude finished, output: ${assistantText.length} chars`);

  log(id, "extracting JSON block from output...");
  const jsonBlock = extractJsonBlock(assistantText);
  if (!jsonBlock) {
    log(id, `ERROR: no JSON found. Full output (first 2000 chars): ${assistantText.slice(0, 2000)}`);
    throw new Error("no JSON report found in claude output");
  }
  log(id, `JSON block extracted: ${jsonBlock.length} chars, starts with: ${jsonBlock.slice(0, 200)}`);

  log(id, "parsing findings report...");
  const result = parseReport(jsonBlock);
  if (result.error || !result.report) {
    log(id, `ERROR: parse failed: ${result.error}`);
    throw new Error(result.error ?? "failed to parse findings report");
  }

  log(id, `parsed: ${result.report.findings.length} findings, ${result.warnings.length} warnings`);
  for (const w of result.warnings) {
    log(id, `  warning: finding ${w.index}: ${w.reason}`);
  }

  importFindings(id, result.report.findings);
  emit(id, "findings", {
    summary: result.report.summary,
    count: result.report.findings.length,
    warnings: result.warnings,
  });

  const db = getDb();
  db.prepare("UPDATE reviews SET status = 'reported', summary = ?, updated_at = ? WHERE id = ?").run(
    result.report.summary,
    new Date().toISOString(),
    id
  );
  log(id, `REVIEW COMPLETED: ${result.report.findings.length} findings, summary: ${result.report.summary.slice(0, 200)}`);
  emit(id, "status", { status: "reported" });
}

export async function startReview(
  repo: string,
  number: number,
  skills: string[] = [],
  model?: string,
  effort?: string,
  challengeExisting = true
): Promise<string> {
  const db = getDb();
  const id = reviewId(repo, number);
  const now = new Date().toISOString();

  log(id, `=== STARTING REVIEW === repo=${repo} number=${number} skills=[${skills.join(",")}]`);

  log(id, "fetching PR diff and snapshot from GitHub...");
  const [diff, snapshot] = await Promise.all([fetchPrDiff(repo, number), fetchPrSnapshot(repo, number)]);
  log(id, `fetched: diff=${diff.length} chars, title="${snapshot.title}", files=${(snapshot.files ?? []).length}, body=${(snapshot.body ?? "").length} chars`);

  log(id, "saving review to database...");
  db.prepare(
    `INSERT INTO reviews (id, repo, number, title, status, summary, error, diff, snapshot, skills, created_at, updated_at)
     VALUES (@id, @repo, @number, @title, 'running', '', NULL, @diff, @snapshot, @skills, @created_at, @updated_at)
     ON CONFLICT(id) DO UPDATE SET
       status = 'running', summary = '', error = NULL, diff = excluded.diff, snapshot = excluded.snapshot,
       skills = excluded.skills, updated_at = excluded.updated_at`
  ).run({
    id,
    repo,
    number,
    title: snapshot.title ?? "",
    diff,
    snapshot: JSON.stringify(snapshot),
    skills: JSON.stringify(skills),
    created_at: now,
    updated_at: now,
  });
  log(id, "review saved with status=running");

  emit(id, "status", { status: "running" });

  log(id, `launching review in background...${model ? ` model=${model}` : ""} effort=${effort ?? "standard"} challenge=${challengeExisting}`);
  const subjectLine = `Review GitHub pull request ${repo}#${number} — ${snapshot.title}`;
  runReview(id, repo, number, subjectLine, snapshot, diff, { skills, model, effort, challengeExisting }).catch((err) => {
    failReview(id, err instanceof Error ? err.message : String(err));
  });

  return id;
}

export async function startLocalReview(
  repoLabel: string,
  repoPath: string,
  branch: string,
  base: string,
  skills: string[] = [],
  model?: string,
  effort?: string
): Promise<{ repo: string; number: number }> {
  const db = getDb();
  const { repo, number } = localRepoIdentity(repoLabel, branch);
  const id = reviewId(repo, number);
  const now = new Date().toISOString();

  log(id, `=== STARTING LOCAL REVIEW === repo=${repoLabel} branch=${branch} base=${base}`);

  const [{ diff, files }, { subject, body }] = await Promise.all([
    getLocalDiff(repoPath, branch, base),
    getLatestCommitMessage(repoPath, branch),
  ]);
  log(id, `fetched: diff=${diff.length} chars, files=${files.length}`);

  const snapshot: PrSnapshot = {
    title: subject || `${branch} vs ${base}`,
    body,
    author: { login: "" },
    state: "open",
    isDraft: false,
    baseRefName: base,
    headRefName: branch,
    headRefOid: "",
    comments: [],
    files,
  };

  db.prepare(
    `INSERT INTO reviews (id, repo, number, title, status, summary, error, diff, snapshot, skills, created_at, updated_at)
     VALUES (@id, @repo, @number, @title, 'running', '', NULL, @diff, @snapshot, @skills, @created_at, @updated_at)
     ON CONFLICT(id) DO UPDATE SET
       status = 'running', summary = '', error = NULL, diff = excluded.diff, snapshot = excluded.snapshot,
       skills = excluded.skills, updated_at = excluded.updated_at`
  ).run({
    id,
    repo,
    number,
    title: snapshot.title,
    diff,
    snapshot: JSON.stringify(snapshot),
    skills: JSON.stringify(skills),
    created_at: now,
    updated_at: now,
  });

  emit(id, "status", { status: "running" });

  const subjectLine = `Review the local branch \`${branch}\` (diff vs \`${base}\`) in repo ${repoLabel} — ${snapshot.title}`;
  runReview(id, repo, number, subjectLine, snapshot, diff, { skills, model, effort, challengeExisting: false }).catch((err) => {
    failReview(id, err instanceof Error ? err.message : String(err));
  });

  return { repo, number };
}
