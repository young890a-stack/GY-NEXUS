import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = process.env.CREATIVE_STORAGE_BUCKET || "creative-assets";
const MANAGED_FOLDERS = ["images", "videos", "references"] as const;
const DATE_FOLDER = /^\d{4}-\d{2}-\d{2}$/;

export type ExpiredAsset = {
  path: string;
  size: number;
  createdAt: string | null;
};

export async function findExpiredCreativeAssets(retentionDays: number, limit = 500): Promise<ExpiredAsset[]> {
  const supabase = createAdminClient();
  const cutoff = new Date(Date.now() - retentionDays * 86_400_000);
  const assets: ExpiredAsset[] = [];

  for (const folder of MANAGED_FOLDERS) {
    const { data: dateEntries, error: datesError } = await supabase.storage
      .from(BUCKET)
      .list(folder, { limit: 1000, sortBy: { column: "name", order: "asc" } });
    if (datesError) throw datesError;

    for (const entry of dateEntries ?? []) {
      if (!DATE_FOLDER.test(entry.name)) continue;
      const folderDate = new Date(`${entry.name}T00:00:00.000Z`);
      if (Number.isNaN(folderDate.getTime()) || folderDate >= cutoff) continue;
      const prefix = `${folder}/${entry.name}`;
      const { data: files, error: filesError } = await supabase.storage
        .from(BUCKET)
        .list(prefix, { limit: 1000, sortBy: { column: "name", order: "asc" } });
      if (filesError) throw filesError;

      for (const file of files ?? []) {
        if (!file.id) continue;
        assets.push({
          path: `${prefix}/${file.name}`,
          size: Number(file.metadata?.size ?? 0),
          createdAt: file.created_at ?? null,
        });
        if (assets.length >= limit) return assets;
      }
    }
  }
  return assets;
}

export async function removeCreativeAssets(paths: string[]) {
  if (paths.length === 0) return;
  const supabase = createAdminClient();
  const { error } = await supabase.storage.from(BUCKET).remove(paths);
  if (error) throw error;
}

