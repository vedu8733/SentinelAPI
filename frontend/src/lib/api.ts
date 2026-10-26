export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

export type UserRole = 'ADMIN' | 'SECURITY_ANALYST' | 'AUDITOR' | 'API_CONSUMER';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  isActive?: boolean;
  lastLoginAt?: string | null;
  createdAt?: string;
}

export interface LoginResponse {
  message: string;
  token: string;
  user: User;
}

export type SeverityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type IncidentStatus =
  | 'DETECTED'
  | 'INVESTIGATING'
  | 'MITIGATED'
  | 'RESOLVED'
  | 'FALSE_POSITIVE';

export type ThreatType =
  | 'SQL_INJECTION'
  | 'XSS'
  | 'PATH_TRAVERSAL'
  | 'RATE_LIMIT_EXCEEDED'
  | 'HMAC_VERIFICATION_FAILED'
  | 'MALFORMED_PAYLOAD'
  | 'UNAUTHORIZED_ACCESS';

export type ActionType =
  | 'IP_BLOCK'
  | 'IP_THROTTLE'
  | 'KEY_REVOCATION'
  | 'NOTIFICATION_SENT'
  | 'MANUAL_OVERRIDE';

export type ActionStatus = 'PENDING' | 'APPLIED' | 'EXPIRED' | 'REVOKED' | 'FAILED';

export interface SecurityEventItem {
  id: string;
  threatType: ThreatType;
  severity: SeverityLevel;
  clientIp: string;
  actionTaken: string;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface SecurityEventDetailItem {
  id: string;
  threatType: ThreatType;
  severity: SeverityLevel;
  actionTaken: string;
  clientIp: string;
  details: {
    path?: string;
    method?: string;
    reason?: string;
    gatewayBlocked?: boolean;
    [key: string]: unknown;
  } | null;
  serviceId: string | null;
  service: ServiceMeta | null;
  incidentId: string | null;
  createdAt: string;
}

export interface SecurityEventsListResponse {
  events: SecurityEventDetailItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ResponseActionItem {
  id: string;
  incidentId: string | null;
  actionType: ActionType;
  target: string;
  status: ActionStatus;
  reason: string;
  appliedAt: string;
  expiresAt: string | null;
}

export interface ServiceMeta {
  id: string;
  name: string;
  slug: string;
}

export interface ApiServiceItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  upstreamUrl: string;
  isActive: boolean;
  totalRequests: number;
  blockedThreats: number;
  openIncidents: number;
  totalIncidents: number;
  createdAt: string;
  updatedAt: string;
}

export interface ServicesListResponse {
  services: ApiServiceItem[];
}

export interface ServiceDetailResponse {
  service: ApiServiceItem;
}

export interface IncidentSummary {
  id: string;
  serviceId?: string | null;
  service?: ServiceMeta | null;
  title: string;
  description: string | null;
  severity: SeverityLevel;
  status: IncidentStatus;
  sourceIp: string | null;
  assignedTo?: {
    id: string;
    fullName: string;
    email: string;
    role: UserRole;
  } | null;
  detectedAt: string;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  eventCount: number;
  responseActionCount: number;
}

export interface IncidentDetail extends IncidentSummary {
  events: SecurityEventItem[];
  responseActions: ResponseActionItem[];
}

export interface IncidentListResponse {
  incidents: IncidentSummary[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface HealthResponse {
  status: string;
  service: string;
  timestamp: string;
}

export interface CustomApiError extends Error {
  status?: number;
  code?: string;
  details?: unknown;
}

/**
 * Universal JSON fetch helper that handles auth headers and unified error parsing.
 */
async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null
): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const url = `${API_BASE_URL}${path}`;

  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      headers
    });
  } catch {
    throw new Error(
      `Cannot connect to SentinelAPI backend at ${API_BASE_URL}. Please ensure the backend server is running.`
    );
  }

  let body: Record<string, unknown> | null = null;
  const text = await res.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text };
    }
  }

  if (!res.ok) {
    const errorDetails = body?.error as { message?: string; code?: string } | undefined;
    const errorMsg =
      errorDetails?.message ||
      (body?.message as string) ||
      `Request failed with status code ${res.status}`;
    const error: CustomApiError = new Error(errorMsg);
    error.status = res.status;
    error.code = errorDetails?.code || 'API_ERROR';
    error.details = body;
    throw error;
  }

  return body as T;
}

export const api = {
  // 1. Health
  checkHealth: async (): Promise<HealthResponse> => {
    return apiRequest<HealthResponse>('/api/health');
  },

  // 2. Authentication
  login: async (email: string, password: string): Promise<LoginResponse> => {
    return apiRequest<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
  },

  logout: async (token: string): Promise<{ message: string }> => {
    return apiRequest<{ message: string }>(
      '/api/auth/logout',
      { method: 'POST' },
      token
    );
  },

  getMe: async (token: string): Promise<{ user: User }> => {
    return apiRequest<{ user: User }>('/api/auth/me', { method: 'GET' }, token);
  },

  // 3. Incidents
  listIncidents: async (
    token: string,
    params?: {
      page?: number;
      limit?: number;
      severity?: string;
      status?: string;
      sourceIp?: string;
      threatType?: string;
      serviceId?: string;
    }
  ): Promise<IncidentListResponse> => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.severity) searchParams.set('severity', params.severity);
    if (params?.status) searchParams.set('status', params.status);
    if (params?.sourceIp) searchParams.set('sourceIp', params.sourceIp);
    if (params?.threatType) searchParams.set('threatType', params.threatType);
    if (params?.serviceId) searchParams.set('serviceId', params.serviceId);

    const query = searchParams.toString();
    return apiRequest<IncidentListResponse>(
      `/api/incidents${query ? `?${query}` : ''}`,
      { method: 'GET' },
      token
    );
  },

  getIncident: async (
    token: string,
    id: string
  ): Promise<{ incident: IncidentDetail }> => {
    return apiRequest<{ incident: IncidentDetail }>(
      `/api/incidents/${id}`,
      { method: 'GET' },
      token
    );
  },

  updateIncidentStatus: async (
    token: string,
    id: string,
    status: IncidentStatus,
    notes?: string
  ): Promise<{ message: string; incident: IncidentSummary }> => {
    return apiRequest<{ message: string; incident: IncidentSummary }>(
      `/api/incidents/${id}/status`,
      {
        method: 'PATCH',
        body: JSON.stringify({ status, notes })
      },
      token
    );
  },

  proposeResponseAction: async (
    token: string,
    id: string,
    actionType: ActionType,
    reason?: string
  ): Promise<{ message: string; responseAction: ResponseActionItem }> => {
    return apiRequest<{ message: string; responseAction: ResponseActionItem }>(
      `/api/incidents/${id}/actions`,
      {
        method: 'POST',
        body: JSON.stringify({ actionType, reason })
      },
      token
    );
  },

  // 4. Integrity
  signPayload: async (
    token: string,
    resourceType: string,
    resourceId: string,
    data: unknown
  ): Promise<{ message: string; record: Record<string, unknown> }> => {
    return apiRequest<{ message: string; record: Record<string, unknown> }>(
      '/api/integrity/sign',
      {
        method: 'POST',
        body: JSON.stringify({ resourceType, resourceId, data })
      },
      token
    );
  },

  verifyPayload: async (
    token: string,
    resourceType: string,
    resourceId: string,
    data: unknown
  ): Promise<{
    isValid: boolean;
    message: string;
    resourceType: string;
    resourceId: string;
    verifiedAt: string;
  }> => {
    return apiRequest<{
      isValid: boolean;
      message: string;
      resourceType: string;
      resourceId: string;
      verifiedAt: string;
    }>(
      '/api/integrity/verify',
      {
        method: 'POST',
        body: JSON.stringify({ resourceType, resourceId, data })
      },
      token
    );
  },

  // 5. Protected ApiServices Telemetry
  listServices: async (token: string): Promise<ServicesListResponse> => {
    return apiRequest<ServicesListResponse>('/api/services', { method: 'GET' }, token);
  },

  getService: async (token: string, identifier: string): Promise<ServiceDetailResponse> => {
    return apiRequest<ServiceDetailResponse>(
      `/api/services/${encodeURIComponent(identifier)}`,
      { method: 'GET' },
      token
    );
  },

  // 6. Real-time Security Events Feed
  listSecurityEvents: async (
    token: string,
    params?: {
      page?: number;
      limit?: number;
      serviceId?: string;
      threatType?: string;
      actionTaken?: string;
    }
  ): Promise<SecurityEventsListResponse> => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.serviceId) searchParams.set('serviceId', params.serviceId);
    if (params?.threatType) searchParams.set('threatType', params.threatType);
    if (params?.actionTaken) searchParams.set('actionTaken', params.actionTaken);

    const query = searchParams.toString();
    return apiRequest<SecurityEventsListResponse>(
      `/api/events${query ? `?${query}` : ''}`,
      { method: 'GET' },
      token
    );
  }
};
