type UnknownRecord = Record<string, unknown>;

export type OpenAIErrorKind =
  | "quota"
  | "rate_limit"
  | "authentication"
  | "permission"
  | "bad_request"
  | "temporary";

export class DreamYAiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly retryable: boolean;

  constructor(message: string, options: { code: string; status: number; retryable: boolean }) {
    super(message);
    this.name = "DreamYAiError";
    this.code = options.code;
    this.status = options.status;
    this.retryable = options.retryable;
  }
}

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" ? value as UnknownRecord : {};
}

function errorDetails(error: unknown) {
  const outer = record(error);
  const inner = record(outer.error);
  const message = error instanceof Error
    ? error.message
    : typeof outer.message === "string"
      ? outer.message
      : String(error || "");
  const status = typeof outer.status === "number"
    ? outer.status
    : typeof outer.statusCode === "number"
      ? outer.statusCode
      : 0;
  const code = [outer.code, inner.code, outer.type, inner.type]
    .find((value) => typeof value === "string");
  return { message, status, code: typeof code === "string" ? code.toLowerCase() : "" };
}

export function classifyOpenAIError(error: unknown): {
  kind: OpenAIErrorKind;
  retryable: boolean;
  userError: DreamYAiError;
} | null {
  if (error instanceof DreamYAiError) {
    return {
      kind: error.code as OpenAIErrorKind,
      retryable: error.retryable,
      userError: error,
    };
  }

  const { message, status, code } = errorDetails(error);
  const normalized = message.toLowerCase();
  const isQuota =
    code === "insufficient_quota"
    || normalized.includes("exceeded your current quota")
    || normalized.includes("check your plan and billing")
    || normalized.includes("billing hard limit")
    || normalized.includes("monthly spend");

  if (isQuota) {
    return {
      kind: "quota",
      retryable: false,
      userError: new DreamYAiError(
        "OpenAI API 사용 한도(크레딧)가 소진되어 AI 제작을 시작할 수 없습니다. OpenAI Platform의 결제·사용 한도를 확인한 뒤 다시 실행해 주세요. 입력한 내용과 저장된 프로젝트는 그대로 유지됩니다.",
        { code: "quota", status: 429, retryable: false },
      ),
    };
  }

  if (status === 401 || code.includes("invalid_api_key") || normalized.includes("incorrect api key")) {
    return {
      kind: "authentication",
      retryable: false,
      userError: new DreamYAiError(
        "OpenAI API 연결키가 유효하지 않습니다. 관리자 연결 설정에서 API 키를 다시 확인해 주세요.",
        { code: "authentication", status: 401, retryable: false },
      ),
    };
  }

  if (status === 403 || code.includes("permission")) {
    return {
      kind: "permission",
      retryable: false,
      userError: new DreamYAiError(
        "현재 OpenAI 프로젝트에는 이 AI 기능을 사용할 권한이 없습니다. OpenAI 프로젝트와 API 키 권한을 확인해 주세요.",
        { code: "permission", status: 403, retryable: false },
      ),
    };
  }

  if (status === 429 || code.includes("rate_limit") || normalized.includes("rate limit")) {
    return {
      kind: "rate_limit",
      retryable: true,
      userError: new DreamYAiError(
        "OpenAI API 요청이 잠시 몰렸습니다. Dream Y가 자동 재시도했지만 아직 제한 중입니다. 잠시 후 다시 실행해 주세요.",
        { code: "rate_limit", status: 429, retryable: true },
      ),
    };
  }

  if (status >= 500 || /timeout|timed out|connection|network|overloaded/.test(normalized)) {
    return {
      kind: "temporary",
      retryable: true,
      userError: new DreamYAiError(
        "OpenAI API 연결이 일시적으로 불안정합니다. Dream Y가 자동 재시도했지만 복구되지 않았습니다. 잠시 후 다시 실행해 주세요.",
        { code: "temporary", status: status || 503, retryable: true },
      ),
    };
  }

  if (status === 400 || status === 404 || status === 422) {
    return {
      kind: "bad_request",
      retryable: false,
      userError: new DreamYAiError(
        "OpenAI API 요청 설정에 문제가 있어 AI 제작을 시작하지 못했습니다. 관리자에게 모델과 연결 설정 점검이 필요합니다.",
        { code: "bad_request", status, retryable: false },
      ),
    };
  }

  return null;
}

export function openAIUserError(error: unknown) {
  return classifyOpenAIError(error)?.userError ?? null;
}

export function openAIErrorStatus(error: unknown) {
  return error instanceof DreamYAiError ? error.status : 500;
}
