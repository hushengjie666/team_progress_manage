import type { ParsedQuickInput } from "./types";

const parseDateToken = (input: string, baseDate: Date) => {
  const due = new Date(baseDate);
  const hourMatch = input.match(/(?:今天|明天|后天)?\s*(\d{1,2})[点:：](\d{1,2})?/);
  if (input.includes("明天")) due.setDate(due.getDate() + 1);
  if (input.includes("后天")) due.setDate(due.getDate() + 2);
  if (hourMatch) {
    due.setHours(Number(hourMatch[1]), Number(hourMatch[2] ?? 0), 0, 0);
    return due.toISOString();
  }
  if (input.includes("明天") || input.includes("后天") || input.includes("今天")) {
    due.setHours(18, 0, 0, 0);
    return due.toISOString();
  }
  return undefined;
};

export const parseQuickInput = (input: string, baseDate = new Date()): ParsedQuickInput => {
  const tags = Array.from(input.matchAll(/#([\p{L}\p{N}_-]+)/gu)).map((match) => match[1]);
  const estimateMatch = input.match(/(?:^|\s)(\d+)\s*(?:p|P|番茄|个番茄)(?:\s|$)/);
  const projectMatch = input.match(/@([\p{L}\p{N}_-]+)/u);
  const priority = /!{3}|紧急/.test(input) ? "urgent" : /!{2}|高优先/.test(input) ? "high" : undefined;
  const title = input
    .replace(/#([\p{L}\p{N}_-]+)/gu, "")
    .replace(/@([\p{L}\p{N}_-]+)/gu, "")
    .replace(/(?:^|\s)(\d+)\s*(?:p|P|番茄|个番茄)(?:\s|$)/g, " ")
    .replace(/今天|明天|后天|\d{1,2}[点:：]\d{0,2}|!{2,3}|紧急|高优先/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return {
    title: title || input.trim(),
    tags,
    project: projectMatch?.[1],
    estimatePomodoros: estimateMatch ? Math.max(1, Number(estimateMatch[1])) : 1,
    dueAt: parseDateToken(input, baseDate),
    priority,
  };
};
