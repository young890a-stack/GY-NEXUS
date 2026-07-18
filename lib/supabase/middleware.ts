import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isOwner } from "@/lib/auth/owner";

const PUBLIC_API_PATHS = new Set([
  "/api/auth/access",
  "/api/click",
  "/api/customer/inquiries",
]);

function isPublicApi(pathname: string) {
  if (PUBLIC_API_PATHS.has(pathname)) return true;
  return /^\/api\/creative-studio-pro\/projects\/[^/]+\/render-callback$/.test(pathname);
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const pathname = request.nextUrl.pathname;
  const isApiRequest = pathname.startsWith("/api/");
  const isAdminRequest = pathname === "/admin" || pathname.startsWith("/admin/");
  const isMemberRequest = pathname === "/member" || pathname.startsWith("/member/");

  if (isApiRequest && isPublicApi(pathname)) return response;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    if (isApiRequest) {
      return NextResponse.json({ error: "인증 서비스를 사용할 수 없습니다." }, { status: 503 });
    }
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("error", "auth_unavailable");
    return NextResponse.redirect(loginUrl);
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookies) {
        cookies.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();

  if (!user && isApiRequest) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  if (!user && (isAdminRequest || isMemberRequest)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAdminRequest && !isOwner(user)) {
    const memberUrl = request.nextUrl.clone();
    memberUrl.pathname = "/member";
    memberUrl.searchParams.set("error", "owner_only");
    return NextResponse.redirect(memberUrl);
  }

  if (isApiRequest && pathname.startsWith("/api/member/")) {
    return response;
  }

  if (isApiRequest && !isOwner(user)) {
    return NextResponse.json({ error: "대표 계정만 사용할 수 있는 기능입니다." }, { status: 403 });
  }

  return response;
}
