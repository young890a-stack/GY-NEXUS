export type EnvItem = {
  key: string;
  label: string;
  group: "core" | "ai" | "publish" | "creative" | "optional";
  required: boolean;
  configured: boolean;
};

const exists = (key: string) => Boolean(process.env[key]?.trim());
const existsAny = (...keys: string[]) => keys.some(exists);

export function getEnvironmentStatus(): EnvItem[] {
  return [
    { key: "NEXT_PUBLIC_SUPABASE_URL", label: "Supabase URL", group: "core", required: true, configured: exists("NEXT_PUBLIC_SUPABASE_URL") },
    { key: "NEXT_PUBLIC_SUPABASE_ANON_KEY", label: "Supabase Anon Key", group: "core", required: true, configured: exists("NEXT_PUBLIC_SUPABASE_ANON_KEY") },
    { key: "OWNER_EMAIL", label: "Owner Email", group: "core", required: true, configured: exists("OWNER_EMAIL") },
    { key: "SUPABASE_SERVICE_ROLE_KEY", label: "Supabase Service Role", group: "core", required: true, configured: existsAny("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY") },
    { key: "OPENAI_API_KEY", label: "OpenAI API", group: "ai", required: false, configured: exists("OPENAI_API_KEY") },
    { key: "GEMINI_API_KEY", label: "Gemini 독립 검토", group: "ai", required: false, configured: existsAny("GEMINI_API_KEY", "GOOGLE_AI_API_KEY") },
    { key: "YOUTUBE_CLIENT_ID", label: "YouTube OAuth Client", group: "publish", required: false, configured: exists("YOUTUBE_CLIENT_ID") },
    { key: "YOUTUBE_CLIENT_SECRET", label: "YouTube OAuth Secret", group: "publish", required: false, configured: exists("YOUTUBE_CLIENT_SECRET") },
    { key: "BLOGGER_BLOG_ID", label: "Blogger Blog ID", group: "publish", required: false, configured: exists("BLOGGER_BLOG_ID") },
    { key: "RUNWAYML_API_SECRET", label: "Runway Video", group: "creative", required: false, configured: exists("RUNWAYML_API_SECRET") },
    { key: "CREATIVE_STORAGE_BUCKET", label: "Creative Storage", group: "creative", required: false, configured: exists("CREATIVE_STORAGE_BUCKET") },
    { key: "COUPANG_ACCESS_KEY", label: "Coupang Partners", group: "optional", required: false, configured: exists("COUPANG_ACCESS_KEY") },
    { key: "TEMU_APP_KEY", label: "Temu Affiliate", group: "optional", required: false, configured: exists("TEMU_APP_KEY") },
  ];
}

export function getReadinessSummary() {
  const items = getEnvironmentStatus();
  const required = items.filter((item) => item.required);
  const configured = items.filter((item) => item.configured);
  return {
    ready: required.every((item) => item.configured),
    configuredCount: configured.length,
    totalCount: items.length,
    requiredMissing: required.filter((item) => !item.configured).map((item) => item.key),
  };
}
