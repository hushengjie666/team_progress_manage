import type { ProjectMemberRole } from "./types";

export type IdFactory = (prefix: string) => string;

export const cleanRoles = (roles: ProjectMemberRole[]): ProjectMemberRole[] =>
  roles.filter((role, index) => roles.indexOf(role) === index);

export const normalizedEmail = (email?: string) => email?.trim().toLowerCase();

export const clampProgressPercent = (value?: number) => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value ?? 0)));
};
