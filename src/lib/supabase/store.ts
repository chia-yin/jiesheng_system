import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { AttendanceRecord, Employee } from "@/types/attendance";
import type {
  Announcement,
  CalendarEvent,
  GoogleTokens,
  LeaveRequest,
  Project,
  ProjectPath,
  Sprint,
  SystemStore,
  Task,
  WorkSettings,
} from "@/types/system";
import {
  DEFAULT_WORK_SETTINGS,
  migrateEmployees,
  newId,
  normalizeStore,
} from "@/lib/db-json";

type EmployeeRow = {
  id: string;
  name: string;
  department: string;
  role: string;
  username: string;
  password: string;
  email: string | null;
  google_id: string | null;
  line_user_id: string | null;
  supabase_user_id: string | null;
  line_bind_code: string | null;
  line_bind_expires_at: string | null;
};

function rowToEmployee(row: EmployeeRow): Employee {
  return {
    id: row.id,
    name: row.name,
    department: row.department ?? "",
    role: row.role as Employee["role"],
    username: row.username,
    password: row.password ?? "",
    email: row.email ?? undefined,
    googleId: row.google_id ?? undefined,
    lineUserId: row.line_user_id ?? undefined,
    supabaseUserId: row.supabase_user_id ?? undefined,
    lineBindCode: row.line_bind_code ?? undefined,
    lineBindExpiresAt: row.line_bind_expires_at ?? undefined,
  };
}

function employeeToRow(emp: Employee): EmployeeRow {
  return {
    id: emp.id,
    name: emp.name,
    department: emp.department,
    role: emp.role,
    username: emp.username,
    password: emp.password,
    email: emp.email ?? null,
    google_id: emp.googleId ?? null,
    line_user_id: emp.lineUserId ?? null,
    supabase_user_id: emp.supabaseUserId ?? null,
    line_bind_code: emp.lineBindCode ?? null,
    line_bind_expires_at: emp.lineBindExpiresAt ?? null,
  };
}

export async function getSupabaseStore(): Promise<SystemStore> {
  const sb = getSupabaseAdmin();

  const [
    employeesRes,
    recordsRes,
    leavesRes,
    announcementsRes,
    projectsRes,
    sprintsRes,
    tasksRes,
    calendarRes,
    settingsRes,
  ] = await Promise.all([
    sb.from("employees").select("*"),
    sb.from("attendance_records").select("*").order("timestamp", { ascending: false }),
    sb.from("leave_requests").select("*").order("created_at", { ascending: false }),
    sb.from("announcements").select("*").order("created_at", { ascending: false }),
    sb.from("projects").select("*").order("updated_at", { ascending: false }),
    sb.from("sprints").select("*").order("created_at", { ascending: false }),
    sb.from("tasks").select("*").order("updated_at", { ascending: false }),
    sb.from("calendar_events").select("*").order("created_at", { ascending: false }),
    sb.from("app_settings").select("*").eq("id", "default").maybeSingle(),
  ]);

  const errors = [
    employeesRes.error,
    recordsRes.error,
    leavesRes.error,
    announcementsRes.error,
    projectsRes.error,
    sprintsRes.error,
    tasksRes.error,
    calendarRes.error,
    settingsRes.error,
  ].filter(Boolean);

  if (errors.length) {
    throw new Error(errors.map((e) => e!.message).join("; "));
  }

  let store: SystemStore = {
    employees: (employeesRes.data ?? []).map((r) => rowToEmployee(r as EmployeeRow)),
    records: (recordsRes.data ?? []).map((r) => ({
      id: r.id,
      employeeId: r.employee_id,
      employeeName: r.employee_name,
      type: r.type as AttendanceRecord["type"],
      timestamp: r.timestamp,
      note: r.note ?? undefined,
      lateMinutes: r.late_minutes ?? undefined,
      earlyLeaveMinutes: r.early_leave_minutes ?? undefined,
    })),
    leaves: (leavesRes.data ?? []).map((r) => ({
      id: r.id,
      employeeId: r.employee_id,
      employeeName: r.employee_name,
      type: r.type as LeaveRequest["type"],
      startDate: r.start_date,
      endDate: r.end_date,
      days: Number(r.days),
      reason: r.reason,
      status: r.status as LeaveRequest["status"],
      createdAt: r.created_at,
      googleEventId: r.google_event_id ?? undefined,
      rejectReason: r.reject_reason ?? undefined,
      reviewedAt: r.reviewed_at ?? undefined,
      reviewedBy: r.reviewed_by ?? undefined,
    })),
    announcements: (announcementsRes.data ?? []).map((r) => ({
      id: r.id,
      title: r.title,
      content: r.content,
      author: r.author,
      pinned: r.pinned,
      createdAt: r.created_at,
    })),
    projects: (projectsRes.data ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description ?? undefined,
      paths: (r.paths as ProjectPath[] | null) ?? undefined,
      status: r.status as Project["status"],
      managerId: r.manager_id ?? undefined,
      managerName: r.manager_name ?? undefined,
      memberIds: r.member_ids ?? undefined,
      startDate: r.start_date ?? undefined,
      endDate: r.end_date ?? undefined,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })),
    sprints: (sprintsRes.data ?? []).map((r) => ({
      id: r.id,
      projectId: r.project_id ?? undefined,
      name: r.name,
      goal: r.goal ?? undefined,
      status: r.status as Sprint["status"],
      startDate: r.start_date,
      endDate: r.end_date,
      createdAt: r.created_at,
    })),
    tasks: (tasksRes.data ?? []).map((r) => ({
      id: r.id,
      projectId: r.project_id,
      sprintId: r.sprint_id ?? undefined,
      title: r.title,
      description: r.description ?? undefined,
      status: r.status as Task["status"],
      priority: r.priority as Task["priority"],
      assigneeId: r.assignee_id ?? undefined,
      assigneeName: r.assignee_name ?? undefined,
      dueDate: r.due_date ?? undefined,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })),
    calendarEvents: (calendarRes.data ?? []).map((r) => ({
      id: r.id,
      title: r.title,
      type: r.type as CalendarEvent["type"],
      startDate: r.start_date,
      endDate: r.end_date ?? undefined,
      startTime: r.start_time ?? undefined,
      endTime: r.end_time ?? undefined,
      employeeId: r.employee_id ?? undefined,
      projectId: r.project_id ?? undefined,
      leaveId: r.leave_id ?? undefined,
      description: r.description ?? undefined,
      googleEventId: r.google_event_id ?? undefined,
      createdAt: r.created_at,
    })),
    workSettings: (settingsRes.data?.work_settings as WorkSettings) ?? { ...DEFAULT_WORK_SETTINGS },
    googleTokens: (settingsRes.data?.google_tokens as GoogleTokens | null) ?? undefined,
    integrationSettings:
      (settingsRes.data?.integration_settings as import("@/types/system").IntegrationSettings | null) ??
      undefined,
  };

  if (!store.employees.length) {
    store = normalizeStore(store);
    return store;
  }

  store.employees = migrateEmployees(store.employees);
  store = normalizeStore(store);
  return store;
}

async function syncTable<T extends { id: string }>(
  table: string,
  rows: T[],
  toRow: (item: T) => Record<string, unknown>
) {
  const sb = getSupabaseAdmin();
  const { data: existing, error: listError } = await sb.from(table).select("id");
  if (listError) throw listError;

  const incomingIds = new Set(rows.map((r) => r.id));
  const toDelete = (existing ?? []).map((r) => r.id).filter((id) => !incomingIds.has(id));

  if (toDelete.length) {
    const { error } = await sb.from(table).delete().in("id", toDelete);
    if (error) throw error;
  }

  if (rows.length) {
    const { error } = await sb.from(table).upsert(rows.map(toRow), { onConflict: "id" });
    if (error) throw error;
  }
}

export async function saveSupabaseStore(store: SystemStore): Promise<void> {
  const sb = getSupabaseAdmin();

  await syncTable("employees", store.employees, (e) => employeeToRow(e));
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
    project_id: s.projectId ?? null,
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
  await syncTable("calendar_events", store.calendarEvents, (c) => ({
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

  const { error } = await sb.from("app_settings").upsert({
    id: "default",
    work_settings: store.workSettings,
    google_tokens: store.googleTokens ?? null,
    integration_settings: store.integrationSettings ?? null,
  });
  if (error) throw error;
}

export { newId };
