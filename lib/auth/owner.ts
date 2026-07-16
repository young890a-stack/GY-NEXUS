import type { User } from "@supabase/supabase-js";

export function isOwner(user: User | null) {
  if (!user) return false;
  const configuredOwner = process.env.OWNER_EMAIL?.trim().toLowerCase();
  if (configuredOwner) return user.email?.toLowerCase() === configuredOwner;
  return user.user_metadata?.role === "admin" || user.app_metadata?.role === "admin";
}
