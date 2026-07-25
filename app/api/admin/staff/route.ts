import { NextResponse } from "next/server";
import { isStaffRole, type StaffRole } from "@/lib/auth/access";
import { AuthorizationError, requireOwner } from "@/lib/auth/require-owner";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  if (error instanceof AuthorizationError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error("staff management failed", error);
  return NextResponse.json({ error: "직원 권한 정보를 처리하지 못했습니다." }, { status: 500 });
}

export async function GET() {
  try {
    const owner = await requireOwner();
    const supabase = createAdminClient();
    const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (error) throw error;
    return NextResponse.json({
      users: data.users.map((user) => ({
        id: user.id,
        email: user.email ?? "",
        role: user.id === owner.id ? "owner" : (user.app_metadata?.gy_role ?? null),
        createdAt: user.created_at,
        lastSignInAt: user.last_sign_in_at ?? null,
      })),
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const owner = await requireOwner();
    const body = await request.json() as { userId?: string; role?: StaffRole | null };
    if (!body.userId || body.userId === owner.id) {
      return NextResponse.json({ error: "대표 계정의 권한은 변경할 수 없습니다." }, { status: 400 });
    }
    if (body.role !== null && (!isStaffRole(body.role) || body.role === "owner")) {
      return NextResponse.json({ error: "올바른 직원 역할을 선택해주세요." }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: current, error: readError } = await supabase.auth.admin.getUserById(body.userId);
    if (readError || !current.user) throw readError ?? new Error("사용자를 찾을 수 없습니다.");
    const appMetadata = { ...current.user.app_metadata };
    if (body.role) appMetadata.gy_role = body.role;
    else delete appMetadata.gy_role;
    const { error: updateError } = await supabase.auth.admin.updateUserById(body.userId, { app_metadata: appMetadata });
    if (updateError) throw updateError;
    return NextResponse.json({ updated: true, userId: body.userId, role: body.role ?? null });
  } catch (error) {
    return errorResponse(error);
  }
}

