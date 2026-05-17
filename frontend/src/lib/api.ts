import { RequestTimeoutError, fetchWithTimeout } from "@/lib/request-timeout";

export type ApiHealthResponse = {
  status: "ok";
  project: string;
  communication: "REST API";
  version: string;
  service: string;
};

export type LoginResponse = {
  code: "LOGIN_SUCCESS";
  message: string;
  account: {
    id: number;
    email: string;
    role: string;
    is_active: boolean;
    is_staff: boolean;
    is_admin: boolean;
    last_login: string | null;
    created_at: string;
    updated_at: string;
  };
};

export type PasswordUpdatedResponse = {
  code: "PASSWORD_UPDATED";
  message: string;
  account: LoginResponse["account"];
};

export type ForgotPasswordResponse = {
  code: "RESET_LINK_REQUESTED";
  message: string;
  reset_url?: string;
};

export type ResetPasswordResponse = {
  code: "PASSWORD_RESET_SUCCESS";
  message: string;
};

export type ResetPasswordTokenValidationResponse = {
  code: "RESET_LINK_VALID";
  message: string;
  email: string;
};

export type CurrentAccountResponse = LoginResponse["account"];

export type LogoutResponse = {
  message: string;
};

export type ApiErrorResponse = {
  code?: string;
  message?: string;
};

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

function extractApiErrorMessage(payload: ApiErrorResponse | Record<string, unknown> | null): string {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  if ("message" in payload && typeof payload.message === "string" && payload.message) {
    return payload.message;
  }

  for (const value of Object.values(payload)) {
    if (typeof value === "string" && value) {
      return value;
    }

    if (Array.isArray(value) && typeof value[0] === "string") {
      return value[0];
    }
  }

  return "";
}

function getApiBaseUrl(): string {
  const apiBaseUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000/api";

  return apiBaseUrl.replace(/\/+$/, "");
}

export function getApiEndpoint(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getApiBaseUrl()}${normalizedPath}`;
}

async function parseApiResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  const payload = isJson ? ((await response.json()) as T | ApiErrorResponse) : null;

  if (!response.ok) {
    const message = extractApiErrorMessage(payload as ApiErrorResponse | Record<string, unknown>) ||
      `API request failed with status ${response.status}`;
    const code =
      payload && typeof payload === "object" && "code" in payload
        ? payload.code
        : undefined;
    throw new ApiError(response.status, message, code);
  }

  if (!isJson) {
    throw new Error("API response was not JSON.");
  }

  return payload as T;
}

async function apiFetch<T>(path: string, init: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetchWithTimeout(
      getApiEndpoint(path),
      {
        credentials: "include",
        cache: "no-store",
        ...init,
      },
      15000,
    );
  } catch (error) {
    if (error instanceof RequestTimeoutError) {
      throw new ApiError(
        504,
        "The server took too long to respond. Please try again.",
        "REQUEST_TIMEOUT",
      );
    }

    throw error;
  }

  return parseApiResponse<T>(response);
}

export async function apiGet<T>(path: string): Promise<T> {
  return apiFetch<T>(path, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (typeof document !== "undefined") {
    const csrfMatch = document.cookie.match(/(?:^|; )csrftoken=([^;]+)/);
    if (csrfMatch) {
      headers["X-CSRFToken"] = decodeURIComponent(csrfMatch[1]);
    }
  }

  return apiFetch<T>(path, {
    method: "POST",
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export async function prepareSessionCsrf(): Promise<void> {
  await apiGet<{ message: string }>("/auth/csrf/");
}

export async function loginWithEmailPassword(
  email: string,
  password: string,
): Promise<LoginResponse> {
  await prepareSessionCsrf();
  return apiPost<LoginResponse>("/auth/login/", { email, password });
}

export async function setupPassword(
  email: string,
  defaultPassword: string,
  newPassword: string,
  confirmPassword: string,
): Promise<PasswordUpdatedResponse> {
  await prepareSessionCsrf();
  return apiPost<PasswordUpdatedResponse>("/auth/setup-password/", {
    email,
    default_password: defaultPassword,
    new_password: newPassword,
    confirm_password: confirmPassword,
  });
}

export async function requestPasswordReset(
  email: string,
): Promise<ForgotPasswordResponse> {
  await prepareSessionCsrf();
  return apiPost<ForgotPasswordResponse>("/auth/forgot-password/", { email });
}

export async function resetPasswordWithToken(
  token: string,
  newPassword: string,
  confirmPassword: string,
): Promise<ResetPasswordResponse> {
  await prepareSessionCsrf();
  return apiPost<ResetPasswordResponse>("/auth/reset-password/", {
    token,
    new_password: newPassword,
    confirm_password: confirmPassword,
  });
}

export async function validateResetPasswordToken(
  token: string,
): Promise<ResetPasswordTokenValidationResponse> {
  return apiGet<ResetPasswordTokenValidationResponse>(
    `/auth/reset-password/validate/?token=${encodeURIComponent(token)}`,
  );
}

export async function getCurrentAccount(): Promise<CurrentAccountResponse> {
  return apiGet<CurrentAccountResponse>("/auth/me/");
}

export async function logoutCurrentSession(): Promise<LogoutResponse> {
  await prepareSessionCsrf();
  return apiPost<LogoutResponse>("/auth/logout/");
}
