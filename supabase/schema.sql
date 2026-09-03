-- 杰升考勤系統 — 獨立 Supabase Project 專用 schema
-- 請在「新建」的 Supabase Project 執行（勿與其他專案共用）

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- 員工（含 LINE / Supabase Auth 綁定欄位）
-- ---------------------------------------------------------------------------
create table if not exists employees (
  id text primary key,
  name text not null,
  department text not null default '',
  role text not null check (role in ('admin', 'employee')),
  username text not null unique,
  password text not null default '',
  line_user_id text unique,
  email text unique,
  google_id text unique,
  supabase_user_id uuid unique,
  line_bind_code text,
  line_bind_expires_at timestamptz
);

create index if not exists idx_employees_line_user on employees(line_user_id);

-- ---------------------------------------------------------------------------
-- 打卡紀錄
-- ---------------------------------------------------------------------------
create table if not exists attendance_records (
  id text primary key,
  employee_id text not null references employees(id) on delete cascade,
  employee_name text not null,
  type text not null check (type in ('in', 'out')),
  timestamp timestamptz not null,
  note text,
  late_minutes int default 0,
  early_leave_minutes int default 0
);

create index if not exists idx_records_employee_ts on attendance_records(employee_id, timestamp desc);

-- ---------------------------------------------------------------------------
-- 請假
-- ---------------------------------------------------------------------------
create table if not exists leave_requests (
  id text primary key,
  employee_id text not null references employees(id) on delete cascade,
  employee_name text not null,
  type text not null,
  start_date date not null,
  end_date date not null,
  days numeric(4,1) not null default 1,
  reason text not null default '',
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  google_event_id text,
  reject_reason text,
  reviewed_at timestamptz,
  reviewed_by text
);

-- ---------------------------------------------------------------------------
-- 公告
-- ---------------------------------------------------------------------------
create table if not exists announcements (
  id text primary key,
  title text not null,
  content text not null default '',
  author text not null default '',
  pinned boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 專案 / Sprint / 任務
-- ---------------------------------------------------------------------------
create table if not exists projects (
  id text primary key,
  name text not null,
  description text,
  paths jsonb default '[]'::jsonb,
  status text not null default 'planning',
  manager_id text references employees(id) on delete set null,
  manager_name text,
  member_ids text[] default '{}',
  start_date date,
  end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sprints (
  id text primary key,
  project_id text references projects(id) on delete cascade,
  name text not null,
  goal text,
  status text not null default 'planning',
  start_date date not null,
  end_date date not null,
  created_at timestamptz not null default now()
);

create table if not exists tasks (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  sprint_id text references sprints(id) on delete set null,
  title text not null,
  description text,
  status text not null default 'backlog',
  priority text not null default 'medium',
  assignee_id text references employees(id) on delete set null,
  assignee_name text,
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 行事曆事件
-- ---------------------------------------------------------------------------
create table if not exists calendar_events (
  id text primary key,
  title text not null,
  type text not null default 'meeting',
  start_date date not null,
  end_date date,
  start_time text,
  end_time text,
  employee_id text references employees(id) on delete set null,
  project_id text references projects(id) on delete set null,
  leave_id text,
  description text,
  google_event_id text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 全域設定（工時、Google OAuth tokens）
-- ---------------------------------------------------------------------------
create table if not exists app_settings (
  id text primary key default 'default',
  work_settings jsonb not null default '{"startTime":"09:00","endTime":"18:00","breakMinutes":60,"flexBeforeMinutes":60,"flexAfterMinutes":60}'::jsonb,
  google_tokens jsonb,
  integration_settings jsonb
);

insert into app_settings (id) values ('default') on conflict (id) do nothing;

-- RLS：預設關閉，應用程式以 service role 存取（Netlify server / LINE webhook）
alter table employees enable row level security;
alter table attendance_records enable row level security;
alter table leave_requests enable row level security;
alter table announcements enable row level security;
alter table projects enable row level security;
alter table sprints enable row level security;
alter table tasks enable row level security;
alter table calendar_events enable row level security;
alter table app_settings enable row level security;
