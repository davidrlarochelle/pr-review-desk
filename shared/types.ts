export const SEVERITIES = ["blocker", "high", "medium", "low", "nit"] as const;
export type Severity = (typeof SEVERITIES)[number];

export interface Reference {
  file: string;
  startLine: number | null;
  endLine: number | null;
  note: string;
}

export interface Finding {
  file: string;
  startLine: number | null;
  endLine: number | null;
  side: "LEFT" | "RIGHT";
  severity: Severity;
  category: string;
  title: string;
  summary: string;
  background: string;
  problem: string;
  suggestedFix: string;
  suggestedComment: string;
  references: Reference[];
}

export interface Report {
  summary: string;
  findings: Finding[];
}

export interface FindingRow {
  id: string;
  review_id: string;
  ord: number;
  file: string;
  start_line: number | null;
  end_line: number | null;
  side: string;
  severity: string;
  category: string;
  title: string;
  summary: string;
  background: string;
  problem: string;
  suggested_fix: string;
  suggested_comment: string;
  draft_comment: string | null;
  state: string;
  comment_url: string | null;
  posted_at: string | null;
  posted_as: string;
  references_json: string;
}

export interface ReviewRow {
  id: string;
  repo: string;
  number: number;
  title: string;
  status: string;
  summary: string;
  error: string | null;
  diff: string;
  snapshot: string;
  skills: string;
  created_at: string;
  updated_at: string;
}

export interface PullRequest {
  repo: string;
  number: number;
  title: string;
  author: string;
  url: string;
  updatedAt: string;
  isDraft: boolean;
  additions: number;
  deletions: number;
  changedFiles: number;
  headRefOid: string;
  baseRefName: string;
  headRefName: string;
  labels: string[];
  reviewDecision: "APPROVED" | "CHANGES_REQUESTED" | "REVIEW_REQUIRED" | null;
  /** Each reviewer's most recent submitted review. Optional: PR lists cached before it existed lack it. */
  latestReviews?: { author: string; state: string }[];
}

/** The viewer's own latest review on a PR — distinct from reviewDecision, which is the PR's overall state. */
export type MyReviewState = "APPROVED" | "CHANGES_REQUESTED" | "COMMENTED";

export interface PullRequestDto extends PullRequest {
  reviewStatus: "none" | "queued" | "running" | "reported" | "failed";
  /** null when the viewer has not reviewed, or when the cached list predates latestReviews (refresh fills it). */
  myReview: MyReviewState | null;
  openFindings: number;
  postedFindings: number;
}

export interface FindingDto {
  id: string;
  reviewId: string;
  file: string;
  startLine: number | null;
  endLine: number | null;
  side: "LEFT" | "RIGHT";
  severity: Severity;
  category: string;
  title: string;
  summary: string;
  background: string;
  problem: string;
  suggestedFix: string;
  suggestedComment: string;
  draftComment: string | null;
  state: "open" | "posted" | "dismissed";
  commentUrl: string | null;
  postedAt: string | null;
  postedAs: "comment" | "pending-review";
  references: Reference[];
  postAnchor: PostAnchor;
}

export interface PostAnchor {
  kind: "line" | "file" | "pull-request";
  line: number | null;
  startLine: number | null;
  adjusted: boolean;
}

export interface ReviewDto {
  id: string;
  repo: string;
  number: number;
  title: string;
  status: "queued" | "running" | "reported" | "failed";
  summary: string;
  error: string | null;
  skills: string[];
  createdAt: string;
  updatedAt: string;
}

export interface LocalReviewDto extends ReviewDto {
  openFindings: number;
  postedFindings: number;
  totalFindings: number;
  branch: string;
  base: string;
}

export interface ReviewEvent {
  type: "status" | "progress" | "findings";
  reviewId: string;
  data: unknown;
}
