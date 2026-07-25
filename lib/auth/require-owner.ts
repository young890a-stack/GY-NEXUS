import "server-only";
import type { User } from "@supabase/supabase-js";
import { canManageStaff } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";

export class AuthorizationError extends Error {
  constructor(message: string, public readonly status: 401 | 403) {
    super(message);
    this.name = "AuthorizationError";
  }
}

export async function requireOwner(): Promise<User> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new AuthorizationError("로그인이 필요합니다.", 401);
  if (!canManageStaff(user)) {
    throw new AuthorizationError("대표 계정만 사용할 수 있는 기능입니다.", 403);
  }
  return user;
}

