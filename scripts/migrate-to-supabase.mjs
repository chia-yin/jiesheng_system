/**
 * 將 data/system.json 匯入獨立 Supabase Project
 * 用法：SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/migrate-to-supabase.mjs
 */
import { readFile, access } from "fs/promises";
import { createClient } from "@supabase/supabase-js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "..", "data", "system.json");

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("請設定 SUPABASE_URL 與 SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });

async function syncTable(table, rows, toRow) {
  if (!rows?.length) {
    console.log(`  ${table}: 0 筆（略過）`);
    return;
  }
  const { error } = await sb.from(table).upsert(rows.map(toRow), { onConflict: "id" });
  if (error) throw new Error(`${table}: ${error.message}`);
  console.log(`  ${table}: ${rows.length} 筆`);
}

async function main() {
  try {
    await access(DATA_FILE);
  } catch {
    console.error(`找不到 ${DATA_FILE}，請先在本地執行過系統產生資料`);
    process.exit(1);
  }

  const store = JSON.parse(await readFile(DATA_FILE, "utf-8"));
  console.log("開始匯入 Supabase…");

  await syncTable("employees", store.employees, (e) => ({
    id: e.id,
    name: e.name,
    department: e.department ?? "",
    role: e.role,
    username: e.username,
    password: e.password ?? "",
    line_user_id: e.lineUserId ?? null,
    supabase_user_id: e.supabaseUserId ?? null,
    line_bind_code: e.lineBindCode ?? null,
    line_bind_expires_at: e.lineBindExpiresAt ?? null,
  }));

  await syncTable("attendance_records", store.records, (r) => ({
    id: r.id,
    employee_id: r.employeeId,
    employee_name: r.employeeName,
    type: r.type,
    timestamp: r.timestamp,
    note: r.note ?? null,
    late_minutes: r.lateMinutes ?? 0,
    early_leave_minutes: r.earlyLeaveMinutes ?? 0,
  }));

  await syncTable("leave_requests", store.leaves, (l) => ({
    id: l.id,
    employee_id: l.employeeId,
    employee_name: l.employeeName,
    type: l.type,
    start_date: l.startDate,
    end_date: l.endDate,
    days: l.days,
    reason: l.reason,
    status: l.status,
    created_at: l.createdAt,
    google_event_id: l.googleEventId ?? null,
    reject_reason: l.rejectReason ?? null,
    reviewed_at: l.reviewedAt ?? null,
    reviewed_by: l.reviewedBy ?? null,
  }));

  await syncTable("announcements", store.announcements, (a) => ({
    id: a.id,
    title: a.title,
    content: a.content,
    author: a.author,
    pinned: a.pinned,
    created_at: a.createdAt,
  }));

  await syncTable("projects", store.projects, (p) => ({
    id: p.id,
    name: p.name,
    description: p.description ?? null,
    paths: p.paths ?? [],
    status: p.status,
    manager_id: p.managerId ?? null,
    manager_name: p.managerName ?? null,
    member_ids: p.memberIds ?? [],
    start_date: p.startDate ?? null,
    end_date: p.endDate ?? null,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
  }));

  await syncTable("sprints", store.sprints, (s) => ({
    id: s.id,
    project_id: s.projectId,
    name: s.name,
    goal: s.goal ?? null,
    status: s.status,
    start_date: s.startDate,
    end_date: s.endDate,
    created_at: s.createdAt,
  }));

  await syncTable("tasks", store.tasks, (t) => ({
    id: t.id,
    project_id: t.projectId,
    sprint_id: t.sprintId ?? null,
    title: t.title,
    description: t.description ?? null,
    status: t.status,
    priority: t.priority,
    assignee_id: t.assigneeId ?? null,
    assignee_name: t.assigneeName ?? null,
    due_date: t.dueDate ?? null,
    created_at: t.createdAt,
    updated_at: t.updatedAt,
  }));

  await syncTable("calendar_events", store.calendarEvents ?? [], (c) => ({
    id: c.id,
    title: c.title,
    type: c.type,
    start_date: c.startDate,
    end_date: c.endDate ?? null,
    start_time: c.startTime ?? null,
    end_time: c.endTime ?? null,
    employee_id: c.employeeId ?? null,
    project_id: c.projectId ?? null,
    leave_id: c.leaveId ?? null,
    description: c.description ?? null,
    google_event_id: c.googleEventId ?? null,
    created_at: c.createdAt,
  }));

  const { error: settingsError } = await sb.from("app_settings").upsert({
    id: "default",
    work_settings: store.workSettings ?? {
      startTime: "09:00",
      endTime: "18:00",
      breakMinutes: 60,
      flexBeforeMinutes: 60,
      flexAfterMinutes: 60,
    },
    google_tokens: store.googleTokens ?? null,
  });
  if (settingsError) throw settingsError;

  console.log("✅ 匯入完成");
}

main().catch((err) => {
  console.error("❌", err.message ?? err);
  process.exit(1);
});
