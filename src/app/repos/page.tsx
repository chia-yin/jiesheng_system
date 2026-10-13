"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  ExternalLink,
  FolderOpen,
  GitBranch,
  GitMerge,
  RefreshCw,
} from "lucide-react";
import { BRANCH_TAG_LABEL, type BranchHealthTag, type GitLabRepoStatus } from "@/lib/gitlab-types";

interface StatusPayload {
  configured: boolean;
  baseUrl: string;
  repos: GitLabRepoStatus[];
  fetchedAt: string;
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
              <span className="font-sans text-[var(--muted)] truncate max-w-[240px]">
                {root.commitTitle}
              </span>
            )}
          </div>
        </div>
      )}

      <ul className="relative ml-3 space-y-1.5 border-l-2 border-[var(--line)] pl-4">
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
                {b.commitTitle && <span className="truncate max-w-[280px]">{b.commitTitle}</span>}
              </div>
            </div>
          </li>
        ))}
        {children.length === 0 && (
          <li className="font-sans text-[var(--faint)]">沒有未合併分支</li>
        )}
      </ul>
    </div>
  );
}

export default function ReposPage() {
  const [data, setData] = useState<StatusPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  const gitlabRepos = data?.repos.filter((r) => r.kind === "gitlab") ?? [];
  const otherRepos = data?.repos.filter((r) => r.kind !== "gitlab") ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-[var(--ink)]">
            <GitBranch className="h-5 w-5 text-[var(--primary)]" />
            Git 狀態
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            依各專案設定的 GitLab 路徑查詢分支樹，監控未合併、過期與分叉落後
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
            （權限 <code className="rounded bg-white/70 px-1">read_api</code>
            ），可選 <code className="rounded bg-white/70 px-1">GITLAB_BASE_URL</code>。設定後重新部署。
            API 本身不額外收費。詳見{" "}
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
          <div className="space-y-4">
            {gitlabRepos.length === 0 && (
              <p className="card p-6 text-sm text-[var(--faint)]">
                沒有可查詢的 GitLab 路徑。請至專案編輯「路徑」填入 GitLab URL。
              </p>
            )}
            {gitlabRepos.map((repo) => (
              <article
                key={`${repo.projectId}-${repo.pathLabel}-${repo.pathUrl}`}
                className="card space-y-3 p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold text-[var(--muted)]">{repo.pathLabel}</p>
                    <h3 className="text-base font-bold text-[var(--ink)]">
                      <Link href={`/projects/${repo.projectId}`} className="hover:text-[var(--primary)]">
                        {repo.projectName}
                      </Link>
                    </h3>
                    <a
                      href={repo.pathUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-0.5 inline-flex items-center gap-1 text-xs text-[var(--primary)] hover:underline"
                    >
                      {repo.gitlabPath ?? repo.pathUrl}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <div className="text-right text-xs text-[var(--muted)]">
                    {repo.defaultBranch && <p>預設：{repo.defaultBranch}</p>}
                    <p>開放 MR：{repo.openMrTotal}</p>
                  </div>
                </div>

                {repo.error ? (
                  <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                    {repo.error}
                  </p>
                ) : (
                  <>
                    {repo.warnings.length > 0 && (
                      <ul className="space-y-1">
                        {repo.warnings.map((w) => (
                          <li
                            key={w}
                            className="flex items-start gap-1.5 text-xs text-amber-800"
                          >
                            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            {w}
                          </li>
                        ))}
                      </ul>
                    )}
                    <BranchTree repo={repo} />
                    {repo.mergedCleanup.length > 0 && (
                      <div className="rounded-lg border border-dashed border-[var(--line)] bg-slate-50/80 px-3 py-2">
                        <p className="mb-1.5 text-xs font-semibold text-[var(--muted)]">
                          可清理（已合併未刪）
                        </p>
                        <ul className="flex flex-wrap gap-1.5">
                          {repo.mergedCleanup.slice(0, 20).map((b) => (
                            <li key={b.name}>
                              <a
                                href={b.webUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex rounded border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-600 hover:border-[var(--primary)] hover:text-[var(--primary)]"
                              >
                                {b.name}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                )}
              </article>
            ))}
          </div>

          {otherRepos.length > 0 && (
            <section className="card space-y-2 p-5">
              <h3 className="flex items-center gap-1.5 text-sm font-bold text-[var(--ink)]">
                <FolderOpen className="h-4 w-4 text-[var(--faint)]" />
                本機／非 GitLab 路徑
              </h3>
              <ul className="space-y-1.5 text-sm">
                {otherRepos.map((r) => (
                  <li
                    key={`${r.projectId}-${r.pathLabel}-${r.pathUrl}`}
                    className="flex flex-wrap items-center gap-2 text-[var(--muted)]"
                  >
                    <span className="font-medium text-[var(--ink)]">{r.projectName}</span>
                    <span>· {r.pathLabel}</span>
                    <code className="truncate text-xs text-[var(--faint)]">{r.pathUrl}</code>
                    <span className="text-xs text-[var(--faint)]">
                      {r.error ?? "無法查詢分支"}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {data?.fetchedAt && (
            <p className="text-center text-[11px] text-[var(--faint)]">
              更新於 {new Date(data.fetchedAt).toLocaleString("zh-TW", { hour12: false })} ·
              快取約 5 分鐘
            </p>
          )}
        </>
      )}
    </div>
  );
}
