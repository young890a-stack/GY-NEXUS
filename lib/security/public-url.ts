import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

function isPrivateIpv4(value: string) {
  const parts = value.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return true;
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
}

function isPrivateAddress(address: string) {
  if (isIP(address) === 4) return isPrivateIpv4(address);
  const normalized = address.toLowerCase();
  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb") ||
    normalized.startsWith("::ffff:127.") ||
    normalized.startsWith("::ffff:10.") ||
    normalized.startsWith("::ffff:192.168.")
  );
}

export async function assertPublicHttpsUrl(value: string) {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("이미지 URL 형식이 올바르지 않습니다.");
  }

  if (parsed.protocol !== "https:") {
    throw new Error("이미지는 외부에서 접근 가능한 HTTPS URL이어야 합니다.");
  }
  if (!parsed.hostname || parsed.username || parsed.password) {
    throw new Error("안전하지 않은 이미지 URL입니다.");
  }

  const directIp = isIP(parsed.hostname) ? parsed.hostname : null;
  if (directIp && isPrivateAddress(directIp)) {
    throw new Error("내부 네트워크 주소는 이미지로 사용할 수 없습니다.");
  }

  const addresses = await lookup(parsed.hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some((item) => isPrivateAddress(item.address))) {
    throw new Error("공개 인터넷 이미지 주소만 사용할 수 있습니다.");
  }

  return parsed.toString();
}
