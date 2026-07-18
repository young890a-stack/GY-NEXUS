import type { User } from "@supabase/supabase-js";

export function isOwner(user: User | null) {
  if (!user) return false;
  const configuredOwner = process.env.OWNER_EMAIL?.trim().toLowerCase();
  if (!configuredOwner) return false;
  return user.email?.trim().toLowerCase() === configuredOwner;
}
