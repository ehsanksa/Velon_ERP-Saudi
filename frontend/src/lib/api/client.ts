import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  resolveSessionContext,
  saveSession,
  type SessionRole,
} from '../auth/session';
import { API_V1_BASE } from './config';

type ApiError = { message?: string; statusCode?: number; success?: boolean };
type ApiEnvelope<T> = { success: boolean; data?: T; message?: string };

function withSameOriginApiV1(path: string): string {
  return `/api/v1${path}`;
}

function shouldRetryWithSameOrigin(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

async function fetchApi(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (error) {
    // Recover from invalid/external API host DNS issues by retrying same-origin.
    if (!shouldRetryWithSameOrigin(url)) throw error;
    return fetch(withSameOriginApiV1(new URL(url).pathname.replace(/^.*\/v1/, '')), init);
  }
}

function loginRedirectForContext(context: SessionRole): string {
  return context === 'admin' ? '/platform/login' : '/login?tab=signin';
}

function redirectToLogin(context: SessionRole) {
  if (typeof window === 'undefined') return;
  const target = loginRedirectForContext(context);
  if (window.location.pathname + window.location.search !== target) {
    window.location.href = target;
  }
}

async function parseError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as ApiError | { message?: string | string[] };
    if (typeof body.message === 'string') return body.message;
    if (Array.isArray(body.message)) return body.message.join(', ');
  } catch {
    /* ignore */
  }
  if (res.status >= 500) {
    return 'The server could not complete this request. Refresh and try again.';
  }
  return res.statusText || `Request failed (${res.status})`;
}

function unwrapApiResponse<T>(body: unknown): T {
  if (
    body &&
    typeof body === 'object' &&
    'success' in body &&
    (body as ApiEnvelope<T>).success === true
  ) {
    const envelope = body as ApiEnvelope<T>;
    return (envelope.data ?? ({} as T)) as T;
  }
  return body as T;
}

/** Public/auth endpoints must not trigger session refresh/clear on 401. */
export async function authFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetchApi(`${API_V1_BASE}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  });

  if (!res.ok) throw new Error(await parseError(res));
  if (res.status === 204) return undefined as T;
  const body = await res.json();
  return unwrapApiResponse<T>(body);
}

export async function apiFetch<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const context = resolveSessionContext();
  const token = getAccessToken(context);
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetchApi(`${API_V1_BASE}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  });

  if (res.status === 401 && retry) {
    const refreshed = await tryRefresh(context);
    if (refreshed) return apiFetch<T>(path, init, false);
    if (token) {
      clearSession(context);
      redirectToLogin(context);
    }
    throw new Error(await parseError(res));
  }

  if (!res.ok) throw new Error(await parseError(res));
  if (res.status === 204) return undefined as T;
  const body = await res.json();
  return unwrapApiResponse<T>(body);
}

async function tryRefresh(context: SessionRole): Promise<boolean> {
  const refreshToken = getRefreshToken(context);
  if (!refreshToken) return false;
  try {
    const res = await fetchApi(`${API_V1_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return false;
    const body = await res.json();
    const data = unwrapApiResponse<{
      accessToken: string;
      refreshToken: string;
      role?: string;
      email?: string;
      tenantId?: string;
      workspaceId?: string;
    }>(body);
    saveSession({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      route: context,
      email: data.email,
      tenantId: data.tenantId,
      workspaceId: data.workspaceId,
      membershipRole: data.role,
      scope: context === 'admin' ? 'platform' : 'tenant',
    });
    return true;
  } catch {
    return false;
  }
}

export type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  route: 'admin' | 'app';
  role: string;
  email: string;
  scope?: 'platform' | 'tenant';
  tenantId?: string;
  workspaceId?: string;
  membershipId?: string;
};

export type SignUpPayload = {
  companyName: string;
  companyEmail: string;
  companyPhone: string;
  countryCode: string;
  currency: string;
  timezone: string;
  address: string;
  taxId?: string;
  legalNameAr?: string;
  commercialRegistrationNumber?: string;
  vatRegistered?: boolean;
  buildingNumber?: string;
  streetName?: string;
  district?: string;
  city?: string;
  postalCode?: string;
  additionalNumber?: string;
  region?: string;
  industry: string;
  plan: 'STARTER' | 'GROWTH' | 'ENTERPRISE';
  fullName: string;
  password: string;
  verificationToken: string;
};

export function apiLogin(email: string, password: string) {
  return authFetch<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function apiSignUp(payload: SignUpPayload) {
  return authFetch<LoginResponse>('/auth/signup', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function apiRequestSignupOtp(email: string, companyName: string) {
  return authFetch<{ delivered: boolean; devCode?: string }>('/auth/signup/request-otp', {
    method: 'POST',
    body: JSON.stringify({ email, companyName }),
  });
}

export function apiVerifySignupOtp(email: string, code: string) {
  return authFetch<{ verificationToken: string }>('/auth/signup/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ email, code }),
  });
}

export function apiGetWorkspaceContext() {
  return apiFetch<{
    workspace: { id: string; name: string; slug: string; tenantId: string };
    tenant: { id: string; name: string; slug: string; status: string; plan: string };
    companyProfile: {
      legalName: string;
      email: string;
      phone: string;
      country: string;
      industry: string;
    } | null;
    membership: { id: string; role: string };
    user: { id: string; email: string; name: string };
  }>('/workspace/context');
}

export function apiGetTenants() {
  return apiFetch<unknown[]>('/tenants');
}

export function apiGetPlatformSync() {
  return apiFetch<{
    revision: number;
    postgresConnected: boolean;
    updatedAt: string | null;
    events: { at: string; kind: string; summary: string }[];
  }>('/platform/sync');
}

export function apiGetPlatformOverview() {
  return apiFetch<Record<string, unknown>>('/platform/overview');
}
