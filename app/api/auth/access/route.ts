import { NextResponse } from "next/server";
import { isOwner } from "@/lib/auth/owner";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    return NextResponse.json(
      { authenticated: Boolean(user), owner: isOwner(user) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json(
      { authenticated: false, owner: false },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
