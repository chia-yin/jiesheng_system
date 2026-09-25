import { pushLineMessages } from "@/lib/line";
import { buildSprintTasksCarousel, type SprintDigestTask } from "@/lib/line-messages";
import { formatSprintWeekLabel } from "@/lib/sprint-utils";
import { getActiveCompanySprint, getSprintBoard } from "@/lib/sprints";
import type { TaskStatus } from "@/types/system";

const STATUS_ORDER: Record<TaskStatus, number> = {
  in_progress: 0,
  review: 1,
  todo: 2,
  backlog: 3,
  done: 4,
};

export async function listMyOpenSprintTasks(employeeId: string): Promise<{
  sprintLabel: string;
  tasks: SprintDigestTask[];
} | null> {
  const sprint = await getActiveCompanySprint();
  if (!sprint) return null;

  const board = await getSprintBoard(sprint.id);
  if (!board) return null;

  const tasks = board.tasks
    .filter((t) => t.assigneeId === employeeId && t.status !== "done")
    .sort((a, b) => {
      const oa = STATUS_ORDER[a.status] ?? 99;
      const ob = STATUS_ORDER[b.status] ?? 99;
      if (oa !== ob) return oa - ob;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    })
    .slice(0, 10)
    .map((t) => ({
      id: t.id,
      title: t.title,
      projectName: t.projectName,
      status: t.status,
      dueDate: t.dueDate,
    }));

  if (tasks.length === 0) return null;

  return {
    sprintLabel: formatSprintWeekLabel(sprint.startDate, sprint.endDate),
    tasks,
  };
}

/** 推播該員工本週 Sprint 未完成任務；無任務則略過 */
export async function sendSprintTaskDigest(input: {
  lineUserId: string;
  employeeId: string;
  employeeName: string;
  kind: "in" | "out";
}): Promise<"sent" | "skipped"> {
  const data = await listMyOpenSprintTasks(input.employeeId);
  if (!data) return "skipped";

  await pushLineMessages(
    input.lineUserId,
    buildSprintTasksCarousel({
      employeeName: input.employeeName,
      sprintLabel: data.sprintLabel,
      tasks: data.tasks,
      kind: input.kind,
    })
  );
  return "sent";
}
