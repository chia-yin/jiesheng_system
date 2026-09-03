"use client";

import { useEffect, useState } from "react";
import { Pin, Plus } from "lucide-react";
import { ListControls } from "@/components/ListControls";
import { Modal } from "@/components/Modal";
import { Pagination } from "@/components/Pagination";
import { useListPipeline, type SortOrder } from "@/lib/list-utils";
import type { Announcement } from "@/types/system";
import type { SessionUser } from "@/types/auth";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("zh-TW");
}

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [month, setMonth] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  async function load() {
    const [annRes, meRes] = await Promise.all([fetch("/api/announcements"), fetch("/api/auth/me")]);
    const data = await annRes.json();
    const meData = meRes.ok ? await meRes.json() : null;
    setUser(meData?.user ?? null);
    setAnnouncements(data.announcements ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [month, sortOrder]);

  const { items: pagedAnnouncements, totalCount, totalPages, page: safePage } = useListPipeline(
    announcements,
    {
      month,
      getDates: (a) => [a.createdAt],
      getSortDate: (a) => a.createdAt,
      sortOrder,
      page,
    }
  );

  function openModal() {
    setMessage("");
    setTitle("");
    setContent("");
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content, pinned: false }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "發布失敗");

      setShowModal(false);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "發布失敗");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <section className="card space-y-5 p-6">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">公告列表</h2>
          {user?.role === "admin" && (
            <button type="button" onClick={openModal} className="btn-primary gap-1.5 px-3 py-2 text-xs">
              <Plus className="h-3.5 w-3.5" />
              發布公告
            </button>
          )}
        </div>

        <ListControls
          month={month}
          onMonthChange={setMonth}
          totalCount={totalCount}
          page={safePage}
          totalPages={totalPages}
          sortOrder={sortOrder}
          onSortChange={setSortOrder}
        />

        <div className="space-y-3">
          {pagedAnnouncements.length ? (
            pagedAnnouncements.map((ann) => (
              <article key={ann.id} className="rounded-[10px] border border-[var(--line)] bg-white/60 p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-medium">
                    {ann.pinned && <Pin className="mr-1 inline h-3.5 w-3.5 text-[var(--brown-l)]" />}
                    {ann.title}
                  </h3>
                  <span className="text-xs text-[var(--faint)]">{formatDate(ann.createdAt)}</span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{ann.content}</p>
                <p className="mt-2 text-xs text-[var(--muted)]">發布：{ann.author}</p>
              </article>
            ))
          ) : (
            <p className="py-6 text-sm text-[var(--muted)]">
              {month ? "此月份沒有公告" : "尚無公告"}
            </p>
          )}
        </div>

        {totalCount > 0 && (
          <Pagination page={safePage} totalPages={totalPages} onPageChange={setPage} />
        )}
      </section>

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="發布公告"
        footer={
          <>
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">
              取消
            </button>
            <button type="submit" form="announcement-form" disabled={loading} className="btn-primary disabled:opacity-50">
              {loading ? "發布中…" : "發布"}
            </button>
          </>
        }
      >
        <form id="announcement-form" onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm">標題</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input-field"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm">內容</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="input-field min-h-[120px]"
              required
            />
          </div>
          {message && <p className="text-sm text-[var(--danger)]">{message}</p>}
        </form>
      </Modal>
    </>
  );
}
