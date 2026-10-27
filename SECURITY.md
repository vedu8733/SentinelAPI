# SentinelAPI — Application Security & Threat Model Specification

This document details the security posture, threat boundaries, verified controls, detection capabilities, limitations, and hardening guidelines for **SentinelAPI** and its demo-protected application **NexaCart**.

---

## 1. Security Goals & Trust Boundaries

### Security Goals
1. **Perimeter Defense**: Intercept and neutralize common application-layer attack patterns before they reach upstream application logic.
2. **Alert Consolidation & Actionability**: Deduplicate raw security alarms into aggregated, lifecycle-managed security incidents.
3. **Data Integrity Assurance**: Provide cryptographic proof that transactional payloads have not been altered or replayed.
4. **Accountability & Auditing**: Maintain tamper-evident audit logs of all administrative logins, privilege checks, and incident status updates.

### Trust Boundaries & Assumptions
```
[ Untrusted Public Internet ] 
          |
  (HTTP Requests)
          v
==================================== [ TRUST BOUNDARY 1: SentinelAPI Gateway ]
  - Rate Limiting (In-Memory)
  - Threat Regex Inspection
  - Hop-by-Hop & Auth Header Stripping
==================================== [ TRUST BOUNDARY 2: Protected Internal Network ]
          |
  (Clean Forwarded Traffic)
          v
[ Upstream Services (NexaCart Backend) ]
          |
  (SQL Queries via Prisma ORM)
          v
[ Dedicated PostgreSQL Databases ]
```

- **Boundary 1 (External Client to SentinelAPI Gateway)**: All inbound traffic is assumed to be **untrusted**. Clients may send malformed JSON, traversal markers, or injection payloads.
- **Boundary 2 (SentinelAPI Gateway to Upstream NexaCart)**: Traffic passing Boundary 2 is assumed to have been inspected by Boundary 1. However, upstreams **must still use parameterized queries** as defense-in-depth.
- **Boundary 3 (Internal Management)**: Only authenticated users with `ADMIN` or `SECURITY_ANALYST` roles can access administrative endpoints, modify incident statuses, or view raw security event details.

---

## 2. Feature Status & Verification Matrix

The statuses below are strictly based on verified source code and test suite execution in the local repository:

| Capability / Feature | Implementation Status | Verified Evidence |
| :--- | :--- | :--- |
| **SQLi Gateway Blocking** | **Implemented & Verified** | `backend/tests/gateway.test.ts` (returns HTTP 400 `THREAT_BLOCKED`) |
| **Path Traversal Gateway Blocking** | **Implemented & Verified** | `backend/tests/gateway.test.ts` (returns HTTP 400 `THREAT_BLOCKED`) |
| **Gateway Rate Limiting (120 req/m)**| **Implemented & Verified** | `backend/src/middleware/rateLimiter.ts` & `frontend/src/lib/api.test.ts` |
| **Auth Rate Limiting (10 req/m)** | **Implemented & Verified** | `backend/src/middleware/rateLimiter.ts` & `backend/tests/auth.test.ts` |
| **Password Hashing (Argon2id)** | **Implemented & Verified** | `backend/tests/auth.test.ts` (verified `$argon2id$v=19$...` hash format) |
| **Session Invalidation & Revocation**| **Implemented & Verified** | `backend/tests/auth.test.ts` (session revoked upon logout) |
| **Role-Based Access Control (RBAC)**| **Implemented & Verified** | `backend/tests/auth.test.ts` (verified 403 Forbidden on role mismatch) |
| **HMAC-SHA256 Signing & Verification**| **Implemented & Verified** | `backend/tests/integrity.test.ts` (canonical JSON + timingSafeEqual) |
| **Incident Aggregation (15m window)**| **Implemented & Verified** | `backend/tests/incident.test.ts` (aggregates events by IP and threat type) |
| **Incident Severity Escalation** | **Implemented & Verified** | `backend/tests/incident.test.ts` (LOW &rarr; CRITICAL on subsequent threat) |
| **Concurrency Locking during Incident Aggregation**| **Implemented & Verified** | `KeyedAsyncLock` in `backend/src/services/incidentService.ts` |
| **Header Stripping (Bearer & Hop-by-Hop)**| **Implemented & Verified** | `backend/tests/gateway.test.ts` (gateway never forwards internal tokens) |
| **Automated OS/Firewall Synchronization**| **Not Implemented** | Planned future roadmap (currently stores `ResponseAction` in DB) |
| **Centralized Distributed Rate Limiting**| **Not Implemented** | Currently uses in-memory Map; requires Redis for multi-instance |
| **XSS Payload Sanitization on Gateway**| **Partially Implemented** | Detected via enum `ThreatType.XSS`; HTML escaping handled client-side |
| **Database Encryption at Rest** | **Not Applicable** | Handled at storage layer in cloud environments (outside app code) |

---

## 3. Threat Coverage Analysis

### Threats the Current System Can Detect & Block
1. **SQL Injection (SQLi)**:
   - *Mechanisms*: Detects union-based queries, authentication bypass tautologies (`' OR 1=1`), stacked query separators (`; DROP TABLE`), and comment delimiters (`--`, `/* */`).
   - *Action*: **Active Prevention**. Drops the connection with HTTP 400 before forwarding to upstream.
2. **Path Traversal / Directory Browsing**:
   - *Mechanisms*: Detects `../`, `..\`, URL-encoded `%2e%2e/`, and double-encoded traversal sequences across path and query strings.
   - *Action*: **Active Prevention**. Drops the connection with HTTP 400.
3. **High-Frequency Request Flooding (Rate Limit)**:
   - *Mechanisms*: Sliding window counter per client IP.
   - *Action*: **Active Throttling**. Drops excess requests with HTTP 429 and logs `THROTTLED` events.
4. **Brute Force Authentication**:
   - *Mechanisms*: Tracks consecutive failed logins per IP over a 5-minute sliding window (`FAILED_LOGIN_THRESHOLD = 5`).
   - *Action*: Creates `HIGH` severity `UNAUTHORIZED_ACCESS` incident; `/api/auth/login` rate limiter enforces maximum 10 attempts/minute.
5. **Transactional Payload Tampering**:
   - *Mechanisms*: HMAC-SHA256 verification against stored integrity records.
   - *Action*: Flags `HMAC_VERIFICATION_FAILED` event (`CRITICAL`) and logs audit records.

### Threats the Current System Does NOT Fully Cover
1. **Zero-Day or Obfuscated SQL Injection**:
   - Because detection uses regex signatures rather than full SQL syntax tree parsing (AST), advanced database-specific dialect tricks, non-standard comment nesting, or whitespace evasion might bypass simple regex rules.
   - *Mitigation*: Upstream microservices must always use ORMs with parameterized queries (as NexaCart does via Prisma).
2. **Cross-Site Scripting (XSS) Execution**:
   - SentinelAPI flags suspicious patterns in logs, but does not rewrite outbound HTML. Next.js and React protect against DOM-based XSS by default via JSX auto-escaping.
3. **Distributed Denial of Service (DDoS)**:
   - Application-level rate limiters cannot mitigate volumetric network-layer DDoS attacks (SYN floods, UDP amplification). Cloud-level DDoS mitigation (e.g., Cloudflare, AWS Shield) is required.
4. **Server-Side Request Forgery (SSRF) Beyond Upstream**:
   - Gateway forwarding is strictly bound to the configured upstream (`config.nexacartUpstreamUrl`). Loopback loop prevention is implemented, but arbitrary URL proxying is prohibited.

---

## 4. Cryptographic Data Integrity (HMAC-SHA256)

### What HMAC Proves
- **Data Integrity**: Proves that the payload has not been modified by any third party between signing and verification.
- **Message Authenticity**: Proves that the party that generated the signature possesses the shared secret key.
- **Timing-Attack Resilience**: SentinelAPI uses `crypto.timingSafeEqual` to compare signatures in constant time, preventing side-channel byte-timing leaks.

### What HMAC Does NOT Prove (Crucial Interview Concept)
> **HMAC DOES NOT ENCRYPT DATA.**  
> An HMAC signature is a cryptographic hash, not an encryption cipher. The payload data itself is transmitted in plain, readable text (unless wrapped in TLS/HTTPS). HMAC provides **integrity and authenticity**, but **zero confidentiality**.

### Deterministic JSON Canonicalization Rules
Because standard `JSON.stringify()` does not guarantee consistent object property order, SentinelAPI implements strict recursive canonicalization in `backend/src/services/integrityService.ts`:
1. Object keys are sorted lexicographically (Unicode code point order).
2. Whitespace is removed completely.
3. Array element order is strictly preserved.
4. Unsupported types (`undefined`, `bigint`, symbols, functions, circular references) throw an explicit error rather than silently signing inconsistent data.

---

## 5. Secret Management & Authentication Practices

### Secret Isolation
- Local credentials and cryptographic keys are stored exclusively in `.env` files which are strictly excluded from version control via `.gitignore`.
- Version control tracks only `.env.example` templates containing sanitized placeholders (e.g., `your_development_jwt_secret_at_least_32_characters_long_placeholder`).
- The application enforces key separation: `JWT_SECRET` and `HMAC_SECRET` are distinct environment variables and must never share the same key.

### Authentication & Passwords
- Passwords are encrypted using **Argon2id** (`@node-rs/argon2`), the winner of the Password Hashing Competition. Plaintext passwords are never logged, stored, or echoed.
- Admin setup enforces minimum password complexity: at least 12 characters, including uppercase, lowercase, numbers, and symbols.
- JWTs expire after 1 hour (`JWT_EXPIRES_IN=1h`). Database sessions allow immediate revocation upon logout.

---

## 6. Safe Testing & Demonstration Guidelines

1. **Authorization & Scope**:
   - Run security tests **strictly against your local loopback address** (`http://127.0.0.1:4000` or `http://localhost:3000`).
   - Never direct security testing scripts against third-party or production systems without explicit written permission.
2. **Payload Safety**:
   - The test payloads in `DEMO_GUIDE.md` are benign demonstration markers (e.g., `?category=' OR 1=1--` and `..%2f..%2fetc%2fpasswd`).
   - Do not use destructive destructive payloads (`DROP DATABASE`) during presentations.
3. **No Secret Disclosure**:
   - Never display real private keys, API secrets, or database passwords in presentation slides or terminal screen shares.
