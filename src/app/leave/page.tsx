"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Briefcase,
  Calendar,
  CalendarOff,
  Check,
  CheckCircle2,
  ClipboardList,
  Palmtree,
  Plus,
  Stethoscope,
  X,
} from "lucide-react";
import { ListControls } from "@/components/ListControls";
import { Pagination } from "@/components/Pagination";
import { Modal } from "@/components/Modal";
import { useListPipeline, type SortOrder } from "@/lib/list-utils";
import type { Employee } from "@/types/attendance";
import type { SessionUser } from "@/types/auth";
import type { LeaveRequest, LeaveStatus, LeaveType } from "@/types/system";

const LEAVE_TYPES: { value: LeaveType; label: string }[] = [
  { value: "annual", label: "特休" },
  { value: "sick", label: "病假" },
  { value: "personal", label: "事假" },
  { value: "other", label: "其他" },
];

const LEAVE_TYPE_META: Record<
  LeaveType,
  { label: string; color: string; bg: string; Icon: typeof Palmtree }
> = {
  annual: { label: "特休", color: "#2563eb", bg: "rgba(37, 99, 235, 0.1)", Icon: Palmtree },
  sick: { label: "病假", color: "#dc2626", bg: "rgba(220, 38, 38, 0.1)", Icon: Stethoscope },
  personal: { label: "事假", color: "#64748b", bg: "rgba(100, 116, 139, 0.12)", Icon: Briefcase },
  other: { label: "其他", color: "#92400e", bg: "rgba(146, 64, 14, 0.1)", Icon: CalendarOff },
};

const STATUS_CHIP: Record<LeaveStatus, string> = {
  pending: "chip-pending",
  approved: "chip-approved",
  rejected: "chip-rejected",
};

const STATUS_LABEL: Record<LeaveStatus, string> = {
  pending: "待審核",
  approved: "已核准",
  rejected: "已駁回",
};

type TabKey = "all" | LeaveStatus;

const TABS: { key: TabKey; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "pending", label: "待審核" },
  { key: "approved", label: "已核准" },
  { key: "rejected", label: "已駁回" },
];

function formatShortDate(iso: string) {
  const d = new Date(iso);
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function LeavePage() {
  const searchParams = useSearchParams();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [employeeId, setEmployeeId] = useState("");
  const [type, setType] = useState<LeaveType>("annual");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const [tabInitialized, setTabInitialized] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<LeaveRequest | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectLoading, setRejectLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchLoading, setBatchLoading] = useState(false);
  const [month, setMonth] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const isAdmin = user?.role === "admin";

  const showToast = useCallback((text: string) => {
    setToast(text);
    setTimeout(() => setToast(null), 2800);
  }, []);

  const employeeMap = useMemo(
    () => new Map(employees.map((e) => [e.id, e])),
    [employees]
  );

  const counts = useMemo(
    () => ({
      all: leaves.length,
      pending: leaves.filter((l) => l.status === "pending").length,
      approved: leaves.filter((l) => l.status === "approved").length,
      rejected: leaves.filter((l) => l.status === "rejected").length,
    }),
    [leaves]
  );

  const tabFilteredLeaves = useMemo(() => {
    if (activeTab === "all") return leaves;
    return leaves.filter((l) => l.status === activeTab);
  }, [leaves, activeTab]);

  const listResult = useListPipeline(tabFilteredLeaves, {
    month,
    getDates: (l) => [l.startDate, l.createdAt],
    getSortDate: (l) => l.createdAt,
    sortOrder,
    page,
  });

  const { items: pagedLeaves, totalCount, totalPages, page: safePage } = listResult;

  useEffect(() => {
    setPage(1);
  }, [activeTab, month, sortOrder]);

  async function load() {
    const [empRes, leaveRes, meRes] = await Promise.all([
      fetch("/api/clock"),
      fetch("/api/leaves"),
      fetch("/api/auth/me"),
    ]);
    const empData = await empRes.json();
    const leaveData = await leaveRes.json();
    const meData = meRes.ok ? await meRes.json() : null;
    const me = meData?.user ?? null;
    const loadedLeaves: LeaveRequest[] = leaveData.leaves ?? [];

    setUser(me);
    setEmployees(empData.employees ?? []);
    setLeaves(loadedLeaves);

    if (!tabInitialized) {
      const tabParam = searchParams.get("tab");
      if (tabParam && ["all", "pending", "approved", "rejected"].includes(tabParam)) {
        setActiveTab(tabParam as TabKey);
      } else if (me?.role === "admin") {
        setActiveTab("pending");
      }
      setTabInitialized(true);
    }

    if (!employeeId && empData.employees?.length) {
      const self = me?.employeeId
        ? empData.employees.find((e: Employee) => e.id === me.employeeId)
        : empData.employees[0];
      setEmployeeId(self?.id ?? empData.employees[0].id);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openModal() {
    setMessage("");
    setReason("");
    setStartDate("");
    setEndDate("");
    setType("annual");
    if (user?.employeeId) {
      setEmployeeId(user.employeeId);
    } else if (employees.length) {
      setEmployeeId(employees[0].id);
    }
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/leaves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId, type, startDate, endDate, reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "申請失敗");

      setShowModal(false);
      showToast("請假申請已送出");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "申請失敗");
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(id: string) {
    const res = await fetch("/api/leaves", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "approved" }),
    });
    if (!res.ok) {
      const data = await res.json();
      showToast(data.error ?? "核准失敗");
      return;
    }
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    showToast("已核准請假申請");
    await load();
  }

  async function handleRejectConfirm() {
    if (!rejectTarget) return;
    setRejectLoading(true);
    try {
      const res = await fetch("/api/leaves", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: rejectTarget.id,
          status: "rejected",
          rejectReason: rejectReason.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        showToast(data.error ?? "駁回失敗");
        return;
      }
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(rejectTarget.id);
        return next;
      });
      setRejectTarget(null);
      setRejectReason("");
      showToast("已駁回請假申請");
      await load();
    } finally {
      setRejectLoading(false);
    }
  }

  async function handleBatchApprove() {
    if (!selectedIds.size) return;
    setBatchLoading(true);
    try {
      const ids = Array.from(selectedIds);
      const results = await Promise.all(
        ids.map((id) =>
          fetch("/api/leaves", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, status: "approved" }),
          })
        )
      );
      const failed = results.filter((r) => !r.ok).length;
      if (failed > 0) {
        showToast(`${ids.length - failed} 筆已核准，${failed} 筆失敗`);
      } else {
        showToast(`已批量核准 ${ids.length} 筆請假`);
      }
      setSelectedIds(new Set());
      await load();
    } finally {
      setBatchLoading(false);
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const pendingInView = tabFilteredLeaves.filter((l) => l.status === "pending");

  function toggleSelectAll() {
    const pendingIds = pendingInView.map((l) => l.id);
    if (pendingIds.every((id) => selectedIds.has(id))) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingIds));
    }
  }

  const allPendingSelected =
    pendingInView.length > 0 && pendingInView.every((l) => selectedIds.has(l.id));

  return (
    <>
      <section className="card p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">請假管理</h2>
            <p className="mt-0.5 text-sm text-[var(--muted)]">
              {isAdmin ? "審核員工請假申請" : "查看與申請個人假單"}
            </p>
          </div>
          <button type="button" onClick={openModal} className="btn-primary gap-1.5 px-3 py-2 text-xs">
            <Plus className="h-3.5 w-3.5" />
            新增請假
          </button>
        </div>

        {/* Tabs */}
        <div className="mt-5 flex flex-col gap-5">
        <div className="flex flex-wrap gap-1 rounded-[10px] border border-[var(--line)] bg-[var(--bg)] p-1">
          {TABS.map((tab) => {
            const count = counts[tab.key];
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-white text-[var(--primary)] shadow-sm"
                    : "text-[var(--muted)] hover:text-[var(--ink)]"
                }`}
              >
                {tab.label}
                {count > 0 && (
                  <span
                    className={`inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${
                      tab.key === "pending" && count > 0
                        ? "bg-[var(--warning)] text-white"
                        : isActive
                          ? "bg-[var(--primary)]/10 text-[var(--primary)]"
                          : "bg-[var(--line)] text-[var(--muted)]"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
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

        {/* Batch actions (admin + pending tab) */}
        {isAdmin && activeTab === "pending" && pendingInView.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 rounded-[10px] border border-[var(--line)] bg-white/60 px-4 py-2.5">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--muted)]">
              <input
                type="checkbox"
                checked={allPendingSelected}
                onChange={toggleSelectAll}
                className="h-4 w-4 rounded border-[var(--line-2)] accent-[var(--primary)]"
              />
              全選
            </label>
            {selectedIds.size > 0 && (
              <button
                type="button"
                onClick={handleBatchApprove}
                disabled={batchLoading}
                className="btn-primary gap-1.5 px-3 py-1.5 text-xs disabled:opacity-50"
              >
                <Check className="h-3.5 w-3.5" />
                批量核准（{selectedIds.size}）
              </button>
            )}
          </div>
        )}

        {/* List */}
        <div className="space-y-3">
          {pagedLeaves.length > 0 ? (
            pagedLeaves.map((leave) => {
              const meta = LEAVE_TYPE_META[leave.type];
              const TypeIcon = meta.Icon;
              const dept = employeeMap.get(leave.employeeId)?.department ?? "";
              const canReview = isAdmin && leave.status === "pending";

              return (
                <article
                  key={leave.id}
                  className="relative overflow-hidden rounded-[10px] border border-[var(--line)] bg-white/70 transition-shadow hover:shadow-sm"
                >
                  {/* Left color bar */}
                  <div
                    className="absolute left-0 top-0 h-full w-1"
                    style={{ backgroundColor: meta.color }}
                  />

                  <div className="p-4 pl-5">
                    {/* Header row */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        {canReview && (
                          <input
                            type="checkbox"
                            checked={selectedIds.has(leave.id)}
                            onChange={() => toggleSelect(leave.id)}
                            className="mt-0.5 h-4 w-4 shrink-0 rounded border-[var(--line-2)] accent-[var(--primary)]"
                          />
                        )}
                        <div
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                          style={{ backgroundColor: meta.bg, color: meta.color }}
                        >
                          <TypeIcon className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-semibold text-[var(--ink)]">{meta.label}</p>
                          <p className="text-sm text-[var(--muted)]">
                            {leave.employeeName}
                            {dept && <span> · {dept}</span>}
                          </p>
                        </div>
                      </div>
                      <span className={STATUS_CHIP[leave.status]}>{STATUS_LABEL[leave.status]}</span>
                    </div>

                    {/* Date & reason */}
                    <div className="mt-3 space-y-1.5 pl-0 sm:pl-[3.25rem]">
                      <p className="flex items-center gap-1.5 text-sm text-[var(--ink)]">
                        <Calendar className="h-3.5 w-3.5 shrink-0 text-[var(--muted)]" />
                        {leave.startDate} ~ {leave.endDate}
                        <span className="text-[var(--muted)]">（{leave.days} 天）</span>
                      </p>
                      <p className="text-sm">
                        <span className="text-[var(--muted)]">事由：</span>
                        {leave.reason}
                      </p>
                      {leave.status === "rejected" && leave.rejectReason && (
                        <p className="text-sm text-[var(--danger)]">
                          <span className="font-medium">駁回原因：</span>
                          {leave.rejectReason}
                        </p>
                      )}
                    </div>

                    {/* Footer */}
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--line)] pt-3 pl-0 sm:pl-[3.25rem]">
                      {canReview ? (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleApprove(leave.id)}
                            className="btn-primary gap-1 px-3 py-1.5 text-xs"
                          >
                            <Check className="h-3.5 w-3.5" />
                            核准
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setRejectTarget(leave);
                              setRejectReason("");
                            }}
                            className="btn-secondary gap-1 px-3 py-1.5 text-xs text-[var(--danger)]"
                          >
                            <X className="h-3.5 w-3.5" />
                            駁回
                          </button>
                        </div>
                      ) : (
                        <div className="text-xs text-[var(--muted)]">
                          {leave.reviewedAt && leave.reviewedBy ? (
                            <>
                              {STATUS_LABEL[leave.status]}於 {formatDateTime(leave.reviewedAt)}
                              <span className="mx-1">·</span>
                              審核人 {leave.reviewedBy}
                            </>
                          ) : null}
                        </div>
                      )}
                      <span className="text-xs text-[var(--faint)]">
                        申請於 {formatShortDate(leave.createdAt)}
                      </span>
                    </div>
                  </div>
                </article>
              );
            })
          ) : activeTab === "pending" ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--success)]/10">
                <CheckCircle2 className="h-7 w-7 text-[var(--success)]" />
              </div>
              <p className="font-medium text-[var(--ink)]">目前沒有待審核的假單</p>
              <p className="mt-1 text-sm text-[var(--muted)]">所有申請皆已處理完畢</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--line)]">
                <ClipboardList className="h-7 w-7 text-[var(--muted)]" />
              </div>
              <p className="font-medium text-[var(--ink)]">尚無請假紀錄</p>
              <p className="mt-1 text-sm text-[var(--muted)]">點擊右上角新增請假申請</p>
            </div>
          )}
        </div>

        {totalCount > 0 && (
            <Pagination page={safePage} totalPages={totalPages} onPageChange={setPage} />
        )}
        </div>
      </section>

      {/* New leave modal */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="新增請假申請"
        footer={
          <>
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">
              取消
            </button>
            <button type="submit" form="leave-form" disabled={loading} className="btn-primary disabled:opacity-50">
              {loading ? "送出中…" : "送出申請"}
            </button>
          </>
        }
      >
        <form id="leave-form" onSubmit={handleSubmit} className="space-y-4">
          {isAdmin && (
            <div>
              <label className="mb-1 block text-sm">申請人</label>
              <select
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                className="input-field"
              >
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}（{e.department}）
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm">假別</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as LeaveType)}
              className="input-field"
            >
              {LEAVE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm">開始日期</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="input-field"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm">結束日期</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="input-field"
                required
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm">事由</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="input-field min-h-[100px]"
              placeholder="請說明請假原因"
              required
            />
          </div>
          {message && <p className="text-sm text-[var(--danger)]">{message}</p>}
        </form>
      </Modal>

      {/* Reject modal */}
      <Modal
        open={!!rejectTarget}
        onClose={() => {
          setRejectTarget(null);
          setRejectReason("");
        }}
        title="駁回請假申請"
        size="sm"
        footer={
          <>
            <button
              type="button"
              onClick={() => {
                setRejectTarget(null);
                setRejectReason("");
              }}
              className="btn-secondary"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleRejectConfirm}
              disabled={rejectLoading}
              className="btn-secondary text-[var(--danger)] disabled:opacity-50"
            >
              確認駁回
            </button>
          </>
        }
      >
        {rejectTarget && (
          <div className="space-y-4">
            <p className="text-sm text-[var(--muted)]">
              確定要駁回 <span className="font-medium text-[var(--ink)]">{rejectTarget.employeeName}</span>{" "}
              的請假申請（{LEAVE_TYPE_META[rejectTarget.type].label}，{rejectTarget.startDate} ~{" "}
              {rejectTarget.endDate}）？
            </p>
            <div>
              <label className="mb-1 block text-sm">駁回原因（選填）</label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="input-field min-h-[80px]"
                placeholder="可說明駁回理由，讓員工了解"
              />
            </div>
          </div>
        )}
      </Modal>

      {/* Toast */}
      {toast && (
        <div className="cal-toast" role="status">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          {toast}
        </div>
      )}
    </>
  );
}
