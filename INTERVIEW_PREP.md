# SentinelAPI — Master Technical Interview Preparation Guide

> 💡 **Study Advice**: Before reading this guide, read [PROJECT_FACTS.md](file:///c:/Users/91832/Desktop/Sentinal%20api/PROJECT_FACTS.md) once to ensure all ports, endpoints, and architectural facts are fresh in your mind.

---

## Part A: The 30-Second Elevator Pitch

> *"Tell me about your project."*

**Your Answer:**
> *"SentinelAPI is an intelligent API security gateway and incident monitoring platform built with Node.js, TypeScript, Next.js, and PostgreSQL. It acts as an active reverse proxy in front of backend microservices. I built it to inspect incoming HTTP traffic, block threats like SQL injection and path traversal before they reach upstream applications, enforce sliding-window rate limits, and cryptographically verify data integrity using HMAC-SHA256. To demonstrate its capabilities under real-world conditions, I also built and protected **NexaCart**, a full-stack e-commerce demo application where all customer traffic is transparently filtered and monitored in real time."*

---

## Part B: The 1-Minute Pitch

> *"Can you give me a more detailed overview of what you built and why?"*

**Your Answer:**
> *"In modern web architectures, small development teams frequently struggle to protect APIs without cluttering business logic with repetitive security code or drowning in unorganized security alerts. 
> 
> I built **SentinelAPI** to solve this. It operates as an inline reverse proxy between client browsers and upstream microservices. Incoming requests pass through deterministic threat detection rules, sliding-window rate limiters, and URL sanitizers. If an attack like SQL injection or directory traversal is detected, the gateway immediately terminates the request with an HTTP 400 Bad Request, so the malicious payload never touches the upstream backend.
> 
> Beyond active blocking, SentinelAPI has an automated incident aggregation engine. Instead of generating hundreds of disconnected alert emails, it uses a 15-minute sliding window with concurrency locking to group events by source IP and escalate case severity. It also features a cryptographic data integrity engine that uses HMAC-SHA256 and deterministic JSON canonicalization to detect payload tampering.
> 
> To demonstrate it in practice, I integrated it with **NexaCart**, a complete e-commerce platform. When a shopper browses products, traffic flows smoothly; when an attacker sends an exploit, SentinelAPI drops it and immediately updates the analyst dashboard."*

---

## Part C: The 3-Minute Project Walkthrough (Speaking Script)

*(Practice speaking this out loud so it feels natural and confident)*

> *"The motivation behind SentinelAPI came from studying real-world application security breaches. Many web vulnerabilities—like SQL injection, path traversal, and parameter tampering—happen because developers either forget input validation or rely solely on database-level defenses. I wanted to design an architectural solution that decouples security enforcement from application development.
> 
> The system has three main layers:
> First, the **Reverse-Proxy Security Gateway**, implemented in Node.js and Express on port 4000. It intercepts all client traffic. When a client makes a request—say, fetching products for an online store—the gateway inspects the path, query parameters, and JSON body against deterministic threat patterns. It also enforces a dedicated rate limiter of 120 requests per minute. If a request is malicious, it is dropped immediately with an HTTP 400 Bad Request and an explicit error code. Clean requests are sanitized, stripped of internal authorization tokens, and forwarded to the upstream server.
> 
> Second, the **Incident Aggregation and Integrity Engine**. When a threat is blocked, the gateway records a `SecurityEvent` in PostgreSQL. Rather than leaving individual alerts unmanaged, my `IncidentService` uses a sliding 15-minute aggregation window to group related attacks from the same IP into a single `Incident`. If an attacker starts with a low-severity scan and then attempts a critical SQL injection, the incident automatically escalates to CRITICAL severity. To handle high-concurrency bursts safely without race conditions, I built an in-memory `KeyedAsyncLock` that serializes incident processing per IP. I also engineered an HMAC-SHA256 integrity system that uses canonical JSON serialization and constant-time comparison to protect sensitive payloads against tampering.
> 
> Third, the **Security Analyst Console**, built in Next.js 16 and React 19 on port 3000. It gives analysts live threat streams, filterable audit tables, KPI metrics, and an interactive investigation drawer where incidents can be transitioned through a strict lifecycle—from DETECTED to INVESTIGATING, MITIGATED, and RESOLVED.
> 
> To prove the platform works, I built **NexaCart**, a full-stack demo e-commerce store running on port 3001 with its own backend on port 5001. In live demos, I send normal customer traffic through the gateway seamlessly, and then run PowerShell scripts with SQL injection and traversal payloads to demonstrate immediate gateway blocking and real-time dashboard updates.
> 
> The hardest technical challenge was preventing concurrency race conditions when multiple threat requests arrived from the same IP simultaneously. I solved this by implementing an asynchronous keyed mutex lock. Through this project, I gained deep, hands-on experience in API gateway architecture, defensive programming, cryptographic hashing, and distributed service isolation."*

---

## Part D: Explain the Project from Scratch (14 Step-by-Step Concepts)

### 1. What problem are we solving?
Web applications are constantly targeted by injection attacks, credential stuffers, and parameter tampering. Developers often scatter security checks across every endpoint, leading to bugs, inconsistent rules, and severe alert fatigue when hundreds of logs flood their databases.

### 2. What is SentinelAPI?
SentinelAPI is an architectural solution: an **intelligent security gateway and management platform**. It sits in front of backend microservices, acting as a security proxy that inspects requests, blocks attacks in-flight, rate-limits abuse, checks payload integrity, and groups events into trackable incidents.

### 3. What is NexaCart, and why do we need it?
NexaCart is a demo e-commerce store (selling tech accessories like mechanical keyboards and headphones). We need it because a security gateway cannot be demonstrated in isolation; having an active, separate business application proves that SentinelAPI works transparently on real-world traffic without altering the upstream codebase.

### 4. What happens when a user opens NexaCart?
The user’s browser loads `http://localhost:3001`. When the storefront fetches products, it does **not** call port 5001 directly. It sends an HTTP request to `http://127.0.0.1:4000/api/gateway/nexacart/api/products`.

### 5. How does the gateway intercept and process a request?
In `backend/src/routes/gateway.route.ts`:
1. It applies the rate limiter (120 req/min).
2. It assigns a unique `X-Request-Id` UUID.
3. It passes the request to `GatewayService.inspectAndFilterRequest()`.
4. If clean, it scrubs internal headers, appends `X-Forwarded-For`, and uses Node.js `http.request` to proxy the request to `http://127.0.0.1:5001/api/products`.
5. It streams the upstream response back to the client.

### 6. How does the system identify suspicious activity?
In `GatewayService.evaluateGatewayThreat()`:
- It safely decodes the URL (up to 2 passes to stop double-encoding tricks).
- It runs deterministic regular expressions against the path, query, and sanitized body.
- Patterns include: union selects, `' OR 1=1`, stacked queries (`; DROP TABLE`), and directory traversal sequences (`../`, `%2e%2e/`).

### 7. What happens after a threat is detected?
1. The gateway returns **HTTP 400 Bad Request** with `{ error: { code: 'THREAT_BLOCKED' } }`.
2. The connection is closed. **The request is NEVER forwarded to the upstream server.**
3. A `SecurityEvent` record is persisted to PostgreSQL with `actionTaken = 'BLOCKED'`.
4. An `ApiRequestLog` is created for audit tracking.
5. The event is dispatched to `IncidentService.processSecurityEvent()`.

### 8. What is the difference between a SecurityEvent and an Incident?
- **SecurityEvent**: An atomic, point-in-time observation (e.g., "Client 127.0.0.1 sent an SQL injection payload at 12:45:01 PM").
- **Incident**: A higher-level case file that aggregates multiple security events from the same source IP over a 15-minute window to avoid alert spam.

### 9. How does the Monitoring dashboard obtain and display information?
The Next.js frontend (`localhost:3000`) queries `/api/events` and `/api/incidents` using a JWT-authenticated API client. The dashboard displays KPI metric cards, a live threat stream with color-coded badges (`BLOCKED`, `THROTTLED`, `FLAGGED`), and pagination controls.

### 10. What does HMAC integrity verification do?
It proves that a sensitive JSON payload (e.g., an order with price and shipping address) has not been tampered with. It hashes the canonicalized JSON with a private secret key using HMAC-SHA256. If a client tampers with even one digit of the price, verification fails in constant time via `crypto.timingSafeEqual`, generating a CRITICAL security event.

### 11. Why are two separate databases used?
SentinelAPI uses `sentinelapi_db` on port 5433; NexaCart uses `nexacart_db` on port 5434. This enforces **least privilege and service isolation**. A compromise of the demo store cannot leak security audit logs or administrative credentials, and the security platform has no direct access to store customer data.

### 12. How do the tests demonstrate functionality?
Automated tests in `backend/tests/` verify:
- 10/10 scenarios in authentication (Argon2id hashing, JWT validation, RBAC, session revocation).
- Gateway proxy forwarding and rejection of SQLi and traversal payloads.
- Incident grouping, severity escalation, and lifecycle transitions.
- HMAC signature generation, canonicalization, and timing-safe tamper detection.

### 13. What are the current limitations?
- Rate limiting is in-memory (resets on server restart, not clustered across multiple Node instances).
- Regex-based pattern matching cannot catch zero-day attacks or heavily obfuscated AST-level SQL syntax.
- Response actions (`IP_BLOCK`) are recorded in the database rather than actively modifying OS-level firewall rules (`iptables`).

### 14. What would I improve next?
1. Back rate limiting with Redis for multi-node horizontal scaling.
2. Integrate AST (Abstract Syntax Tree) SQL parsing.
3. Implement dynamic firewall synchronization (e.g., automated AWS WAF IPSet updates).
4. Introduce distributed tracing using OpenTelemetry.

---

## Part E: 45 Technical Interview Questions & Answers

### Architecture & Gateway Design

#### Q1: Why did you build SentinelAPI as a reverse proxy rather than an Express middleware library that developers install in their apps?
**Answer:** A reverse proxy provides language-agnostic isolation. Upstream microservices do not need to share runtime resources, dependencies, or CPU overhead with the security engine. It also prevents developers from accidentally disabling or misconfiguring security middleware in application code.

#### Q2: What is the difference between a forward proxy and a reverse proxy?
**Answer:** A forward proxy acts on behalf of clients (e.g., an office network proxy that inspects outbound employee web traffic). A reverse proxy acts on behalf of servers (e.g., SentinelAPI, which sits in front of upstream backends to filter and balance inbound client requests).

#### Q3: How do you handle hop-by-hop headers in your proxy implementation?
**Answer:** Hop-by-hop headers (such as `Connection`, `Keep-Alive`, `Transfer-Encoding`, and `Upgrade`) are intended only for a single transport-level connection and must not be forwarded by proxies. In `GatewayService.ts`, I maintain a set of hop-by-hop headers and strip them before proxying to NexaCart.

#### Q4: Why do you strip the `Authorization: Bearer` header before forwarding traffic to NexaCart?
**Answer:** To prevent token leakage. SentinelAPI uses JWTs for administrative and monitoring access. Upstream microservices should never receive internal gateway authentication tokens, maintaining strict privilege boundaries.

#### Q5: What happens if the upstream NexaCart backend goes offline?
**Answer:** In `GatewayService.forwardRequest()`, the proxy client listens for socket errors (like `ECONNREFUSED`). If the upstream is offline, it gracefully returns **HTTP 502 Bad Gateway** with a descriptive JSON error, rather than crashing the gateway process.

#### Q6: How do you handle upstream timeouts?
**Answer:** The proxy request sets a strict 8000ms timeout (`timeout: 8000`). If NexaCart does not respond within 8 seconds, the proxy socket is destroyed and the gateway returns **HTTP 504 Gateway Timeout**.

---

### Threat Detection & Web Security

#### Q7: How does your SQL injection detection work?
**Answer:** `GatewayService.evaluateGatewayThreat()` inspects the request path, decoded query string, and body against regular expressions that detect union selects (`UNION SELECT`), tautologies (`OR 1=1`), stacked query delimiters (`; DROP`), and comment markers (`--`, `/* */`). If a match occurs, the request is blocked immediately with HTTP 400.

#### Q8: Can your regex detection catch all SQL injection attacks?
**Answer:** No, and it is important to be honest about that. Regex detection catches common, automated, and signature-based injection payloads. However, complex whitespace tricks, non-standard dialect keywords, or deep encoding can evade regexes. That is why defense-in-depth is mandatory: upstream services must always use parameterized queries (as NexaCart does with Prisma ORM).

#### Q9: How do you defend against double-encoding attacks in Path Traversal?
**Answer:** Attackers often encode `../` as `%252e%252e%252f`. In `GatewayService.ts`, I implemented `safeDecodeUri()`, which performs up to 2 decode passes in a safe `try/catch` block. This unrolls double-encoded sequences before regex evaluation without throwing exceptions on malformed input.

#### Q10: What is the difference between threat detection and threat prevention?
**Answer:** Threat detection identifies that an attack occurred and records an event or alert. Threat prevention actively halts the execution of the request before it reaches the vulnerable asset. SentinelAPI provides **active prevention** on its gateway route by terminating malicious requests with HTTP 400 before forwarding.

#### Q11: Why does SentinelAPI strip password and token fields before inspecting request bodies?
**Answer:** To prevent sensitive credential exposure in security logs. If an administrator searches security events, they should never see raw user passwords, even if a user accidentally entered SQL injection markers into their password field.

#### Q12: How does SentinelAPI prevent Cross-Site Scripting (XSS)?
**Answer:** SentinelAPI detects script tag patterns at the perimeter, but browser-side XSS defense is handled by modern frontend frameworks. Next.js and React automatically escape variables inside JSX, preventing malicious strings from executing as HTML markup.

---

### Cryptography & Data Integrity

#### Q13: What is the difference between HMAC and encryption?
**Answer:** Encryption (like AES) provides **confidentiality** by transforming plaintext into unreadable ciphertext that can be decrypted. HMAC (Hash-based Message Authentication Code) provides **integrity and authenticity** by generating a fixed-size cryptographic checksum using a shared secret. HMAC does not hide or encrypt the data; it only proves that the data was not modified.

#### Q14: What is JSON canonicalization, and why is it necessary for HMAC?
**Answer:** In JavaScript, `JSON.stringify({ a: 1, b: 2 })` and `JSON.stringify({ b: 2, a: 1 })` produce different strings because object keys have different orders. Since cryptographic hashes are sensitive to every single byte, two logically identical objects would yield completely different HMAC signatures. Canonicalization recursively sorts object keys lexicographically and strips whitespace to guarantee deterministic hashing.

#### Q15: Why is `crypto.timingSafeEqual` used instead of the standard `===` operator when checking HMAC signatures?
**Answer:** The standard `===` operator compares strings byte-by-byte and stops at the very first mismatched character. An attacker can measure microscopic differences in response time (timing attacks) to guess the signature byte-by-byte. `crypto.timingSafeEqual` runs in constant time regardless of where the mismatch occurs, neutralizing side-channel timing attacks.

#### Q16: How do you handle key rotation in your HMAC service?
**Answer:** `IntegrityService` supports a key registry keyed by `keyId` (e.g., `sentinel-hmac-v1`). Multiple keys can be registered concurrently, allowing the system to verify signatures created under an older key while signing new records with the latest active key.

---

### Rate Limiting & Concurrency

#### Q17: What algorithm does your rate limiter use?
**Answer:** It uses an in-memory sliding window counter provided by `express-rate-limit`. It tracks request timestamps within a 60-second window per client IP address.

#### Q18: What are the architectural trade-offs of an in-memory rate limiter?
**Answer:** 
- **Advantage**: Zero external dependencies, extremely fast sub-millisecond lookups, simple local development.
- **Disadvantage**: Memory counters reset if the Node.js process restarts, and counters are not shared across multiple horizontal server instances. In production, it should be backed by Redis.

#### Q19: Why do you have separate rate limiters for the Gateway, native API, and Auth routes?
**Answer:** To prevent route starvation. If the entire server shared a single limit, a burst of customer traffic on the NexaCart storefront could block an administrator from logging into the SentinelAPI monitoring console. I configured:
- Gateway: 120 req/min
- Global API: 100 req/min
- Auth Login: 10 req/min (strict protection against credential stuffing).

#### Q20: What is a race condition in incident aggregation, and how did you solve it?
**Answer:** If an attacker sends 5 simultaneous SQL injection requests in parallel, 5 asynchronous worker threads might check the database at the exact same millisecond, find no existing incident, and create 5 duplicate incidents instead of aggregating into 1. I solved this by building an in-memory `KeyedAsyncLock` that serializes incident processing per `clientIp:threatType`.

---

### Backend, Database & Prisma

#### Q21: Why did you choose PostgreSQL and Prisma ORM?
**Answer:** PostgreSQL provides rock-solid ACID transactions, relational integrity, and native JSON indexing. Prisma provides compile-time type safety, automated migration management, and an intuitive declarative schema that prevents raw SQL injection risks in our own backend.

#### Q22: What is the purpose of database migrations in your project?
**Answer:** Migrations in `backend/prisma/migrations/` track changes to the database schema over time in versioned SQL files. They ensure that all development and test environments can deterministically replicate the exact database structure without manual schema changes.

#### Q23: Why do you store `passwordHash` using Argon2id instead of bcrypt?
**Answer:** Argon2id is the state-of-the-art password hashing algorithm and winner of the Password Hashing Competition. It is designed to be memory-hard, making it significantly more resistant to GPU and ASIC brute-force attacks than bcrypt.

#### Q24: How does session revocation work in your database?
**Answer:** When a user logs in, a `Session` record is stored with a hashed token reference and an expiration time. When the user logs out, the backend updates `revokedAt = new Date()`. Even if the client still holds a cryptographically valid JWT, the `authenticate` middleware checks the database session and rejects revoked sessions with HTTP 401.

#### Q25: What is the purpose of the `AuditLog` table?
**Answer:** It provides non-repudiation. Every critical administrative event—such as user provisioning, incident status transitions, and response action executions—is written to `AuditLog` with the acting user's ID, client IP, action name, and details payload.

---

### Frontend & Dashboard

#### Q26: Why did you use Next.js 16 App Router for the SentinelAPI dashboard?
**Answer:** The App Router provides server-side rendering, layout nesting (`AppShell`), clean routing conventions, and modern React 19 concurrent features. It allows the dashboard to maintain persistent navigation state while updating data views.

#### Q27: How does the dashboard avoid double-counting open incidents?
**Answer:** The dashboard queries `api.listIncidents(token, { page: 1, limit: 1 })`. The backend endpoint returns a total count scoped strictly to active incident statuses (`DETECTED` and `INVESTIGATING`), ensuring resolved and false-positive cases do not inflate the Open Incidents KPI.

#### Q28: How does deep-linking work on the Security Incidents page?
**Answer:** The Incidents page reads the `?id=<uuid>` query parameter from the URL. If an analyst clicks an incident link from the Dashboard or Monitoring page, the Incidents console automatically selects that incident, scrolls it into view, and opens its investigation drawer.

---

## Part F: Important Code Files & Their Responsibilities

| File Path | Responsibility | Key Functions / Classes | When to Mention in Interview |
| :--- | :--- | :--- | :--- |
| `backend/src/services/gatewayService.ts` | Core reverse-proxy forwarder and threat inspector | `evaluateGatewayThreat()`, `inspectAndFilterRequest()`, `forwardRequest()` | Mention when discussing gateway proxying, in-flight blocking, header sanitization, and upstream timeout handling. |
| `backend/src/services/incidentService.ts` | Aggregates events, manages severity escalation, concurrency locks | `IncidentService.processSecurityEvent()`, `KeyedAsyncLock`, `evaluatePolicyResponseAction()` | Mention when explaining how you prevented alert fatigue and handled asynchronous concurrency race conditions. |
| `backend/src/services/integrityService.ts` | Cryptographic data integrity verification | `canonicalizeJson()`, `generateHmacSignature()`, `verifyHmacSignature()` | Mention when asked about cryptography, payload tamper-proofing, JSON canonicalization, or timing attacks. |
| `backend/src/engine/threatDetector.ts` | Evaluates failed logins and payload patterns | `ThreatDetector.recordFailedLogin()`, `recordRateLimitExceeded()`, `shouldEmitEvent()` | Mention when discussing brute force authentication detection and event cooldown mechanisms. |
| `backend/src/middleware/rateLimiter.ts` | Sliding-window rate limit definitions | `globalRateLimiter`, `authRateLimiter`, `nexacartGatewayRateLimiter` | Mention when discussing route starvation prevention, HTTP 429 throttling, and multi-tier rate limiting. |
| `backend/prisma/schema.prisma` | Relational database schema | `User`, `Session`, `ApiService`, `SecurityEvent`, `Incident`, `IntegrityRecord` | Mention when explaining database relationships, enums, indexing, and session management. |
| `frontend/src/app/monitoring/page.tsx` | Real-time security event feed | Dynamic filter dropdowns, event pagination, detail modal | Mention when showing how security analysts investigate raw events in real time. |
| `frontend/src/app/incidents/page.tsx` | Incident investigation console | Status lifecycle transitions, event linking, action drawer | Mention when discussing finite state machines and incident resolution workflows. |

---

## Part G: Architecture Interview Practice

### Likely Architecture Questions:

#### 1. "Why is SentinelAPI a separate server from NexaCart?"
> *"Decoupling the security gateway from the business application provides architectural isolation. If NexaCart crashes due to a memory leak in its shopping cart, SentinelAPI remains online to protect other services. Furthermore, SentinelAPI can sit in front of any application—regardless of whether it's written in Node.js, Python, or Go—without changing a single line of business code."*

#### 2. "What happens if your threat detection regex engine encounters an unexpected error?"
> *"In `gateway.route.ts`, the entire gateway pipeline is wrapped in a `try/catch` block that delegates to Express's centralized error handler. If an internal error occurs, the gateway fails closed with an HTTP 500 error and logs the stack trace, ensuring an uninspected payload is never forwarded to the upstream server."*

#### 3. "How would you scale SentinelAPI to handle 50,000 requests per second?"
> *"To scale horizontally:
> 1. Deploy multiple stateless SentinelAPI gateway containers behind a cloud load balancer (like AWS ALB or Cloudflare).
> 2. Replace the in-memory rate limiter with a distributed Redis cluster using the Token Bucket or Sliding Window Log algorithm.
> 3. Transition event logging to an asynchronous event broker (like Apache Kafka or RabbitMQ) so database write latency doesn't impact gateway forwarding speeds."*

---

## Part H: Real Challenges & Honest Answers

### 1. "What was the hardest technical challenge in this project?"
> *"The hardest challenge was handling concurrency during incident aggregation. When an automated vulnerability scanner hits the gateway, it sends multiple exploit payloads simultaneously. Initially, simultaneous requests would query the database, find no open incident, and create multiple duplicate incidents for the same IP. 
> 
> I solved this by implementing an in-memory asynchronous keyed lock (`KeyedAsyncLock`). It serializes event processing for any specific `clientIp:threatType` combination, ensuring the first request creates the incident and all concurrent requests immediately attach to it."*

### 2. "Tell me about a bug you investigated and fixed."
> *"During our functional audit, I noticed that rate-limit violations on the NexaCart gateway were being recorded with `serviceId = null`, which caused them to disappear when an analyst filtered the monitoring dashboard by 'NexaCart Demo Store'. 
> 
> I investigated the call stack in `rateLimiter.ts` and realized the rate-limit middleware executed before route resolution. I resolved this by passing an asynchronous service resolver to the rate-limiter handler, dynamically fetching the NexaCart service record and linking its UUID to the security event."*

---

## Part I: 1-Page Quick Revision Sheet

- **One-Line Architecture**: Client &rarr; NexaCart UI (`:3001`) &rarr; SentinelAPI Gateway (`:4000`) &rarr; NexaCart Backend (`:5001`) &rarr; NexaCart DB (`:5434`).
- **Tech Stack**: Node.js, Express 5, TypeScript, Next.js 16, React 19, PostgreSQL 17, Prisma 7, Docker.
- **Ports to Remember**:
  - `3000`: SentinelAPI Monitoring Dashboard
  - `4000`: SentinelAPI Security Gateway
  - `3001`: NexaCart E-Commerce Storefront
  - `5001`: NexaCart Catalog API
  - `5433`: SentinelAPI Database
  - `5434`: NexaCart Database
- **Core Security Controls**:
  - SQLi Guard: Drops union selects, tautologies, stacked queries (HTTP 400).
  - Path Traversal Guard: Drops `../` and `%2e%2e/` (HTTP 400).
  - Rate Limiting: 120 req/min on gateway, 10 req/min on login (HTTP 429).
  - HMAC-SHA256: Canonical JSON + timingSafeEqual verification.
- **Status Lifecycle**: `DETECTED` &rarr; `INVESTIGATING` &rarr; `MITIGATED` &rarr; `RESOLVED`.
- **Top 5 Limitations to Mention Honestly**:
  1. In-memory rate limiting (needs Redis for clustering).
  2. Regex-based pattern matching (needs AST SQL parsing for zero-days).
  3. Simulated response actions (records in DB, doesn't reconfigure OS iptables).
  4. Local HTTP development (needs TLS reverse proxy in production).
  5. Single-host architecture.

---

## Part J: Practice Mock Interview (15 Questions & Answer Key)

Test your knowledge by answering these questions without looking at the answer key:

1. What port does the SentinelAPI Security Gateway listen on?
2. What HTTP status code does the gateway return when an SQL injection attempt is blocked?
3. Does NexaCart's frontend communicate directly with its own backend?
4. What is the difference between a `SecurityEvent` and an `Incident` in your database?
5. What algorithm is used to hash user passwords in SentinelAPI?
6. What is the default rate limit on the NexaCart gateway route?
7. What function prevents side-channel timing attacks during HMAC verification?
8. Does HMAC encrypt sensitive data?
9. Why are NexaCart and SentinelAPI placed in separate PostgreSQL databases?
10. What happens if the NexaCart backend is offline when a clean request arrives at the gateway?
11. How does SentinelAPI prevent race conditions when concurrent threats hit the incident aggregator?
12. What does an incident status of `MITIGATED` mean?
13. Why does the gateway strip `Authorization: Bearer` headers before forwarding?
14. What are hop-by-hop headers?
15. What is the difference between threat detection and threat prevention in your project?

---

### Answer Key

1. **Port 4000** (`http://127.0.0.1:4000`).
2. **HTTP 400 Bad Request** with error code `THREAT_BLOCKED`.
3. **No**. NexaCart frontend routes all catalog requests through SentinelAPI on port 4000 (`/api/gateway/nexacart/*`).
4. A `SecurityEvent` is an individual occurrence of a detected attack; an `Incident` aggregates multiple related events from the same source IP over a 15-minute window.
5. **Argon2id** (`@node-rs/argon2`).
6. **120 requests per minute**.
7. **`crypto.timingSafeEqual`**.
8. **No**. HMAC provides data integrity and authenticity, but zero confidentiality; it does not encrypt data.
9. To enforce **service isolation and least privilege**. A compromise of the demo store cannot compromise security audit logs.
10. The gateway catches `ECONNREFUSED` and returns **HTTP 502 Bad Gateway**.
11. Using an in-memory asynchronous mutex lock (**`KeyedAsyncLock`**) keyed by `clientIp:threatType`.
12. The threat has been actively contained (e.g. temporary IP block applied), but final investigation or root-cause closure is still pending.
13. To prevent internal gateway authentication tokens from leaking to upstream application services.
14. Transport-level HTTP headers (like `Connection` and `Transfer-Encoding`) that apply only to an immediate single hop and must not be forwarded by proxies.
15. Threat detection merely logs or flags an anomaly (`actionTaken: 'FLAGGED'`); threat prevention actively stops the payload from reaching the upstream service (`actionTaken: 'BLOCKED'`).
