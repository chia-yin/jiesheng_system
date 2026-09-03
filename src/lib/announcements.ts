import { getStore, newId, saveStore } from "@/lib/db";
import type { Announcement } from "@/types/system";

export async function getAnnouncements() {
  const store = await getStore();
  return store.announcements.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

export async function createAnnouncement(input: {
  title: string;
  content: string;
  author: string;
  pinned?: boolean;
}) {
  const store = await getStore();

  const announcement: Announcement = {
    id: newId("ann"),
    title: input.title,
    content: input.content,
    author: input.author,
    pinned: input.pinned ?? false,
    createdAt: new Date().toISOString(),
  };

  store.announcements.unshift(announcement);
  await saveStore(store);

  return announcement;
}
