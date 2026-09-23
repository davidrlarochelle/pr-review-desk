import { execFile } from "node:child_process";
import { promisify } from "node:util";
import crypto from "node:crypto";

const execFileAsync = promisify(execFile);
const EXEC_OPTS = { timeout: 30_000, maxBuffer: 32 * 1024 * 1024 };

export interface LocalRepo {
  label: string;
  path: string;
}

export function configuredLocalRepos(): LocalRepo[] {
  return (process.env.LOCAL_REPOS ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [label, relPath] = entry.includes("=") ? entry.split("=") : [entry, entry];
      return { label, path: `/repos/${relPath}` };
    });
}

async function git(repoPath: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", ["-C", repoPath, ...args], EXEC_OPTS);
  return stdout;
}

export interface LocalBranch {
  name: string;
  current: boolean;
}

export async function listLocalBranches(repoPath: string): Promise<LocalBranch[]> {
  const stdout = await git(repoPath, ["for-each-ref", "--format=%(refname:short)|%(HEAD)", "refs/heads/"]);
  return stdout
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, head] = line.split("|");
      return { name, current: head === "*" };
    });
}

export async function defaultBaseBranch(repoPath: string): Promise<string> {
  const branches = await listLocalBranches(repoPath);
  const names = new Set(branches.map((b) => b.name));
  for (const candidate of ["staging", "main", "master"]) {
    if (names.has(candidate)) return candidate;
  }
  return branches.find((b) => !b.current)?.name ?? branches[0]?.name ?? "main";
}

export interface LocalDiffFile {
  path: string;
  additions: number;
  deletions: number;
}

export interface LocalDiffResult {
  diff: string;
  files: LocalDiffFile[];
}

export async function getLocalDiff(repoPath: string, branch: string, base: string): Promise<LocalDiffResult> {
  const range = `${base}...${branch}`;
  const [diff, numstat] = await Promise.all([
    git(repoPath, ["diff", range]),
    git(repoPath, ["diff", "--numstat", range]),
  ]);

  const files = numstat
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const [add, del, filePath] = line.split("\t");
      return { path: filePath, additions: Number(add) || 0, deletions: Number(del) || 0 };
    });

  return { diff, files };
}

export async function getLatestCommitMessage(repoPath: string, branch: string): Promise<{ subject: string; body: string }> {
  const stdout = await git(repoPath, ["log", "-1", "--pretty=%s%x00%b", branch]);
  const [subject = "", body = ""] = stdout.split("\x00");
  return { subject: subject.trim(), body: body.trim() };
}

export function localRepoIdentity(repoLabel: string, branch: string): { repo: string; number: number } {
  const hash = crypto.createHash("sha1").update(branch).digest("hex").slice(0, 10);
  return { repo: `local/${repoLabel}-${hash}`, number: 0 };
}
