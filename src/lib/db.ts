import { getJsonStore, newId as newJsonId, saveJsonStore } from "@/lib/db-json";
import { isSupabaseEnabled } from "@/lib/supabase/admin";
import { getSupabaseStore, newId as newSupabaseId, saveSupabaseStore } from "@/lib/supabase/store";
import type { SystemStore } from "@/types/system";

export type { LeaveRequest, Announcement, Project, Sprint, Task, CalendarEvent, SystemStore, WorkSettings } from "@/lib/db-json";

export async function getStore(): Promise<SystemStore> {
  if (isSupabaseEnabled()) {
    return getSupabaseStore();
  }
  return getJsonStore();
}

export async function saveStore(store: SystemStore): Promise<void> {
  if (isSupabaseEnabled()) {
    await saveSupabaseStore(store);
    return;
  }
  await saveJsonStore(store);
}

export function newId(prefix: string): string {
  return isSupabaseEnabled() ? newSupabaseId(prefix) : newJsonId(prefix);
}

export function getDataBackend(): "supabase" | "json" {
  return isSupabaseEnabled() ? "supabase" : "json";
}
