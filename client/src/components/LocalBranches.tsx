import { useEffect, useState } from "react";
import { useMutation, useQuery } from "../hooks/useApi";
import type { LocalReviewDto, ReviewDto } from "../../../shared/types";
import StatusBadge from "./StatusBadge";
import Button from "./ui/Button";
import Card, { Eyebrow } from "./ui/Card";
import Combobox from "./ui/Combobox";
import { Input, Select } from "./ui/Field";
import Icon from "./ui/Icon";
import { TableSkeleton } from "./ui/Skeleton";
import { useToast } from "./ui/Toast";
import { relativeTime } from "../lib/format";
import { ShellActions, useRailCount } from "./AppShell";
import { moveFocus, useHotkeys } from "../hooks/useHotkeys";

interface LocalRepo {
  label: string;
  path: string;
}

interface LocalBranch {
  name: string;
  current: boolean;
}

const TH = "h-10 whitespace-nowrap bg-subtle px-3 text-left label-caps text-fg-2 edge-b first:pl-4";
// Row dividers are the one hairline allowed: they sit inside a bordered block.
const TD = "h-[var(--row-h)] whitespace-nowrap px-3 align-middle edge-soft-b group-last:border-b-0 first:pl-4";
// The row is the click target; the branch name is the real control, so its name is the accessible name.
// Hover fills the cells (acid in brutalism) with no transition; keyboard focus draws a blue bar on the first cell.
const ROW =
  "group cursor-pointer hover:[&>td]:bg-row-hover has-[:focus-visible]:[&>td]:bg-row-hover has-[:focus-visible]:[&>td:first-child]:shadow-[inset_5px_0_0_var(--color-primary)]";

function branchFromRepoId(repoId: string): string {
  const match = repoId.match(/^local\/(.+)-[a-f0-9]{10}$/);
  return match ? match[1] : repoId;
}

export default function LocalBranches({
  initialRepo,
  initialBranch,
  onSelectReview,
}: {
  /** Preselection when arriving from the ⌘K palette. */
  initialRepo?: string;
  initialBranch?: string;
  onSelectReview: (args: { repo: string; number: number; repoLabel: string; branch: string; base: string }) => void;
}) {
  const { data: repos } = useQuery<LocalRepo[]>("/api/local/repos");
  const [repoLabel, setRepoLabel] = useState(initialRepo ?? "");
  const [branch, setBranch] = useState(initialBranch ?? "");
  const [base, setBase] = useState("");
  const [model, setModel] = useState("sonnet");
  const [effort, setEffort] = useState("standard");
  const [skillsInput, setSkillsInput] = useState("");
  const { toast } = useToast();

  const repo = repoLabel || repos?.[0]?.label || "";

  useEffect(() => {
    if (!repoLabel && repos && repos.length > 0) setRepoLabel(repos[0].label);
  }, [repos, repoLabel]);

  const { data: branchData, loading: branchesLoading } = useQuery<{ branches: LocalBranch[]; defaultBase: string }>(
    repo ? `/api/local/branches?repo=${encodeURIComponent(repo)}` : null,
    [repo]
  );
  useRailCount("local", branchData?.branches.length);

  useEffect(() => {
    if (!branchData) return;
    if (!branch || !branchData.branches.some((b) => b.name === branch)) {
      const current = branchData.branches.find((b) => b.current);
      setBranch(current?.name ?? branchData.branches[0]?.name ?? "");
    }
    if (!base || !branchData.branches.some((b) => b.name === base)) {
      setBase(branchData.defaultBase);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchData]);

  const { data: latest, refetch: refetchLatest } = useQuery<(ReviewDto & { findings: unknown[] }) | null>(
    repo && branch ? `/api/local/reviews/latest?repo=${encodeURIComponent(repo)}&branch=${encodeURIComponent(branch)}` : null,
    [repo, branch]
  );

  const {
    data: allReviews,
    loading: reviewsLoading,
    refetch: refetchReviews,
  } = useQuery<LocalReviewDto[]>(
    repo ? `/api/local/reviews?repo=${encodeURIComponent(repo)}` : null,
    [repo]
  );

  const startReview = useMutation<{ repo: string; number: number }>("/api/local/reviews", "POST");
  const isRunning = latest?.status === "running" || latest?.status === "queued";
  const canStart = !!branch && !!base && branch !== base && !isRunning && !startReview.loading;

  const handleStart = async () => {
    const skills = skillsInput.split(",").map((s) => s.trim()).filter(Boolean);
    try {
      await startReview.mutate({ repo, branch, base, skills, model, effort });
      toast({ kind: "success", message: `Review started for ${branch}` });
      refetchLatest();
      refetchReviews();
    } catch (err) {
      toast({ kind: "error", message: `Could not start local review: ${(err as Error).message}` });
    }
  };

  useHotkeys({
    j: () => moveFocus("[data-row-nav]", 1),
    k: () => moveFocus("[data-row-nav]", -1),
    // History rows are past reviews, so R runs the branch pair selected in the form above.
    r: () => canStart && handleStart(),
  });

  return (
    <main className="flex flex-col gap-5 px-10 pb-10 pt-7">
      <ShellActions>
        <Button size="sm" onClick={refetchReviews} disabled={reviewsLoading}>
          <Icon name="refresh" className={reviewsLoading ? "animate-spin" : ""} />
          Refresh
        </Button>
      </ShellActions>

      <div className="flex flex-col gap-1.5">
        <h1 className="font-display text-[34px] uppercase leading-none tracking-[0.01em]">Local branches</h1>
        <span className="text-xs text-fg-3">Review a local branch before opening a pull request.</span>
      </div>

      <Card className="flex flex-col">
        <div className="flex flex-wrap items-center gap-2 edge-b px-5 py-3.5">
          <Select id="local-repo" icon="repo" wrapperClassName="w-56" value={repo} onChange={(e) => { setRepoLabel(e.target.value); setBranch(""); setBase(""); }}>
            {(repos ?? []).map((r) => (
              <option key={r.label} value={r.label}>
                {r.label}
              </option>
            ))}
          </Select>
          <Combobox
            icon="branch"
            placeholder="Branch…"
            wrapperClassName="w-64"
            value={branch}
            onChange={setBranch}
            disabled={branchesLoading}
            options={(branchData?.branches ?? []).map((b) => ({
              value: b.name,
              label: b.name,
              hint: b.current ? "current" : undefined,
            }))}
          />
          <Icon name="arrowRight" className="size-3.5 text-fg-3" />
          <Combobox
            icon="branch"
            placeholder="Base…"
            wrapperClassName="w-48"
            value={base}
            onChange={setBase}
            disabled={branchesLoading}
            options={(branchData?.branches ?? []).map((b) => ({
              value: b.name,
              label: b.name,
            }))}
          />
        </div>

        <div className="flex items-center gap-2 edge-b bg-subtle px-5 py-3">
          <Select id="local-model" icon="cpu" label="Model" wrapperClassName="w-[168px]" value={model} onChange={(e) => setModel(e.target.value)} disabled={isRunning}>
            <option value="sonnet">Sonnet</option>
            <option value="opus">Opus</option>
            <option value="haiku">Haiku</option>
            <option value="fable">Fable</option>
          </Select>
          <Select id="local-effort" icon="gauge" label="Effort" wrapperClassName="w-[248px]" value={effort} onChange={(e) => setEffort(e.target.value)} disabled={isRunning}>
            <option value="quick">Quick · 1 turn</option>
            <option value="standard">Standard · 3 turns</option>
            <option value="thorough">Thorough · 10 turns</option>
            <option value="exhaustive">Exhaustive · 25 turns</option>
          </Select>
          <Input
            id="local-skills"
            icon="star"
            wrapperClassName="w-[260px]"
            value={skillsInput}
            onChange={(e) => setSkillsInput(e.target.value)}
            placeholder="Skills, comma-separated (optional)"
            disabled={isRunning}
          />
          <Button variant="primary" onClick={handleStart} disabled={!canStart} aria-keyshortcuts="R" title="Start review (R)">
            <Icon name={latest?.status === "failed" ? "refresh" : "play"} />
            {isRunning ? "Review running…" : latest?.status === "failed" ? "Retry review" : "Start review"}
          </Button>
          {latest && <StatusBadge status={latest.status} />}
        </div>

        {latest && (
          <div className="flex items-center gap-3 px-5 py-3">
            <Eyebrow>Last review</Eyebrow>
            <span className="font-mono text-xs text-fg-3">{relativeTime(latest.updatedAt)}</span>
            <Button
              size="sm"
              variant="acid"
              className="ml-auto"
              onClick={() => onSelectReview({ repo: latest.repo, number: latest.number, repoLabel: repo, branch, base })}
            >
              View
              <Icon name="chevronRight" />
            </Button>
            <Button size="sm" variant="quiet" iconOnly aria-label="Refresh status" onClick={refetchLatest}>
              <Icon name="refresh" />
            </Button>
          </div>
        )}

        {branch && branch === base && (
          <div className="flex items-center gap-2 edge-t bg-acid-soft px-5 py-3 text-xs text-fg-2">
            <Icon name="alert" className="size-3.5 text-fg" />
            Pick a different base branch to diff against.
          </div>
        )}
      </Card>

      <div className="flex items-baseline gap-3">
        <h2 className="font-display text-[22px] uppercase leading-none">Review history</h2>
        <span className="font-mono text-xs text-fg-3">
          {reviewsLoading
            ? "Loading…"
            : `${allReviews?.length ?? 0} review${(allReviews?.length ?? 0) !== 1 ? "s" : ""}`}
        </span>
      </div>

      <Card className="overflow-hidden">
        {reviewsLoading && !allReviews ? (
          <TableSkeleton rows={4} cols={5} />
        ) : !allReviews || allReviews.length === 0 ? (
          <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 p-10 text-center">
            <div className="inline-flex size-12 items-center justify-center edge bg-acid text-acid-fg lift-sm">
              <Icon name="inbox" className="size-5" />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="font-display text-[22px] uppercase leading-none">No reviews yet</span>
              <span className="max-w-[380px] text-fg-2">
                Start a review on a branch above to see it here.
              </span>
            </div>
          </div>
        ) : (
          <table className="w-full border-separate border-spacing-0 text-[13px]">
            <thead>
              <tr>
                <th className={TH}>Branch</th>
                <th className={`${TH} w-[120px]`}>Status</th>
                <th className={`${TH} w-[100px]`}>Findings</th>
                <th className={`${TH} w-[140px]`}>Reviewed</th>
                <th className={`${TH} w-11`} />
              </tr>
            </thead>
            <tbody>
              {allReviews.map((r) => {
                const open = () =>
                  onSelectReview({
                    repo: r.repo,
                    number: r.number,
                    repoLabel: repo,
                    branch: r.branch || r.title,
                    base: r.base || base || "main",
                  });
                return (
                  <tr key={r.id} onClick={open} className={ROW}>
                    <td className={`${TD} max-w-0`}>
                      <span className="flex min-w-0 items-center gap-2">
                        <Icon name="branch" className="size-3.5 shrink-0 text-fg-3" />
                        <button
                          type="button"
                          data-row-nav
                          className="min-w-0 truncate text-left font-mono text-xs font-medium outline-none"
                          onClick={(e) => {
                            e.stopPropagation();
                            open();
                          }}
                        >
                          {r.branch || branchFromRepoId(r.repo)}
                        </button>
                        {r.base && <span className="shrink-0 font-mono text-[11px] text-fg-3">→ {r.base}</span>}
                      </span>
                    </td>
                    <td className={TD}>
                      <StatusBadge status={r.status} />
                    </td>
                    <td className={`${TD} text-xs`}>
                      {r.totalFindings > 0 ? (
                        <span className="inline-flex items-center gap-1.5 font-mono text-fg-2">
                          <span className="size-2 edge-hair bg-sev-medium-dot" />
                          {r.openFindings} open
                        </span>
                      ) : (
                        <span className="text-fg-3">—</span>
                      )}
                    </td>
                    <td className={`${TD} text-fg-3`} title={new Date(r.updatedAt).toLocaleString()}>
                      {relativeTime(r.updatedAt)}
                    </td>
                    <td className={`${TD} pr-3.5 text-right text-fg-3 group-hover:text-fg`}>
                      <Icon name="chevronRight" className="inline size-4" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </main>
  );
}
