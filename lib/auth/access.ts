import type { User } from "@supabase/supabase-js";
import { isOwner } from "@/lib/auth/owner";

export const staffRoles = ["owner", "admin", "editor", "viewer"] as const;
export type StaffRole = (typeof staffRoles)[number];

export function isStaffRole(value: unknown): value is StaffRole {
  return typeof value === "string" && staffRoles.includes(value as StaffRole);
}

export function getStaffRole(user: User | null): StaffRole | null {
  if (!user) return null;
  if (isOwner(user)) return "owner";
  const role = user.app_metadata?.gy_role;
  return isStaffRole(role) && role !== "owner" ? role : null;
}

export function canAccessAdmin(user: User | null) {
  return getStaffRole(user) !== null;
}

export function canManageStaff(user: User | null) {
  return getStaffRole(user) === "owner";
}

export function canManageOperations(user: User | null) {
  const role = getStaffRole(user);
  return role === "owner" || role === "admin";
}

