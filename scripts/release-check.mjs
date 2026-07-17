import fs from "node:fs";
const required = ["package.json", ".env.example", "app/page.tsx", "app/admin/layout.tsx", "app/api/system/health/route.ts", "supabase/GY-NEXUS-V2.0-FINAL.sql", "docs/INSTALL-AND-OPERATIONS-v2.0-KR.md", "docs/VERCEL-DEPLOY-v2.0-KR.md", "RELEASE-CHECKLIST-v2.0.md"];
const missing = required.filter((file) => !fs.existsSync(file));
if (missing.length) { console.error("[FAIL] 출시 파일 누락:\n" + missing.join("\n")); process.exit(1); }
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
if (pkg.version !== "2.0.0") { console.error(`[FAIL] package version=${pkg.version}`); process.exit(1); }
console.log("[PASS] GY-NEXUS AI COMPANY OS v2.0 출시 구조 검증 완료");
