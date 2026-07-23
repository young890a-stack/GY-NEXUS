export function slugifyProductTitle(title: string) {
  const normalized = title
    .normalize("NFKC")
    .toLowerCase()
    .trim()
    .replace(/[^0-9a-z가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);

  return normalized || "product";
}

export function createProductSlug(title: string, suffix?: string) {
  const safeSuffix = (suffix || crypto.randomUUID().slice(0, 8))
    .toLowerCase()
    .replace(/[^0-9a-z]/g, "")
    .slice(0, 10);

  return `${slugifyProductTitle(title)}-${safeSuffix || crypto.randomUUID().slice(0, 8)}`;
}
