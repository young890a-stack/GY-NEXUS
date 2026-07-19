import crypto from "node:crypto";

function getKey(): Buffer {
  const explicit = process.env.CONNECTION_ENCRYPTION_KEY?.trim();
  if (explicit) return crypto.createHash("sha256").update(explicit).digest();
  const fallback = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!fallback) {
    throw new Error("연동 토큰 암호화에 필요한 서버 비밀키가 없습니다.");
  }
  return crypto.createHash("sha256").update(`GY-NEXUS-CONNECTION-V1:${fallback}`).digest();
}

export function connectionEncryptionReady() {
  return Boolean(
    process.env.CONNECTION_ENCRYPTION_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  );
}

export function encryptConnectionValue(value: unknown): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const plaintext = Buffer.from(JSON.stringify(value), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

export function decryptConnectionValue<T>(value: string | undefined): T | null {
  if (!value) return null;
  try {
    const packed = Buffer.from(value, "base64url");
    const iv = packed.subarray(0, 12);
    const tag = packed.subarray(12, 28);
    const encrypted = packed.subarray(28);
    const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]).toString("utf8");
    return JSON.parse(plaintext) as T;
  } catch {
    return null;
  }
}

export const CONNECTION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 180,
};
