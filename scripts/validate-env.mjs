import fs from "node:fs";
import path from "node:path";

const file = path.resolve(process.cwd(), ".env.local");
if (!fs.existsSync(file)) {
  console.error("[FAIL] .env.local 파일이 없습니다. .env.example을 복사해 생성하세요.");
  process.exit(1);
}
const text = fs.readFileSync(file, "utf8");
const values = Object.fromEntries(text.split(/\r?\n/).filter((line) => line && !line.trim().startsWith("#") && line.includes("=")).map((line) => {
  const i = line.indexOf("="); return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
}));
const required = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "OWNER_EMAIL"];
const missing = required.filter((key) => !values[key]);
if (missing.length) {
  console.error(`[FAIL] 필수 환경변수 누락: ${missing.join(", ")}`);
  process.exit(1);
}
console.log("[PASS] 핵심 환경변수 검증 완료");
const optional = ["OPENAI_API_KEY", "YOUTUBE_CLIENT_ID", "BLOGGER_BLOG_ID", "RUNWAYML_API_SECRET"];
for (const key of optional) console.log(`${values[key] ? "[READY]" : "[OPTIONAL]"} ${key}`);
