# SentinelAPI — Project Implementation Plan

This roadmap outlines the systematic development lifecycle of **SentinelAPI (An Intelligent API Security, Threat Detection, Data Integrity, and Self-Healing Framework)**. Each phase builds incrementally upon the previous one.

---

## Phase 1: Workspace and Architecture Setup
- [x] Initialize Git version control repository.
- [x] Scaffold monorepo directory structure (`backend/`, `frontend/`, `docs/`, `docker/`).
- [x] Define root `.gitignore` and comprehensive project `README.md`.
- [x] Document step-by-step roadmap and architectural design in `PROJECT_PLAN.md`.

---

## Phase 2: Backend Foundation & Health Endpoint
- Initialize Node.js TypeScript project under `backend/`.
- Configure `tsconfig.json`, ESLint, and scripts (`dev`, `build`, `start`).
- Establish Express.js application structure with structured routing, middleware chains, and centralized error handling.
- Implement `/api/v1/health` and `/api/v1/system/status` endpoints to verify runtime integrity and environment variables without leaking secrets.

---

## Phase 3: PostgreSQL & Prisma Setup
- Define local PostgreSQL database service configuration within Docker Compose.
- Initialize Prisma ORM within `backend/`.
- Create data models:
  - `User` (credentials, role-based access: Admin, Security Analyst, API Consumer)
  - `ApiKey` (hashed keys, rate limits, status, HMAC secrets)
  - `SecurityIncident` (threat type, severity, request metadata, IP, timestamp, action taken)
  - `AuditLog` (system events, state mutations, configuration changes)
- Run initial Prisma migrations and establish seed scripts for local development.

---

## Phase 4: Authentication & Authorization
- Implement secure user registration and login workflows with strong password hashing (bcrypt/Argon2).
- Issue and verify standard JSON Web Tokens (JWT) with refresh token rotation.
- Create role-based access control (RBAC) middleware to protect administrative and analyst endpoints.
- Provide secure API Key issuance and validation middleware for external API consumers.

---

## Phase 5: API Threat Detection Rules Engine
- Construct a modular, pipeline-based request inspection engine in pure TypeScript.
- Implement deterministic rule evaluators:
  - **SQL Injection (SQLi) Detector:** Inspects query params, headers, and request body for dangerous SQL syntax patterns and tautologies.
  - **Cross-Site Scripting (XSS) Detector:** Identifies executable script injections, polyglots, and malicious HTML encodings.
  - **Path Traversal & Command Injection:** Detects directory traversal sequences (`../`, etc.) and system command injection markers.
  - **Rate & Volume Anomaly Detector:** Sliding window rate limiting per API key and per IP address.
  - **Payload Size & Structure Validator:** Enforces schema integrity and guards against oversized payload flooding.

---

## Phase 6: HMAC-Based Data Integrity Verification
- Implement cryptographic payload integrity verification using HMAC-SHA256.
- Define request headers specification:
  - `X-Sentinel-Timestamp`: Request timestamp to guard against replay attacks within a configurable drift window (e.g., 300 seconds).
  - `X-Sentinel-Signature`: `HMAC_SHA256(secret, method + path + timestamp + body)`.
- Create Express middleware to automatically verify the signature before delegating to downstream route handlers.

---

## Phase 7: Incident Management & Controlled Response Actions (Self-Healing)
- Record flagged threat attempts into the `SecurityIncident` table with sanitized payloads.
- Implement progressive mitigation and self-healing actions:
  - **Alert & Log:** For low-severity anomalies without terminating request.
  - **Reject & Throttle:** HTTP 400/403/429 response for confirmed violations.
  - **Temporary IP / API Key Quarantine:** Automated temporary revocation or cool-down period for repeated high-severity offenders.
  - **Analyst Remediation:** Administrative manual override endpoints to unblock quarantined IPs or keys.

---

## Phase 8: Frontend Security Dashboard
- Initialize Next.js (App Router) project with React, TypeScript, and Tailwind CSS under `frontend/`.
- Build an analytics dashboard interface:
  - **Real-Time Threat Overview:** KPI cards showing total blocked requests, active incidents, and average latency.
  - **Incident Log Feed:** Searchable, filterable list of security violations with severity badges and inspection details.
  - **API Key & User Management:** Interface to generate keys, toggle permissions, and revoke compromised credentials.
  - **Quarantine Manager:** View and release quarantined IPs or rate-limited callers.

---

## Phase 9: Backend / Frontend Integration
- Integrate frontend client with backend API endpoints using typed fetch/Axios clients.
- Handle authentication state (JWT storage, session expiration, protected dashboard routes).
- Add live or polling updates for newly detected threats.
- Test error boundaries, feedback toasts, and loading states across the UI.

---

## Phase 10: Docker Compose & NGINX Production Prototype
- Create production-ready `Dockerfile` for `backend` and `frontend`.
- Formulate a cohesive `docker-compose.yml` orchestrating:
  - `backend` service
  - `frontend` service
  - `postgres` database container
- Introduce an NGINX reverse proxy service under `docker/nginx/` handling unified port routing, SSL/TLS termination staging, and standard security headers (CSP, HSTS, X-Frame-Options).

---

## Phase 11: Testing, Documentation & Final-Year Demonstration
- Write automated tests:
  - Unit tests for threat detection rules and HMAC validators.
  - Integration tests for authentication and incident recording flows.
- Create demonstration scripts to simulate live attacks (SQLi, XSS, replay attacks, rate flooding) and verify automated detection and dashboard alerts.
- Finalize project report, architecture diagrams, API specification (OpenAPI/Swagger), and slide deck for academic evaluation.
