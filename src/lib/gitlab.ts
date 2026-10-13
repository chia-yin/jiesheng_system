import type { Project, ProjectPath } from "@/types/system";
import type { BranchHealthTag, GitLabBranchInfo, GitLabRepoStatus } from "@/lib/gitlab-types";

export type { BranchHealthTag, GitLabBranchInfo, GitLabRepoStatus } from "@/lib/gitlab-types";
export { BRANCH_TAG_LABEL } from "@/lib/gitlab-types";

const CACHE_TTL_MS = 5 * 60 * 1000;
const STALE_DAYS = 14;
const TOO_MANY_UNMERGED = 8;

type CacheEntry = { at: number; value: GitLabRepoStatus };

const statusCache = new Map<string, CacheEntry>();

export function isGitLabConfigured(): boolean {
  return Boolean(process.env.GITLAB_TOKEN?.trim());
}

export function getGitLabBaseUrl(): string {
  return (process.env.GITLAB_BASE_URL?.trim() || "https://gitlab.com").replace(/\/$/, "");
}

/** 從 path URL 解析 GitLab project path（group/proj 或 group/sub/proj） */
export function parseGitLabProjectPath(url: string, baseUrl = getGitLabBaseUrl()): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (!/^https?:\/\//i.test(trimmed)) return null;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  let baseHost: string;
  try {
    baseHost = new URL(baseUrl).host;
  } catch {
    baseHost = "gitlab.com";
  }

  const hostOk =
    parsed.host === baseHost ||
    parsed.host === `www.${baseHost}` ||
    (baseHost === "gitlab.com" && parsed.host.endsWith("gitlab.com"));
  if (!hostOk) return null;

  let pathname = parsed.pathname.replace(/\.git$/i, "");
  const dashSeg = pathname.indexOf("/-/");
  if (dashSeg >= 0) pathname = pathname.slice(0, dashSeg);

  const parts = pathname.split("/").filter(Boolean);
  if (parts.length < 2) return null;
  return parts.join("/");
}

function classifyPath(url: string): { kind: GitLabRepoStatus["kind"]; gitlabPath: string | null } {
  const gitlabPath = parseGitLabProjectPath(url);
  if (gitlabPath) return { kind: "gitlab", gitlabPath };
  if (!/^https?:\/\//i.test(url.trim()) && url.trim()) return { kind: "local", gitlabPath: null };
  return { kind: "other", gitlabPath: null };
}

async function gitlabFetch<T>(apiPath: string): Promise<T> {
  const token = process.env.GITLAB_TOKEN?.trim();
  const base = getGitLabBaseUrl();
  const url = `${base}/api/v4${apiPath}`;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) headers["PRIVATE-TOKEN"] = token;

  const res = await fetch(url, { headers, next: { revalidate: 0 } });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitLab API ${res.status}: ${text.slice(0, 180)}`);
  }
  return res.json() as Promise<T>;
}

interface RawBranch {
  name: string;
  merged: boolean;
  protected: boolean;
  default: boolean;
  web_url: string;
  commit?: { title?: string; committed_date?: string; created_at?: string };
}

interface RawCompare {
  commits?: unknown[];
  diffs?: unknown[];
  compare_timeout?: boolean;
  compare_same_ref?: boolean;
}

interface RawMr {
  source_branch: string;
  web_url: string;
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return (Date.now() - t) / (24 * 60 * 60 * 1000);
}

function buildTags(input: {
  merged: boolean;
  isDefault: boolean;
  ahead: number | null;
  behind: number | null;
  commitDate: string | null;
}): BranchHealthTag[] {
  if (input.isDefault) return ["ok"];
  if (input.merged) return ["merged_undeleted"];
  const tags: BranchHealthTag[] = [];
  const age = daysSince(input.commitDate);
  if (age != null && age > STALE_DAYS) tags.push("stale");
  if ((input.ahead ?? 0) > 0 && (input.behind ?? 0) > 0) tags.push("diverged");
  if (tags.length === 0) tags.push("ok");
  return tags;
}

async function fetchCompareCounts(
  projectIdEnc: string,
  from: string,
  to: string
): Promise<{ ahead: number; behind: number }> {
  try {
    const [aheadRes, behindRes] = await Promise.all([
      gitlabFetch<RawCompare>(
        `/projects/${projectIdEnc}/repository/compare?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
      ),
      gitlabFetch<RawCompare>(
        `/projects/${projectIdEnc}/repository/compare?from=${encodeURIComponent(to)}&to=${encodeURIComponent(from)}`
      ),
    ]);
    return {
      ahead: aheadRes.commits?.length ?? 0,
      behind: behindRes.commits?.length ?? 0,
    };
  } catch {
    return { ahead: 0, behind: 0 };
  }
}

export async function fetchGitLabRepoStatus(
  project: Project,
  path: ProjectPath
): Promise<GitLabRepoStatus> {
  const { kind, gitlabPath } = classifyPath(path.url);
  const base: GitLabRepoStatus = {
    projectId: project.id,
    projectName: project.name,
    pathLabel: path.label,
    pathUrl: path.url,
    gitlabPath,
    kind,
    branches: [],
    mergedCleanup: [],
    warnings: [],
    openMrTotal: 0,
  };

  if (kind === "local") {
    return { ...base, error: "無法查詢分支（本機路徑）" };
  }
  if (kind !== "gitlab" || !gitlabPath) {
    return { ...base, error: "非 GitLab URL，略過分支查詢" };
  }

  const cacheKey = `${getGitLabBaseUrl()}::${gitlabPath}`;
  const cached = statusCache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return {
      ...cached.value,
      projectId: project.id,
      projectName: project.name,
      pathLabel: path.label,
      pathUrl: path.url,
    };
  }

  if (!isGitLabConfigured()) {
    return {
      ...base,
      error: "尚未設定 GITLAB_TOKEN，無法查詢私有專案分支",
    };
  }

  try {
    const projectIdEnc = encodeURIComponent(gitlabPath);
    const [rawBranches, openMrs] = await Promise.all([
      gitlabFetch<RawBranch[]>(`/projects/${projectIdEnc}/repository/branches?per_page=100`),
      gitlabFetch<RawMr[]>(`/projects/${projectIdEnc}/merge_requests?state=opened&per_page=100`).catch(
        () => [] as RawMr[]
      ),
    ]);

    const mrByBranch = new Map<string, number>();
    for (const mr of openMrs) {
      mrByBranch.set(mr.source_branch, (mrByBranch.get(mr.source_branch) ?? 0) + 1);
    }

    const defaultBranch = rawBranches.find((b) => b.default)?.name ?? "main";

    const unmerged = rawBranches.filter((b) => !b.default && !b.merged);
    // 限制 compare 呼叫數量
    const compareTargets = unmerged
      .slice()
      .sort((a, b) => {
        const da = a.commit?.committed_date ?? a.commit?.created_at ?? "";
        const db = b.commit?.committed_date ?? b.commit?.created_at ?? "";
        return db.localeCompare(da);
      })
      .slice(0, 15);

    const compareMap = new Map<string, { ahead: number; behind: number }>();
    await Promise.all(
      compareTargets.map(async (b) => {
        const counts = await fetchCompareCounts(projectIdEnc, defaultBranch, b.name);
        compareMap.set(b.name, counts);
      })
    );

    const mapped: GitLabBranchInfo[] = rawBranches.map((b) => {
      const commitDate = b.commit?.committed_date ?? b.commit?.created_at ?? null;
      const counts = compareMap.get(b.name) ?? null;
      const ahead = b.default || b.merged ? 0 : counts?.ahead ?? null;
      const behind = b.default || b.merged ? 0 : counts?.behind ?? null;
      return {
        name: b.name,
        default: b.default,
        merged: b.merged,
        protected: b.protected,
        webUrl: b.web_url,
        commitTitle: b.commit?.title ?? "",
        commitDate,
        ahead,
        behind,
        openMrCount: mrByBranch.get(b.name) ?? 0,
        tags: buildTags({
          merged: b.merged,
          isDefault: b.default,
          ahead,
          behind,
          commitDate,
        }),
      };
    });

    const active = mapped
      .filter((b) => b.default || !b.merged)
      .sort((a, b) => {
        if (a.default) return -1;
        if (b.default) return 1;
        return (b.commitDate ?? "").localeCompare(a.commitDate ?? "");
      });

    const mergedCleanup = mapped
      .filter((b) => !b.default && b.merged)
      .sort((a, b) => (b.commitDate ?? "").localeCompare(a.commitDate ?? ""));

    const warnings: string[] = [];
    const unmergedCount = active.filter((b) => !b.default).length;
    if (unmergedCount >= TOO_MANY_UNMERGED) {
      warnings.push(`未合併分支過多（${unmergedCount}），建議整理`);
    }
    if (active.some((b) => b.tags.includes("diverged"))) {
      warnings.push("存在與主線分叉落後的分支");
    }
    if (active.some((b) => b.tags.includes("stale"))) {
      warnings.push(`有超過 ${STALE_DAYS} 天未更新的未合併分支`);
    }
    if (mergedCleanup.length > 0) {
      warnings.push(`${mergedCleanup.length} 個已合併分支尚未刪除`);
    }

    const result: GitLabRepoStatus = {
      ...base,
      defaultBranch,
      branches: active,
      mergedCleanup,
      warnings,
      openMrTotal: openMrs.length,
    };

    statusCache.set(cacheKey, { at: Date.now(), value: result });
    return result;
  } catch (error) {
    return {
      ...base,
      error: error instanceof Error ? error.message : "GitLab 查詢失敗",
    };
  }
}

export async function collectAllGitLabStatuses(projects: Project[]): Promise<GitLabRepoStatus[]> {
  const results: GitLabRepoStatus[] = [];
  const active = projects.filter((p) => p.status === "active" || p.status === "planning");

  for (const project of active) {
    const paths = project.paths?.length ? project.paths : [];
    if (paths.length === 0) continue;
    for (const path of paths) {
      if (!path.url?.trim()) continue;
      results.push(await fetchGitLabRepoStatus(project, path));
    }
  }

  return results;
}
