import crypto from "node:crypto";
import { decryptConnectionValue, encryptConnectionValue } from "@/lib/connections/secure-cookie";

type Provider = "coupang" | "temu";

type AffiliateVerificationProof = {
  provider: Provider;
  fingerprint: string;
  verifiedAt: number;
  mode: "api" | "share-link";
};

function fingerprint(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, 20);
}

export function createAffiliateProof(provider: Provider, credential: string, mode: AffiliateVerificationProof["mode"]) {
  const proof: AffiliateVerificationProof = {
    provider,
    fingerprint: fingerprint(credential),
    verifiedAt: Date.now(),
    mode,
  };
  return encryptConnectionValue(proof);
}

export function verifyAffiliateProof(
  value: string | undefined,
  provider: Provider,
  credential: string,
  maximumAgeMs = 24 * 60 * 60 * 1000,
) {
  const proof = decryptConnectionValue<AffiliateVerificationProof>(value);
  return Boolean(
    proof &&
      proof.provider === provider &&
      proof.fingerprint === fingerprint(credential) &&
      Number.isFinite(proof.verifiedAt) &&
      Date.now() - proof.verifiedAt >= 0 &&
      Date.now() - proof.verifiedAt <= maximumAgeMs,
  );
}
