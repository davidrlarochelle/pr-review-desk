import { useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { reviewRepoSegment, type LocalSearch } from "./lib/url-state";

const splitRepo = (repo: string) => {
  const i = repo.indexOf("/");
  return { owner: repo.slice(0, i), repo: repo.slice(i + 1) };
};

export interface LocalReviewRef {
  repo: string;
  number: number;
  repoLabel: string;
  branch: string;
  base: string;
}

/** One function per screen, so callers never spell a path by hand. */
export function useGo() {
  const navigate = useNavigate();
  return useMemo(
    () => ({
      // Lists open without a query: their route restores what was remembered.
      prList: () => navigate({ to: "/prs" }),
      pr: (repo: string, number: number) =>
        navigate({ to: "/prs/$owner/$repo/$number", params: { ...splitRepo(repo), number: String(number) } }),
      finding: (repo: string, number: number, findingId: string) =>
        navigate({ to: "/prs/$owner/$repo/$number/findings/$findingId", params: { ...splitRepo(repo), number: String(number), findingId } }),
      localList: () => navigate({ to: "/local" }),
      localBranch: (label: string, search: LocalSearch) => navigate({ to: "/local/$label", params: { label }, search }),
      localReview: ({ repo, number, repoLabel, branch, base }: LocalReviewRef) =>
        navigate({
          to: "/local/$label/reviews/$reviewRepo/$number",
          params: { label: repoLabel, reviewRepo: reviewRepoSegment(repo), number: String(number) },
          search: { branch, base },
        }),
      localFinding: ({ repo, number, repoLabel, branch, base }: LocalReviewRef, findingId: string) =>
        navigate({
          to: "/local/$label/reviews/$reviewRepo/$number/findings/$findingId",
          params: { label: repoLabel, reviewRepo: reviewRepoSegment(repo), number: String(number), findingId },
          search: { branch, base },
        }),
    }),
    [navigate]
  );
}
