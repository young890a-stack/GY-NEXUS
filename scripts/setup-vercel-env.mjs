import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

const argv = process.argv.slice(2);
const dryRun = argv.includes("--dry-run");
const productionOnly = argv.includes("--production-only");

function option(name, fallback) {
  const exact = argv.indexOf(`--${name}`);
  if (exact >= 0 && argv[exact + 1] && !argv[exact + 1].startsWith("--")) return argv[exact + 1];
  const inline = argv.find((item) => item.startsWith(`--${name}=`));
  return inline ? inline.slice(name.length + 3) : fallback;
}

const project = option("project", "gy-nexus-zfpq");
const scope = option("scope", "");
const rawSite = option("site", "https://gy-nexus-zfpq.vercel.app");
let siteUrl;

try {
  const parsed = new URL(rawSite);
  if (parsed.protocol !== "https:" || parsed.username || parsed.password) throw new Error();
  parsed.pathname = "";
  parsed.search = "";
  parsed.hash = "";
  siteUrl = parsed.toString().replace(/\/$/, "");
} catch {
  console.error("사이트 주소는 https://로 시작하는 공개 주소여야 합니다.");
  process.exit(1);
}

const targets = productionOnly ? ["production"] : ["production", "preview"];
const managedVariables = {
  NEXT_PUBLIC_SITE_URL: siteUrl,
  OPENAI_MODEL: "gpt-5.6-terra",
  OPENAI_STRATEGY_MODEL: "gpt-5.6-sol",
  OPENAI_MEMBER_MODEL: "gpt-5.6-luna",
  OPENAI_QUALITY_MODEL: "gpt-5.6-sol",
  OPENAI_IMAGE_MODEL: "gpt-image-2",
  RUNWAY_VIDEO_MODEL: "gen4.5",
  CREATIVE_STORAGE_BUCKET: "creative-assets",
  SHORTS_QUALITY_THRESHOLD: "85",
  SHORTS_MAX_IMAGE_RETRIES: "2",
  SEARCH_CONSOLE_REDIRECT_URI: `${siteUrl}/api/search-console/callback`,
};

const requiredSecrets = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "OWNER_EMAIL",
  "CONNECTION_ENCRYPTION_KEY",
  "OPENAI_API_KEY",
];

const optionalConnections = [
  "RUNWAYML_API_SECRET",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GA4_PROPERTY_ID",
  "SEARCH_CONSOLE_SITE_URL",
  "VIDEO_WORKER_URL",
  "VIDEO_WORKER_SECRET",
];

const scopeArgs = scope ? ["--scope", scope] : [];

// npm scripts expose npm_execpath. Running its sibling npx-cli.js through
// Node avoids Windows spawnSync EINVAL errors from the npx.cmd shim and works
// with Korean Windows user paths.
const npmExecPath = process.env.npm_execpath || "";
const bundledNpxCli = npmExecPath ? join(dirname(npmExecPath), "npx-cli.js") : "";
const cliRunner = bundledNpxCli && existsSync(bundledNpxCli)
  ? { command: process.execPath, prefix: [bundledNpxCli] }
  : process.platform === "win32"
    ? { command: process.env.ComSpec || "cmd.exe", prefix: ["/d", "/s", "/c", "npx"] }
    : { command: "npx", prefix: [] };

function runVercel(args, { input, capture = false, allowFailure = false } = {}) {
  const commandArgs = ["--yes", "vercel@latest", ...args, ...scopeArgs];
  if (dryRun) {
    console.log(`[미리보기] npx ${commandArgs.join(" ")}${input ? " < 값(화면에 표시하지 않음)" : ""}`);
    return { stdout: "", stderr: "", status: 0 };
  }

  const result = spawnSync(cliRunner.command, [...cliRunner.prefix, ...commandArgs], {
    cwd: process.cwd(),
    encoding: "utf8",
    input,
    stdio: capture ? ["pipe", "pipe", "pipe"] : [input ? "pipe" : "inherit", "inherit", "inherit"],
  });
  if (result.error) {
    console.error(`Vercel CLI 실행 실패: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0 && !allowFailure) {
    if (capture) process.stderr.write(result.stderr || result.stdout || "");
    process.exit(result.status || 1);
  }
  return result;
}

console.log("\nGY-NEXUS · Vercel 환경변수 자동 설정");
console.log(`운영 프로젝트: ${project}`);
console.log(`사이트 주소: ${siteUrl}`);
console.log(`적용 환경: ${targets.join(", ")}\n`);

if (!dryRun) {
  const login = runVercel(["whoami"], { capture: true, allowFailure: true });
  if (login.status !== 0) {
    console.error("Vercel 인증이 필요합니다. CLI 로그인 또는 VERCEL_TOKEN을 설정한 뒤 다시 시도하세요.");
    process.exit(1);
  }
}

runVercel(["link", "--yes", "--project", project]);

for (const target of targets) {
  console.log(`\n[${target}] 안전한 설정값을 추가·수정합니다.`);
  for (const [name, value] of Object.entries(managedVariables)) {
    process.stdout.write(`- ${name} ... `);
    runVercel(["env", "add", name, target, "--force", "--no-sensitive"], { input: `${value}\n` });
    console.log("완료");
  }
}

if (dryRun) {
  console.log("\n미리보기 완료: Vercel 계정에는 아무것도 변경하지 않았습니다.");
  process.exit(0);
}

let hasMissingRequired = false;
for (const target of targets) {
  const listing = runVercel(["env", "ls", target], { capture: true });
  const output = `${listing.stdout || ""}\n${listing.stderr || ""}`;
  const missingRequired = requiredSecrets.filter((name) => !new RegExp(`(^|\\s)${name}(\\s|$)`, "m").test(output));
  const missingOptional = optionalConnections.filter((name) => !new RegExp(`(^|\\s)${name}(\\s|$)`, "m").test(output));

  if (missingRequired.length) {
    hasMissingRequired = true;
    console.log(`\n[${target}] 직접 추가해야 하는 필수 비밀값:`);
    missingRequired.forEach((name) => console.log(`- ${name}`));
  } else {
    console.log(`\n[${target}] 필수 비밀값 이름이 모두 확인되었습니다.`);
  }
  if (missingOptional.length) {
    console.log(`[${target}] 사용하는 서비스에 따라 확인할 선택값: ${missingOptional.join(", ")}`);
  }
}

console.log("\n환경변수 자동 설정이 끝났습니다.");
console.log("이제 코드를 main에 push하면 새 환경변수로 Vercel이 자동 재배포됩니다.");
if (hasMissingRequired) {
  console.log("위 필수 비밀값은 Vercel Dashboard에서 입력한 뒤 배포하세요. 비밀값을 이 스크립트나 GitHub에 저장하면 안 됩니다.");
}