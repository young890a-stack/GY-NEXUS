// lib/growth-commerce/require-owner.ts
//
// growth-commerce API 라우트는 Service Role 로 DB 에 접근하면서
// 소유자 확인을 하지 않고 있었습니다. 저장소가 Public 이라 경로도 공개되어 있어,
// 매출·전환 데이터가 그대로 노출되거나 학습 규칙이 외부에서 덮어써질 수 있었습니다.
//
// 두 가지 통로만 허용합니다.
//   1. 로그인한 사용자의 이메일이 OWNER_EMAIL 과 일치 (대표님이 화면에서 쓰는 경우)
//   2. x-gy-internal-secret 헤더가 GY_INTERNAL_SECRET 과 일치 (크론/백그라운드 작업)
//
// 필요한 환경변수
//   OWNER_EMAIL           이미 사용 중 (쉼표로 여러 개 지정 가능)
//   GY_INTERNAL_SECRET    새로 추가 — 32자 이상 랜덤 문자열. 자동화가 없으면 안 넣어도 됨

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { timingSafeEqual } from "node:crypto";

export type OwnerGuard =
  | { ok: true; via: "owner"; email: string }
  | { ok: true; via: "internal"; email: null }
  | { ok: false; status: 401 | 403 | 500; message: string };

function safeEquals(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, "utf8");
  const bufferB = Buffer.from(b, "utf8");
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

function ownerEmails(): string[] {
  return String(process.env.OWNER_EMAIL || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

export async function requireOwner(request?: Request): Promise<OwnerGuard> {
  // 1) 내부 자동화용 시크릿
  const internalSecret = process.env.GY_INTERNAL_SECRET?.trim();
  if (internalSecret && internalSecret.length >= 16 && request) {
    const provided = request.headers.get("x-gy-internal-secret")?.trim();
    if (provided && safeEquals(provided, internalSecret)) {
      return { ok: true, via: "internal", email: null };
    }
  }

  // 2) 로그인 사용자 확인
  const allowed = ownerEmails();
  if (!allowed.length) {
    // 설정이 비어 있으면 열어두지 않고 막습니다. (안전한 기본값)
    return { ok: false, status: 500, message: "OWNER_EMAIL이 설정되지 않았습니다." };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) {
    return { ok: false, status: 500, message: "Supabase 환경변수가 없습니다." };
  }

  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(url, anonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // 라우트 핸들러에서는 쿠키를 갱신하지 않습니다.
        },
      },
    });

    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      return { ok: false, status: 401, message: "로그인이 필요합니다." };
    }

    const email = data.user.email?.toLowerCase() ?? "";
    if (!email || !allowed.includes(email)) {
      return { ok: false, status: 403, message: "접근 권한이 없습니다." };
    }

    return { ok: true, via: "owner", email };
  } catch {
    return { ok: false, status: 500, message: "인증 확인에 실패했습니다." };
  }
}
