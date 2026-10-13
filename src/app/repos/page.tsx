"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ExternalLink,
  FolderKanban,
  FolderOpen,
  GitBranch,
  GitMerge,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { Modal } from "@/components/Modal";
import { BRANCH_TAG_LABEL, type BranchHealthTag, type GitLabBranchInfo, type GitLabRepoStatus } from "@/lib/gitlab-types";

interface StatusPayload {
  configured: boolean;
  baseUrl: string;
  repos: GitLabRepoStatus[];
  fetchedAt: string;
}

interface ProjectGroup {
  projectId: string;
  projectName: string;
  gitlabRepos: GitLabRepoStatus[];
  otherRepos: GitLabRepoStatus[];
  warningCount: number;
  cleanupCount: number;
  openMrTotal: number;
}

const TAG_CHIP: Record<BranchHealthTag, string> = {
  ok: "bg-emerald-50 text-emerald-700 border-emerald-200",
  merged_undeleted: "bg-slate-100 text-slate-600 border-slate-200",
  stale: "bg-amber-50 text-amber-800 border-amber-200",
  diverged: "bg-rose-50 text-rose-700 border-rose-200",
};

function formatCommitDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("zh-TW", {
      timeZone: "Asia/Taipei",
      month: "numeric",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

function BranchTree({ repo }: { repo: GitLabRepoStatus }) {
  const root = repo.branches.find((b) => b.default);
  const children = repo.branches.filter((b) => !b.default);

  if (!root && children.length === 0) {
    return <p className="text-sm text-[var(--faint)]">無分支資料</p>;
  }

  return (
    <div className="space-y-2 font-mono text-xs">
      {root && (
        <div className="rounded-lg border border-[var(--primary)]/30 bg-[var(--primary)]/5 px-3 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <GitBranch className="h-3.5 w-3.5 text-[var(--primary)]" />
            <a
              href={root.webUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-[var(--ink)] hover:text-[var(--primary)]"
            >
              {root.name}
            </a>
            <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-sans font-semibold text-blue-700">
              default
            </span>
            {root.commitTitle && (
              <span className="max-w-[240px] truncate font-sans text-[var(--muted)]">{root.commitTitle}</span>
            )}
          </div>
        </div>
      )}

      <ul className="relative ml-3 max-h-72 space-y-1.5 overflow-y-auto border-l-2 border-[var(--line)] pl-4">
        {children.map((b) => (
          <li key={b.name} className="relative">
            <span className="absolute -left-[1.15rem] top-3 h-px w-3 bg-[var(--line)]" />
            <div className="rounded-lg border border-[var(--line)] bg-white px-3 py-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <a
                  href={b.webUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-[var(--ink)] hover:text-[var(--primary)]"
                >
                  {b.name}
                </a>
                {b.tags.map((tag) => (
                  <span
                    key={tag}
                    className={`rounded border px-1.5 py-0.5 font-sans text-[10px] font-semibold ${TAG_CHIP[tag]}`}
                  >
                    {BRANCH_TAG_LABEL[tag]}
                  </span>
                ))}
                {b.openMrCount > 0 && (
                  <span className="inline-flex items-center gap-0.5 rounded border border-violet-200 bg-violet-50 px-1.5 py-0.5 font-sans text-[10px] font-semibold text-violet-700">
                    <GitMerge className="h-3 w-3" />
                    MR {b.openMrCount}
                  </span>
                )}
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 font-sans text-[11px] text-[var(--muted)]">
                <span>{formatCommitDate(b.commitDate)}</span>
                {b.ahead != null && b.behind != null && (
                  <span>
                    +{b.ahead} / -{b.behind}
                  </span>
                )}
                {b.commitTitle && <span className="max-w-[280px] truncate">{b.commitTitle}</span>}
              </div>
            </div>
          </li>
        ))}
        {children.length === 0 && <li className="font-sans text-[var(--faint)]">沒有未合併分支</li>}
      </ul>
    </div>
  );
}

function RepoPanel({
  repo,
  onOpenCleanup,
}: {
  repo: GitLabRepoStatus;
  onOpenCleanup: (repo: GitLabRepoStatus) => void;
}) {
  const unmergedCount = repo.branches.filter((b) => !b.default).length;

  return (
    <div className="rounded-xl border border-[var(--line)] bg-slate-50/50 p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-bold text-[var(--ink)]">{repo.pathLabel}</p>
          <a
            href={repo.pathUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-0.5 inline-flex max-w-full items-center gap-1 truncate text-xs text-[var(--primary)] hover:underline"
          >
            {repo.gitlabPath ?? repo.pathUrl}
            <ExternalLink className="h-3 w-3 shrink-0" />
          </a>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
          {repo.defaultBranch && <span>預設 {repo.defaultBranch}</span>}
          <span>MR {repo.openMrTotal}</span>
          <span>未合併 {unmergedCount}</span>
          {repo.mergedCleanup.length > 0 && (
            <button
              type="button"
              className="btn-secondary gap-1 px-2 py-1 text-[11px]"
              onClick={() => onOpenCleanup(repo)}
            >
              <Trash2 className="h-3 w-3" />
              可清理 {repo.mergedCleanup.length}
            </button>
          )}
        </div>
      </div>

      {repo.error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {repo.error}
        </p>
      ) : (
        <>
          {repo.warnings.length > 0 && (
            <ul className="mb-3 space-y-1">
              {repo.warnings
                .filter((w) => !w.includes("已合併分支尚未刪除"))
                .map((w) => (
                  <li key={w} className="flex items-start gap-1.5 text-xs text-amber-800">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {w}
                  </li>
                ))}
            </ul>
          )}
          <BranchTree repo={repo} />
        </>
      )}
    </div>
  );
}

export default function ReposPage() {
  const [data, setData] = useState<StatusPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cleanupRepo, setCleanupRepo] = useState<GitLabRepoStatus | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/gitlab/status", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "載入失敗");
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "載入失敗");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const projectGroups = useMemo((): ProjectGroup[] => {
    if (!data) return [];
    const map = new Map<string, ProjectGroup>();

    for (const repo of data.repos) {
      let group = map.get(repo.projectId);
      if (!group) {
        group = {
          projectId: repo.projectId,
          projectName: repo.projectName,
          gitlabRepos: [],
          otherRepos: [],
          warningCount: 0,
          cleanupCount: 0,
          openMrTotal: 0,
        };
        map.set(repo.projectId, group);
      }
      if (repo.kind === "gitlab") {
        group.gitlabRepos.push(repo);
        group.warningCount += repo.warnings.filter((w) => !w.includes("已合併分支尚未刪除")).length;
        group.cleanupCount += repo.mergedCleanup.length;
        group.openMrTotal += repo.openMrTotal;
      } else {
        group.otherRepos.push(repo);
      }
    }

    return [...map.values()].sort((a, b) => a.projectName.localeCompare(b.projectName, "zh-TW"));
  }, [data]);

  const cleanupBranches: GitLabBranchInfo[] = cleanupRepo?.mergedCleanup ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-[var(--ink)]">
            <GitBranch className="h-5 w-5 text-[var(--primary)]" />
            Git 狀態
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            依專案分組檢視 GitLab 分支樹；可清理分支改以按鈕開啟
          </p>
        </div>
        <button type="button" className="btn-secondary gap-1.5 text-xs" onClick={load} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          重新整理
        </button>
      </header>

      {data && !data.configured && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">尚未設定 GITLAB_TOKEN</p>
          <p className="mt-1 text-xs leading-relaxed">
            請在 Netlify 環境變數新增 <code className="rounded bg-white/70 px-1">GITLAB_TOKEN</code>
            。詳見{" "}
            <Link href="/admin/integrations" className="underline">
              整合設定
            </Link>
            。
          </p>
        </div>
      )}

      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}

      {loading && !data ? (
        <p className="py-16 text-center text-sm text-[var(--muted)]">查詢 GitLab 中…</p>
      ) : (
        <>
          {projectGroups.length === 0 ? (
            <p className="card p-6 text-sm text-[var(--faint)]">
              沒有可顯示的專案路徑。請至專案編輯「路徑」填入 GitLab URL。
            </p>
          ) : (
            <div className="space-y-5">
              {projectGroups.map((group) => (
                <section key={group.projectId} className="card space-y-4 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--line)] pb-3">
                    <div>
                      <h3 className="flex items-center gap-2 text-lg font-bold text-[var(--ink)]">
                        <FolderKanban className="h-4 w-4 text-[var(--primary)]" />
                        <Link href={`/projects/${group.projectId}`} className="hover:text-[var(--primary)]">
                          {group.projectName}
                        </Link>
                      </h3>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {group.gitlabRepos.length} 個 GitLab 倉庫
                        {group.otherRepos.length > 0 ? ` · ${group.otherRepos.length} 個本機路徑` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {group.openMrTotal > 0 && (
                        <span className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 font-semibold text-violet-700">
                          開放 MR {group.openMrTotal}
                        </span>
                      )}
                      {group.warningCount > 0 && (
                        <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 font-semibold text-amber-800">
                          警示 {group.warningCount}
                        </span>
                      )}
                      {group.cleanupCount > 0 && (
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-semibold text-slate-600">
                          可清理 {group.cleanupCount}
                        </span>
                      )}
                    </div>
                  </div>

                  {group.gitlabRepos.length > 0 ? (
                    <div className="grid gap-3 lg:grid-cols-1">
                      {group.gitlabRepos.map((repo) => (
                        <RepoPanel
                          key={`${repo.pathLabel}-${repo.pathUrl}`}
                          repo={repo}
                          onOpenCleanup={setCleanupRepo}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-[var(--faint)]">此專案尚未設定可查詢的 GitLab URL</p>
                  )}

                  {group.otherRepos.length > 0 && (
                    <div className="rounded-lg border border-dashed border-[var(--line)] px-3 py-2">
                      <p className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-[var(--muted)]">
                        <FolderOpen className="h-3.5 w-3.5" />
                        本機／非 GitLab 路徑
                      </p>
                      <ul className="space-y-1 text-xs text-[var(--muted)]">
                        {group.otherRepos.map((r) => (
                          <li key={`${r.pathLabel}-${r.pathUrl}`} className="flex flex-wrap gap-2">
                            <span className="font-medium text-[var(--ink)]">{r.pathLabel}</span>
                            <code className="truncate text-[var(--faint)]">{r.pathUrl}</code>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </section>
              ))}
            </div>
          )}

          {data?.fetchedAt && (
            <p className="text-center text-[11px] text-[var(--faint)]">
              更新於 {new Date(data.fetchedAt).toLocaleString("zh-TW", { hour12: false })} · 快取約 5
              分鐘
            </p>
          )}
        </>
      )}

      <Modal
        open={Boolean(cleanupRepo)}
        onClose={() => setCleanupRepo(null)}
        title={
          cleanupRepo
            ? `可清理分支 · ${cleanupRepo.projectName}／${cleanupRepo.pathLabel}`
            : "可清理分支"
        }
        size="lg"
        footer={
          <button type="button" className="btn-secondary" onClick={() => setCleanupRepo(null)}>
            關閉
          </button>
        }
      >
        <p className="mb-3 text-sm text-[var(--muted)]">
          以下分支已合併進預設分支但尚未刪除（共 {cleanupBranches.length} 個）。點名稱可開 GitLab
          確認後再刪。
        </p>
        <ul className="max-h-[50vh] space-y-1.5 overflow-y-auto">
          {cleanupBranches.map((b) => (
            <li key={b.name}>
              <a
                href={b.webUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-3 rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm transition hover:border-[var(--primary)]"
              >
                <span className="font-mono text-[var(--ink)]">{b.name}</span>
                <span className="shrink-0 text-xs text-[var(--faint)]">
                  {formatCommitDate(b.commitDate)}
                  <ExternalLink className="ml-1 inline h-3 w-3" />
                </span>
              </a>
            </li>
          ))}
        </ul>
      </Modal>
    </div>
  );
}
