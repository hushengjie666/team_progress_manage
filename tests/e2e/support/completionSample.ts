import { authenticatedState } from "./authenticatedState";

export function completionSample() {
  const state = authenticatedState();
  const first = state.tasks[0];
  for (const [i, title] of ["整理访谈记录", "核对交付清单"].entries()) {
    const task = { ...first, id: `completion_${i}`, title, sortOrder: first.sortOrder + i + 1 };
    state.tasks.push(task);
    state.dailyPlans[0].committedTaskIds.push(task.id);
  }
  return state;
}
