/**
 * 產生 system.json → SQL（供 Supabase MCP execute_sql 或 psql 使用）
 * node scripts/import-via-mcp-sql.mjs > /tmp/jiesheng-import.sql
 */
import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const store = JSON.parse(await readFile(path.join(__dirname, "..", "data", "system.json"), "utf-8"));

function esc(v) {
  if (v == null) return "NULL";
  return `'${String(v).replace(/'/g, "''")}'`;
}

function escJson(v) {
  if (v == null) return "'[]'::jsonb";
  return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
}

function escArr(v) {
  if (!v?.length) return "'{}'::text[]";
  return `ARRAY[${v.map((x) => esc(x)).join(",")}]`;
}

console.log("BEGIN;");

for (const e of store.employees) {
  const username = e.username?.trim() || `legacy-${e.id}`;
  console.log(
    `INSERT INTO employees (id,name,department,role,username,password) VALUES (${esc(e.id)},${esc(e.name)},${esc(e.department ?? "")},${esc(e.role)},${esc(username)},${esc(e.password ?? "")}) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, department=EXCLUDED.department, role=EXCLUDED.role, username=EXCLUDED.username, password=EXCLUDED.password;`
  );
}

for (const r of store.records ?? []) {
  console.log(
    `INSERT INTO attendance_records (id,employee_id,employee_name,type,timestamp,note,late_minutes,early_leave_minutes) VALUES (${esc(r.id)},${esc(r.employeeId)},${esc(r.employeeName)},${esc(r.type)},${esc(r.timestamp)},${r.note ? esc(r.note) : "NULL"},${r.lateMinutes ?? 0},${r.earlyLeaveMinutes ?? 0}) ON CONFLICT (id) DO NOTHING;`
  );
}

for (const l of store.leaves ?? []) {
  console.log(
    `INSERT INTO leave_requests (id,employee_id,employee_name,type,start_date,end_date,days,reason,status,created_at) VALUES (${esc(l.id)},${esc(l.employeeId)},${esc(l.employeeName)},${esc(l.type)},${esc(l.startDate)},${esc(l.endDate)},${l.days},${esc(l.reason)},${esc(l.status)},${esc(l.createdAt)}) ON CONFLICT (id) DO NOTHING;`
  );
}

for (const a of store.announcements ?? []) {
  console.log(
    `INSERT INTO announcements (id,title,content,author,pinned,created_at) VALUES (${esc(a.id)},${esc(a.title)},${esc(a.content)},${esc(a.author)},${a.pinned},${esc(a.createdAt)}) ON CONFLICT (id) DO NOTHING;`
  );
}

for (const p of store.projects ?? []) {
  console.log(
    `INSERT INTO projects (id,name,description,paths,status,manager_id,manager_name,member_ids,start_date,end_date,created_at,updated_at) VALUES (${esc(p.id)},${esc(p.name)},${p.description ? esc(p.description) : "NULL"},${escJson(p.paths)},${esc(p.status)},${p.managerId ? esc(p.managerId) : "NULL"},${p.managerName ? esc(p.managerName) : "NULL"},${escArr(p.memberIds)},${p.startDate ? esc(p.startDate) : "NULL"},${p.endDate ? esc(p.endDate) : "NULL"},${esc(p.createdAt)},${esc(p.updatedAt ?? p.createdAt)}) ON CONFLICT (id) DO NOTHING;`
  );
}

for (const s of store.sprints ?? []) {
  console.log(
    `INSERT INTO sprints (id,project_id,name,goal,status,start_date,end_date,created_at) VALUES (${esc(s.id)},${esc(s.projectId)},${esc(s.name)},${s.goal ? esc(s.goal) : "NULL"},${esc(s.status)},${esc(s.startDate)},${esc(s.endDate)},${esc(s.createdAt)}) ON CONFLICT (id) DO NOTHING;`
  );
}

for (const t of store.tasks ?? []) {
  console.log(
    `INSERT INTO tasks (id,project_id,sprint_id,title,description,status,priority,assignee_id,assignee_name,due_date,created_at,updated_at) VALUES (${esc(t.id)},${esc(t.projectId)},${t.sprintId ? esc(t.sprintId) : "NULL"},${esc(t.title)},${t.description ? esc(t.description) : "NULL"},${esc(t.status)},${esc(t.priority)},${t.assigneeId ? esc(t.assigneeId) : "NULL"},${t.assigneeName ? esc(t.assigneeName) : "NULL"},${t.dueDate ? esc(t.dueDate) : "NULL"},${esc(t.createdAt)},${esc(t.updatedAt ?? t.createdAt)}) ON CONFLICT (id) DO NOTHING;`
  );
}

for (const c of store.calendarEvents ?? []) {
  console.log(
    `INSERT INTO calendar_events (id,title,type,start_date,end_date,start_time,end_time,description,created_at) VALUES (${esc(c.id)},${esc(c.title)},${esc(c.type)},${esc(c.startDate)},${c.endDate ? esc(c.endDate) : "NULL"},${c.startTime ? esc(c.startTime) : "NULL"},${c.endTime ? esc(c.endTime) : "NULL"},${c.description ? esc(c.description) : "NULL"},${esc(c.createdAt)}) ON CONFLICT (id) DO NOTHING;`
  );
}

if (store.workSettings) {
  console.log(
    `UPDATE app_settings SET work_settings = '${JSON.stringify(store.workSettings).replace(/'/g, "''")}'::jsonb WHERE id = 'default';`
  );
}

console.log("COMMIT;");
