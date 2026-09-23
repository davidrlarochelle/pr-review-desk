import { useEffect, useState } from "react";
import PRList from "./components/PRList";
import PRDetail from "./components/PRDetail";
import FindingDetail from "./components/FindingDetail";
import LocalBranches from "./components/LocalBranches";
import LocalReviewDetail from "./components/LocalReviewDetail";
import AppShell, { Crumbs, type CrumbItem, type Section } from "./components/AppShell";
import { ToastProvider } from "./components/ui/Toast";
import CommandPalette, { type JumpTarget } from "./components/CommandPalette";

type ViewState =
  | { view: "list" }
  | { view: "pr"; repo: string; number: number }
  | { view: "finding"; repo: string; number: number; findingId: string }
  | { view: "local-list"; repoLabel?: string; branch?: string }
  | { view: "local-review"; repo: string; number: number; repoLabel: string; branch: string; base: string }
  | { view: "local-finding"; repo: string; number: number; repoLabel: string; branch: string; base: string; findingId: string };

export interface PrRef {
  repo: string;
  number: number;
}

export default function App() {
  const [state, setState] = useState<ViewState>({ view: "list" });
  // The list order the user came from, so the PR pager walks the same sequence they were looking at.
  const [prOrder, setPrOrder] = useState<PrRef[]>([]);
  const [paletteOpen, setPaletteOpen] = useState(false);

  // ⌘K / Ctrl+K works everywhere, including inside fields, like every other jump-to palette.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const goList = () => setState({ view: "list" });
  const goPR = (repo: string, number: number) => setState({ view: "pr", repo, number });
  const goLocalList = () => setState({ view: "local-list" });
  // Pick the fields explicitly: callers pass a whole local-finding state, whose `view` must not leak through.
  const goLocalReview = ({ repo, number, repoLabel, branch, base }: { repo: string; number: number; repoLabel: string; branch: string; base: string }) =>
    setState({ view: "local-review", repo, number, repoLabel, branch, base });

  const jump = (t: JumpTarget) => {
    if (t.kind === "pr") goPR(t.repo, t.number);
    else if (t.kind === "finding") setState({ view: "finding", repo: t.repo, number: t.number, findingId: t.findingId });
    else if (t.kind === "local-review") goLocalReview(t);
    else if (t.kind === "local-finding")
      setState({ view: "local-finding", repo: t.repo, number: t.number, repoLabel: t.repoLabel, branch: t.branch, base: t.base, findingId: t.findingId });
    else setState({ view: "local-list", repoLabel: t.repoLabel, branch: t.branch });
  };

  // The section is derived from the ViewState prefix — never stored separately.
  const section: Section = state.view.startsWith("local") ? "local" : "prs";

  const crumbs: CrumbItem[] = [];
  if (section === "prs") crumbs.push({ label: "Pull requests", onClick: goList });
  else crumbs.push({ label: "Local branches", onClick: goLocalList });
  if (state.view === "pr" || state.view === "finding") {
    crumbs.push({ label: `${state.repo.split("/").pop()} #${state.number}`, mono: true, onClick: () => goPR(state.repo, state.number) });
  }
  if (state.view === "local-review" || state.view === "local-finding") {
    crumbs.push({ label: `${state.repoLabel} · ${state.branch}`, mono: true, onClick: () => goLocalReview(state) });
  }
  if (state.view === "finding" || state.view === "local-finding") crumbs.push({ label: "Finding" });

  return (
    <ToastProvider>
      <AppShell section={section} crumbs={<Crumbs items={crumbs} />} onNavigate={(s) => (s === "local" ? goLocalList() : goList())} onJump={() => setPaletteOpen(true)}>
        {state.view === "list" && (
          <PRList
            onSelectPR={(repo, number, order) => {
              setPrOrder(order);
              goPR(repo, number);
            }}
          />
        )}

        {state.view === "pr" && (
          <PRDetail
            key={`${state.repo}#${state.number}`}
            repo={state.repo}
            number={state.number}
            order={prOrder}
            onSelectPR={goPR}
            onBack={goList}
            onSelectFinding={(findingId) => setState({ view: "finding", repo: state.repo, number: state.number, findingId })}
          />
        )}

        {state.view === "finding" && (
          <FindingDetail
            key={state.findingId}
            findingId={state.findingId}
            repo={state.repo}
            number={state.number}
            onBack={() => goPR(state.repo, state.number)}
            onSelectFinding={(findingId) => setState({ view: "finding", repo: state.repo, number: state.number, findingId })}
          />
        )}

        {state.view === "local-list" && (
          <LocalBranches
            key={`${state.repoLabel ?? ""}:${state.branch ?? ""}`}
            initialRepo={state.repoLabel}
            initialBranch={state.branch}
            onSelectReview={goLocalReview}
          />
        )}

        {state.view === "local-review" && (
          <LocalReviewDetail
            key={`${state.repo}#${state.number}`}
            repo={state.repo}
            number={state.number}
            repoLabel={state.repoLabel}
            branch={state.branch}
            base={state.base}
            onBack={goLocalList}
            onSelectFinding={(findingId) => setState({ ...state, view: "local-finding", findingId })}
          />
        )}

        {state.view === "local-finding" && (
          <FindingDetail
            key={state.findingId}
            findingId={state.findingId}
            repo={state.repo}
            number={state.number}
            readOnly
            onBack={() => goLocalReview(state)}
            onSelectFinding={(findingId) => setState({ ...state, findingId })}
          />
        )}
      </AppShell>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} onJump={jump} />
    </ToastProvider>
  );
}

