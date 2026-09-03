"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { ListControls } from "@/components/ListControls";
import { Modal } from "@/components/Modal";
import { Pagination } from "@/components/Pagination";
import { paginate } from "@/lib/list-utils";
import type { UserRole } from "@/types/attendance";

interface EmployeeRow {
  id: string;
  name: string;
  department: string;
  role: UserRole;
  username: string;
  email?: string;
}

const EMPTY_FORM = {
  name: "",
  department: "",
  role: "employee" as UserRole,
  username: "",
  email: "",
  password: "",
};

export default function AdminEmployeesPage() {
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<EmployeeRow | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);

  const sortedEmployees = [...employees].sort((a, b) => a.name.localeCompare(b.name, "zh-TW"));
  const { items: pagedEmployees, totalCount, totalPages, page: safePage } = paginate(
    sortedEmployees,
    page
  );

  async function load() {
    const res = await fetch("/api/employees");
    const data = await res.json();
    if (res.ok) setEmployees(data.employees ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setMessage("");
    setShowModal(true);
  }

  function openEdit(emp: EmployeeRow) {
    setEditing(emp);
    setForm({ name: emp.name, department: emp.department, role: emp.role, username: emp.username, email: emp.email ?? "", password: "" });
    setMessage("");
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const payload = editing
        ? { id: editing.id, ...form, ...(form.password ? { password: form.password } : {}) }
        : form;

      const res = await fetch("/api/employees", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "操作失敗");

      setShowModal(false);
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "操作失敗");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("確定要刪除此員工？")) return;
    const res = await fetch(`/api/employees?id=${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error ?? "刪除失敗");
      return;
    }
    await load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">員工管理</h2>
          <p className="text-sm text-[var(--muted)]">新增、編輯或刪除員工帳號（Google Email 用於 Google 登入）</p>
        </div>
        <button type="button" onClick={openCreate} className="btn-primary gap-2">
          <Plus className="h-4 w-4" />
          新增員工
        </button>
      </div>

      <section className="card overflow-hidden">
        <div className="border-b border-[var(--line)] px-4 py-4">
          <ListControls
            month={null}
            onMonthChange={() => {}}
            totalCount={totalCount}
            page={safePage}
            totalPages={totalPages}
            showMonthFilter={false}
            showSort={false}
          />
        </div>
        <table className="w-full text-sm">
          <thead className="border-b border-[var(--line)] bg-[var(--bg)]">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-[var(--muted)]">姓名</th>
              <th className="px-4 py-3 text-left font-medium text-[var(--muted)]">部門</th>
              <th className="px-4 py-3 text-left font-medium text-[var(--muted)]">Google Email</th>
              <th className="px-4 py-3 text-left font-medium text-[var(--muted)]">帳號</th>
              <th className="px-4 py-3 text-left font-medium text-[var(--muted)]">角色</th>
              <th className="px-4 py-3 text-right font-medium text-[var(--muted)]">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--line)]">
            {pagedEmployees.map((emp) => (
              <tr key={emp.id} className="hover:bg-[var(--bg)]/50">
                <td className="px-4 py-3 font-medium">{emp.name}</td>
                <td className="px-4 py-3 text-[var(--muted)]">{emp.department}</td>
                <td className="px-4 py-3 text-xs text-[var(--muted)]">{emp.email || "—"}</td>
                <td className="px-4 py-3 font-mono text-xs">{emp.username}</td>
                <td className="px-4 py-3">
                  <span className={emp.role === "admin" ? "chip-info" : "chip-approved"}>
                    {emp.role === "admin" ? "管理員" : "員工"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => openEdit(emp)}
                    className="mr-2 rounded-lg p-1.5 text-[var(--muted)] hover:bg-[var(--bg)] hover:text-[var(--primary)]"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(emp.id)}
                    className="rounded-lg p-1.5 text-[var(--muted)] hover:bg-red-50 hover:text-[var(--danger)]"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {totalCount > 0 && (
          <div className="px-4 pb-4">
            <Pagination page={safePage} totalPages={totalPages} onPageChange={setPage} />
          </div>
        )}
      </section>

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? "編輯員工" : "新增員工"}
        footer={
          <>
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">
              取消
            </button>
            <button type="submit" form="employee-form" disabled={loading} className="btn-primary">
              {loading ? "儲存中..." : "儲存"}
            </button>
          </>
        }
      >
        <form id="employee-form" onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">姓名</label>
            <input
              className="input-field"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">部門</label>
            <input
              className="input-field"
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Google Email</label>
            <input
              type="email"
              className="input-field"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="name@gmail.com（Google 登入用）"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">帳號</label>
            <input
              className="input-field"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              密碼{editing && "（留空則不變更）"}
            </label>
            <input
              type="password"
              className="input-field"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required={!editing}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">角色</label>
            <select
              className="input-field"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
            >
              <option value="employee">員工</option>
              <option value="admin">管理員</option>
            </select>
          </div>
          {message && <p className="text-sm text-[var(--danger)]">{message}</p>}
        </form>
      </Modal>
    </div>
  );
}
