export type BranchHealthTag = "merged_undeleted" | "stale" | "diverged" | "ok";

export interface GitLabBranchInfo {
  name: string;
  default: boolean;
  merged: boolean;
  protected: boolean;
  webUrl: string;
  commitTitle: string;
  commitDate: string | null;
  ahead: number | null;
  behind: number | null;
  openMrCount: number;
  tags: BranchHealthTag[];
}

export interface GitLabRepoStatus {
  projectId: string;
  projectName: string;
  pathLabel: string;
  pathUrl: string;
  gitlabPath: string | null;
  kind: "gitlab" | "local" | "other";
  error?: string;
  defaultBranch?: string;
  branches: GitLabBranchInfo[];
  mergedCleanup: GitLabBranchInfo[];
  warnings: string[];
  openMrTotal: number;
}

export const BRANCH_TAG_LABEL: Record<BranchHealthTag, string> = {
  ok: "正常",
  merged_undeleted: "已合併未刪",
  stale: "過期",
  diverged: "分叉落後",
};
