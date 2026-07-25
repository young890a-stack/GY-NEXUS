type StructuredJsonRetryOptions<T> = {
  label: string;
  request: (attempt: number) => Promise<string | null | undefined>;
  attempts?: number;
  validate?: (value: T) => boolean;
};

function jsonCandidate(raw: string) {
  const normalized = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  const objectStart = normalized.indexOf("{");
  const objectEnd = normalized.lastIndexOf("}");
  if (objectStart >= 0 && objectEnd > objectStart) {
    return normalized.slice(objectStart, objectEnd + 1);
  }
  const arrayStart = normalized.indexOf("[");
  const arrayEnd = normalized.lastIndexOf("]");
  if (arrayStart >= 0 && arrayEnd > arrayStart) {
    return normalized.slice(arrayStart, arrayEnd + 1);
  }
  return normalized;
}

export function parseStructuredJson<T>(raw: string, label: string) {
  try {
    return JSON.parse(jsonCandidate(raw)) as T;
  } catch {
    throw new Error(`${label} 응답이 전송 중 잘렸습니다.`);
  }
}

export async function withStructuredJsonRetry<T>({
  label,
  request,
  attempts = 2,
  validate,
}: StructuredJsonRetryOptions<T>) {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const raw = (await request(attempt))?.trim();
      if (!raw) throw new Error(`${label} 결과가 비어 있습니다.`);
      const parsed = parseStructuredJson<T>(raw, label);
      if (validate && !validate(parsed)) {
        throw new Error(`${label} 결과에 필요한 항목이 빠졌습니다.`);
      }
      return parsed;
    } catch (error) {
      const providerFailure = classifyOpenAIError(error);
      if (providerFailure && !providerFailure.retryable) throw providerFailure.userError;
      lastError = error;
    }
  }

  const providerFailure = openAIUserError(lastError);
  if (providerFailure) throw providerFailure;
  const detail = lastError instanceof Error ? lastError.message : "알 수 없는 응답 오류";
  throw new Error(`드림 와이가 ${label} 결과를 자동 복구하지 못했습니다. 잠시 후 다시 눌러 주세요. (${detail})`);
}
import { classifyOpenAIError, openAIUserError } from "@/lib/ai/openai-error";
