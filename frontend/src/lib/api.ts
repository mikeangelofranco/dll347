import { RequestTimeoutError, fetchWithTimeout } from "@/lib/request-timeout";

export type ApiHealthResponse = {
  status: "ok";
  project: string;
  communication: "REST API";
  version: string;
  service: string;
};

export type AccountRole = "member" | "secretary" | "three_lights" | "administrator" | "developer";

export type LoginResponse = {
  code: "LOGIN_SUCCESS";
  message: string;
  account: {
    id: number;
    email: string;
    role: AccountRole;
    can_manage_activities: boolean;
    can_edit_members: boolean;
    is_active: boolean;
    is_staff: boolean;
    is_admin: boolean;
    member_profile: MemberDashboardProfile | null;
    last_login: string | null;
    created_at: string;
    updated_at: string;
  };
};

export type MemberDashboardProfile = {
  id: number;
  name: string;
  email: string;
  section: string;
  member_number: string;
  glp_id_number: string;
  lodge_standing: string;
  status: string;
  dues_status: string;
  attendance_this_year: number;
  three_meetings_rule: boolean;
  six_meetings_rule: boolean;
  member_since: string | null;
  profile_photo_url: string | null;
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

export type PreidentifiedEmailRecord = {
  id: number;
  email: string;
  role: AccountRole;
  default_password: string;
  created_at: string;
  updated_at: string;
};

export type SavePreidentifiedEmailResponse = {
  message: string;
  record: PreidentifiedEmailRecord;
};

export type MemberProfilePhotoUploadResponse = {
  message: string;
  member_profile: MemberDashboardProfile;
};

export type MemberSummaryGroup = {
  key: string;
  label: string;
  section: string;
  count: number;
};

export type MemberGroupKey = MemberSummaryGroup["key"];

export type MemberSummaryResponse = {
  groups: MemberSummaryGroup[];
};

export type MemberListItem = {
  id: number;
  name: string;
  glp_id_number: string;
  section: string;
  group_key: string;
  group_label: string;
  status: string;
  dues_status: string;
  profile_photo_url: string | null;
};

export type MemberListResponse = {
  group: MemberGroupKey;
  count: number;
  members: MemberListItem[];
};

export type MemberPositionHeld = {
  id: number;
  title: string;
  date_range: string;
  start_date: string | null;
  end_date: string | null;
  notes: string;
  source: string;
};

export type MemberFullProfile = MemberDashboardProfile & {
  date_of_birth: string | null;
  initiation_date: string | null;
  passing_date: string | null;
  raising_date: string | null;
  proficiency_date: string | null;
  telephone: string;
  address: string;
  appendant_bodies: Record<string, unknown>;
  positions_held: MemberPositionHeld[];
  blood_type: string;
  widow_or_sister: string;
  years_of_membership: number | null;
};

export type MemberEditableProfile = MemberFullProfile & {
  suspension: string;
  restored: string;
  demit: string;
  lml: string;
  dual_plural_honorary_date: string;
  widow_or_sister_date_of_birth: string | null;
  meeting_attendance: Record<string, unknown>;
  monthly_attendance: Record<string, unknown>;
  annual_dues: Record<string, unknown>;
};

export type MemberPositionHeldPayload = {
  title: string;
  date_range: string;
  start_date: string | null;
  end_date: string | null;
  notes: string;
  source: string;
};

export type MemberProfileUpdatePayload = {
  section: string;
  member_number: string;
  name: string;
  glp_id_number: string;
  date_of_birth: string | null;
  initiation_date: string | null;
  passing_date: string | null;
  raising_date: string | null;
  proficiency_date: string | null;
  suspension: string;
  restored: string;
  demit: string;
  lml: string;
  dual_plural_honorary_date: string;
  address: string;
  telephone: string;
  email: string;
  appendant_bodies: Record<string, unknown>;
  blood_type: string;
  widow_or_sister: string;
  widow_or_sister_date_of_birth: string | null;
  meeting_attendance: Record<string, unknown>;
  monthly_attendance: Record<string, unknown>;
  annual_dues: Record<string, unknown>;
  positions_held: MemberPositionHeldPayload[];
};

export type MemberProfileUpdateResponse = {
  message: string;
  member: MemberEditableProfile;
};

export type MemberPositionsHeldResponse = {
  positions: MemberPositionHeld[];
};

export type LodgeActivity = {
  id: number;
  title: string;
  details: string;
  place: string;
  starts_at: string;
  ends_at: string | null;
  status: string;
};

export type LodgeActivityFormPayload = {
  title: string;
  details: string;
  place: string;
  starts_at: string;
  ends_at: string;
  status: "scheduled" | "cancelled" | "completed";
  is_published: boolean;
};

export type NextLodgeActivityResponse = {
  activity: LodgeActivity | null;
};

export type CreateLodgeActivityResponse = {
  message: string;
  activity: LodgeActivity;
};

export type UpcomingLodgeActivitiesResponse = {
  activities: LodgeActivity[];
};

export type ManagedLodgeActivitiesResponse = {
  activities: LodgeActivity[];
};

export type DeleteLodgeActivityResponse = {
  message: string;
};

export type SecretaryDashboardSummaryResponse = {
  year: number;
  overall_percent: number;
  membership: {
    active_count: number;
    total_count: number;
    percent: number;
  };
  growth: {
    progressing_count: number;
    total_count: number;
    percent: number;
  };
  finances: {
    percent: number;
    status: string;
    has_data: boolean;
    report_month: number | null;
    report_year: number | null;
    report_period_label: string | null;
    source_date: string | null;
    cash_accountability: string | null;
    cash_to_date: string | null;
    cash_outflow: string | null;
    remaining_cash: string | null;
    cash_to_date_trend: number | null;
    cash_outflow_trend: number | null;
    net_trend: number | null;
    net_direction: "up" | "down" | "flat";
  };
  attendance: {
    average_count: number;
    total_count: number;
    meeting_count: number;
    percent: number;
  };
  dues_collection: {
    paid_count: number;
    unpaid_count: number;
    total_count: number;
    percent: number;
  };
};

export type LodgeDocumentCategory =
  | "treasurers_report"
  | "minutes_stated_meeting"
  | "minutes_special_meeting"
  | "members_data";

export type TreasurerReportSummary = {
  report_month: number | null;
  report_year: number | null;
  previous_report_date: string | null;
  cash_balance_last_report: string | null;
  cash_received_month: string | null;
  cash_to_date: string | null;
  cash_disbursements: string | null;
  remaining_cash: string | null;
  general_fund: string | null;
  specific_purpose_funds: string | null;
  other_sources: string | null;
  grand_lodge_account: string | null;
  other_account: string | null;
  raw_values: Record<string, string>;
};

export type LodgeDocument = {
  id: number;
  category: LodgeDocumentCategory;
  category_label: string;
  original_filename: string;
  content_type: string;
  size_bytes: number;
  notes: string;
  file_url: string;
  extraction_status: "not_applicable" | "pending_review" | "extracted" | "failed";
  extraction_errors: string[];
  treasurer_summary: TreasurerReportSummary | null;
  created_at: string;
  updated_at: string;
};

export type LodgeDocumentsResponse = {
  documents: LodgeDocument[];
};

export type LodgeDocumentUploadResult = {
  filename: string;
  status: "uploaded" | "rejected";
  document?: LodgeDocument;
  errors: string[];
};

export type LodgeDocumentUploadResponse = {
  message: string;
  results: LodgeDocumentUploadResult[];
};

export type DeleteLodgeDocumentResponse = {
  message: string;
};

export type ApiErrorResponse = {
  code?: string;
  message?: string;
  results?: unknown;
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

  if (Array.isArray(payload.results)) {
    const resultErrors = payload.results.flatMap((result) => {
      if (!result || typeof result !== "object" || !("errors" in result) || !Array.isArray(result.errors)) {
        return [];
      }
      const filename = "filename" in result && typeof result.filename === "string" ? result.filename : "";
      const errors = result.errors as unknown[];
      return errors
        .filter((error): error is string => typeof error === "string" && Boolean(error))
        .map((error) => (filename ? `${filename}: ${error}` : error));
    });
    if (resultErrors.length > 0) {
      return resultErrors.join("\n");
    }
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
  let apiBaseUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000/api";

  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    if (hostname === "127.0.0.1" || hostname === "localhost") {
      apiBaseUrl = "http://127.0.0.1:8000/api";
    }
  }

  return apiBaseUrl.replace(/\/+$/, "");
}

export function getApiEndpoint(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getApiBaseUrl()}${normalizedPath}`;
}

function currentWindowLabel(): string {
  if (typeof window === "undefined") {
    return "";
  }

  return `${window.location.pathname}${window.location.search}`.slice(0, 255);
}

async function parseApiResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  const payload = isJson ? ((await response.json()) as T | ApiErrorResponse) : null;

  if (!response.ok) {
    if (response.status === 413) {
      throw new ApiError(
        413,
        "The upload is too large for one request. Please upload fewer or smaller files.",
        "REQUEST_ENTITY_TOO_LARGE",
      );
    }

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

async function apiFetch<T>(path: string, init: RequestInit, timeoutMs = 15000): Promise<T> {
  let response: Response;
  const headers = new Headers(init.headers);
  const windowLabel = currentWindowLabel();
  if (windowLabel && !headers.has("X-DLL347-Window")) {
    headers.set("X-DLL347-Window", windowLabel);
  }

  try {
    response = await fetchWithTimeout(
      getApiEndpoint(path),
      {
        credentials: "include",
        cache: "no-store",
        ...init,
        headers,
      },
      timeoutMs,
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

export async function apiPost<T>(path: string, body?: unknown, method = "POST"): Promise<T> {
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
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export async function apiPostForm<T>(path: string, body: FormData): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (typeof document !== "undefined") {
    const csrfMatch = document.cookie.match(/(?:^|; )csrftoken=([^;]+)/);
    if (csrfMatch) {
      headers["X-CSRFToken"] = decodeURIComponent(csrfMatch[1]);
    }
  }

  return apiFetch<T>(
    path,
    {
      method: "POST",
      headers,
      body,
    },
    120000,
  );
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

export async function getPreidentifiedEmails(): Promise<PreidentifiedEmailRecord[]> {
  return apiGet<PreidentifiedEmailRecord[]>("/preidentified-emails/");
}

export async function savePreidentifiedEmail(
  email: string,
  password: string,
  role: AccountRole = "member",
): Promise<SavePreidentifiedEmailResponse> {
  await prepareSessionCsrf();
  return apiPost<SavePreidentifiedEmailResponse>("/preidentified-emails/", {
    email,
    password,
    role,
  });
}

export async function uploadMemberProfilePhoto(
  photo: Blob,
): Promise<MemberProfilePhotoUploadResponse> {
  await prepareSessionCsrf();
  const body = new FormData();
  body.append("photo", photo, "profile-photo.jpg");
  return apiPostForm<MemberProfilePhotoUploadResponse>("/members/me/profile-photo/", body);
}

export async function uploadMemberProfilePhotoById(
  memberId: number,
  photo: Blob,
): Promise<MemberProfilePhotoUploadResponse> {
  await prepareSessionCsrf();
  const body = new FormData();
  body.append("photo", photo, "profile-photo.jpg");
  return apiPostForm<MemberProfilePhotoUploadResponse>(`/members/${memberId}/profile-photo/`, body);
}

export async function getMemberSummary(): Promise<MemberSummaryResponse> {
  return apiGet<MemberSummaryResponse>("/members/summary/");
}

export async function getMemberList(
  group: MemberGroupKey,
  search = "",
  duesStatus?: "paid" | "unpaid" | "all",
): Promise<MemberListResponse> {
  const params = new URLSearchParams({ group });
  if (search.trim()) {
    params.set("search", search.trim());
  }
  if (duesStatus) {
    params.set("dues_status", duesStatus);
  }
  return apiGet<MemberListResponse>(`/members/list/?${params.toString()}`);
}

export async function getMyMemberProfile(): Promise<MemberFullProfile> {
  return apiGet<MemberFullProfile>("/members/me/profile/");
}

export async function getMemberProfile(memberId: number): Promise<MemberFullProfile> {
  return apiGet<MemberFullProfile>(`/members/${memberId}/profile/`);
}

export async function getEditableMemberProfile(memberId: number): Promise<MemberEditableProfile> {
  return apiGet<MemberEditableProfile>(`/members/${memberId}/edit/`);
}

export async function updateMemberProfile(
  memberId: number,
  payload: MemberProfileUpdatePayload,
): Promise<MemberProfileUpdateResponse> {
  await prepareSessionCsrf();
  return apiPost<MemberProfileUpdateResponse>(`/members/${memberId}/edit/`, payload, "PATCH");
}

export async function getMyPositionsHeld(): Promise<MemberPositionsHeldResponse> {
  return apiGet<MemberPositionsHeldResponse>("/members/me/positions-held/");
}

export async function getNextLodgeActivity(): Promise<NextLodgeActivityResponse> {
  return apiGet<NextLodgeActivityResponse>("/lodge-activities/next/");
}

export async function getUpcomingLodgeActivities(
  limit = 2,
  excludeId?: number,
): Promise<UpcomingLodgeActivitiesResponse> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (excludeId !== undefined) {
    params.set("exclude_id", String(excludeId));
  }
  return apiGet<UpcomingLodgeActivitiesResponse>(`/lodge-activities/upcoming/?${params.toString()}`);
}

export async function getManagedLodgeActivities(search = ""): Promise<ManagedLodgeActivitiesResponse> {
  const params = new URLSearchParams();
  if (search.trim()) {
    params.set("search", search.trim());
  }
  const query = params.toString();
  return apiGet<ManagedLodgeActivitiesResponse>(`/lodge-activities/manage/${query ? `?${query}` : ""}`);
}

export async function createLodgeActivity(payload: LodgeActivityFormPayload): Promise<CreateLodgeActivityResponse> {
  await prepareSessionCsrf();
  return apiPost<CreateLodgeActivityResponse>("/lodge-activities/", payload);
}

export async function deleteLodgeActivity(activityId: number): Promise<DeleteLodgeActivityResponse> {
  await prepareSessionCsrf();
  return apiPost<DeleteLodgeActivityResponse>(`/lodge-activities/${activityId}/`, undefined, "DELETE");
}

export async function getSecretaryDashboardSummary(): Promise<SecretaryDashboardSummaryResponse> {
  return apiGet<SecretaryDashboardSummaryResponse>("/secretary/dashboard-summary/");
}

export async function getLodgeDocuments(category?: LodgeDocumentCategory): Promise<LodgeDocumentsResponse> {
  const params = new URLSearchParams();
  if (category) {
    params.set("category", category);
  }
  const query = params.toString();
  return apiGet<LodgeDocumentsResponse>(`/documents/${query ? `?${query}` : ""}`);
}

export async function uploadLodgeDocuments(
  category: LodgeDocumentCategory,
  files: File[],
  notes: string,
): Promise<LodgeDocumentUploadResponse> {
  await prepareSessionCsrf();
  const body = new FormData();
  body.append("category", category);
  body.append("notes", notes);
  files.forEach((file) => body.append("files", file));
  return apiPostForm<LodgeDocumentUploadResponse>("/documents/", body);
}

export async function deleteLodgeDocument(documentId: number): Promise<DeleteLodgeDocumentResponse> {
  await prepareSessionCsrf();
  return apiPost<DeleteLodgeDocumentResponse>(`/documents/${documentId}/`, undefined, "DELETE");
}
