# SentinelAPI

**An Intelligent API Security Gateway, Threat Detection, Data Integrity, and Incident Monitoring Platform**

SentinelAPI is an active security reverse-proxy and centralized monitoring console designed to safeguard modern RESTful web applications from common application-layer attacks. Built using Node.js, Express, TypeScript, Next.js, and PostgreSQL, SentinelAPI sits in front of upstream business services to inspect inbound HTTP traffic, block malicious request patterns (such as SQL Injection and Path Traversal), enforce rate limits, cryptographically verify data integrity via HMAC-SHA256, and aggregate security events into actionable incident reports.

---

## 1. Problem Statement

Modern microservices and web APIs are frequently targeted by automated web scanners, credential stuffers, and injection attacks. While traditional Web Application Firewalls (WAFs) are effective at cloud boundaries, developers often struggle to:
1. **Gain localized visibility**: Understand exactly which service endpoint was attacked and correlate attack payloads across requests.
2. **Prevent payload tampering**: Guarantee that sensitive transactional payloads have not been altered in transit or at rest.
3. **Trace incident lifecycles**: Consolidate high-volume security alerts into actionable, deduplicated incidents rather than flooding security teams with noise.
4. **Isolate security from business logic**: Protect legacy or third-party web apps without having to rewrite or clutter core application code with repetitive security checks.

SentinelAPI addresses this problem by acting as a lightweight, pluggable gateway that decouples threat detection, rate limiting, and integrity verification from upstream applications.

---

## 2. Project Objectives & Intended Users

### Primary Objectives
- **Active Traffic Filtering**: Inspect and sanitize HTTP paths, parameters, and payloads before they reach upstream microservices.
- **Automated Incident Aggregation**: Correlate individual threat events from the same source IP into single, trackable security incidents with severity escalation.
- **Cryptographic Tamper-Proofing**: Provide an easy-to-use HMAC-SHA256 data signing and verification mechanism with timing-safe comparisons.
- **Full-Stack Visibility**: Deliver an intuitive, modern security analyst dashboard featuring live threat streams, KPI analytics, and audit logging.

### Intended Users
- **Application Security (AppSec) Engineers**: Investigate security incidents, review raw attack vectors, and enforce protective security policies.
- **Backend Developers**: Protect upstream APIs without modifying core application endpoints.
- **Security Auditors**: Verify tamper-evident audit logs and confirm that user sessions and sensitive actions are properly controlled.

---

## 3. SentinelAPI vs. NexaCart: Architectural Separation

A fundamental design principle of this project is the **strict separation of responsibilities**:

```
+-----------------------------------------------------------+
|                   CLIENT BROWSER                          |
+-----------------------------------------------------------+
          |                                       |
          | Browse Storefront                     | Security Admin Console
          v                                       v
+-----------------------+               +-----------------------+
|   NexaCart Frontend   |               | SentinelAPI Frontend  |
| (Port 3001 - Store)   |               | (Port 3000 - Console) |
+-----------------------+               +-----------------------+
          |                                       |
          | HTTP Gateway Requests                 | Management API
          v                                       v
+---------------------------------------------------------------+
|                      SentinelAPI Backend                      |
|                  (Port 4000 - Security Gateway)               |
|                                                               |
|  - Rate Limiter (120 req/min)                                 |
|  - Threat Inspection (SQLi & Path Traversal Regex)            |
|  - HMAC-SHA256 Integrity Engine                               |
|  - Incident Aggregator & Event Logger                         |
+---------------------------------------------------------------+
          | (Clean Traffic Only)                  |
          v                                       v
+-----------------------+               +-----------------------+
|   NexaCart Backend    |               | SentinelAPI Database  |
|  (Port 5001 - API)    |               |  (Port 5433 - Postgres|
+-----------------------+               +-----------------------+
          |
          v
+-----------------------+
|   NexaCart Database   |
| (Port 5434 - Postgres)|
+-----------------------+
```

- **SentinelAPI** (`localhost:3000` & `127.0.0.1:4000`): The security gateway and administration console. It owns threat detection, incident management, HMAC verification, and security audit logs.
- **NexaCart** (`localhost:3001` & `127.0.0.1:5001`): A standalone demo e-commerce storefront and catalog API. NexaCart has **no custom security logic**. Its frontend routes all catalog requests through SentinelAPI's gateway (`http://127.0.0.1:4000/api/gateway/nexacart/*`).
- **Data Isolation**: SentinelAPI and NexaCart maintain separate databases (`sentinelapi_db` on port 5433 and `nexacart_db` on port 5434). SentinelAPI cannot alter NexaCart products directly, and NexaCart cannot access security logs.

---

## 4. Main Features & Implementation Status

| Feature | Description | Implementation Status |
| :--- | :--- | :--- |
| **Reverse-Proxy Gateway** | Routes clean client traffic to upstream services (`/api/gateway/nexacart/*`) | **Implemented & Verified** |
| **SQLi Threat Blocking** | Detects deterministic SQL injection signatures in query/body; blocks with HTTP 400 | **Implemented & Verified** |
| **Path Traversal Blocking** | Identifies `../` and `%2e%2e` directory traversal attempts; blocks with HTTP 400 | **Implemented & Verified** |
| **Gateway Rate Limiting** | Dedicated 120 req/min limit on proxy route; returns HTTP 429 and flags `THROTTLED` event | **Implemented & Verified** |
| **Auth Rate Limiting** | Sensitive 10 req/min threshold on `/api/auth/login` to prevent brute-force attacks | **Implemented & Verified** |
| **HMAC Data Integrity** | Canonicalized JSON signing & timing-safe verification using HMAC-SHA256 | **Implemented & Verified** |
| **Incident Aggregation** | Sliding-window grouping of security events by source IP and threat type | **Implemented & Verified** |
| **Severity Escalation** | Automatically updates incident severity if subsequent events are higher priority | **Implemented & Verified** |
| **Security Analyst UI** | Real-time Dashboard, Event Stream, Incident Console, and HMAC Tester | **Implemented & Verified** |
| **Role-Based Access** | Enforces `ADMIN`, `SECURITY_ANALYST`, `API_CONSUMER`, and `AUDITOR` permissions | **Implemented & Verified** |
| **Automated OS Firewall Sync** | Dynamically modifying iptables/AWS security groups for blocked IPs | *Planned Future Enhancement* |

---

## 5. Technology Stack

### Backend & Gateway
- **Runtime**: Node.js v20+ with TypeScript (`tsx` execution engine)
- **Framework**: Express.js (v5.3 on SentinelAPI, v4.21 on NexaCart)
- **Database & ORM**: PostgreSQL 17 (Alpine) with Prisma ORM 7.10
- **Authentication**: JWT (`jsonwebtoken`) with Argon2id password hashing (`@node-rs/argon2`)
- **Cryptography**: Native Node.js `crypto` (`createHmac`, `timingSafeEqual`)
- **Rate Limiting**: `express-rate-limit` (In-memory sliding window)

### Frontend
- **Framework**: Next.js 16 (App Router) & React 19
- **Styling**: Tailwind CSS 4, Vanilla CSS design tokens, dark navy cybersecurity palette
- **Icons**: Lucide React

### Infrastructure & Testing
- **Containers**: Docker & Docker Compose v2 (isolated multi-container PostgreSQL instances)
- **Automated Testing**: Custom deterministic test suites executed via `tsx`

---

## 6. Repository Structure

```
SentinelAPI/
├── .gitignore                     # Comprehensive git ignore for secrets, builds, and logs
├── README.md                      # Primary project overview and getting started guide
├── ARCHITECTURE.md               # Detailed architecture diagrams, request flows, and ERDs
├── SECURITY.md                   # Threat model, security boundaries, and gap analysis
├── DEMO_GUIDE.md                 # Step-by-step interview demo and reproduction guide
├── INTERVIEW_PREP.md             # Student interview cheat sheet, Q&A, and speaking scripts
├── PROJECT_FACTS.md              # Canonical factual source of truth
├── docker-compose.yml            # Docker configuration for SentinelAPI PostgreSQL (port 5433)
│
├── backend/                       # SentinelAPI Backend & Security Gateway
│   ├── .env.example              # Sanitized configuration template
│   ├── package.json              # Backend dependencies and test scripts
│   ├── prisma/                   # Database schema and migration history
│   │   ├── schema.prisma         # 11 relational models (User, Incident, Event, etc.)
│   │   └── migrations/           # Versioned SQL migrations
│   ├── src/
│   │   ├── app.ts                # Express application setup, CORS, route mounting
│   │   ├── server.ts             # Server entry point (starts listener on port 4000)
│   │   ├── config/               # Environment and database connection singletons
│   │   ├── engine/
│   │   │   └── threatDetector.ts # Regex threat detection and failed login evaluators
│   │   ├── middleware/           # Auth, rate limiters, request loggers, error handlers
│   │   ├── routes/               # Gateway, auth, incident, event, integrity, service routes
│   │   ├── services/
│   │   │   ├── gatewayService.ts # Reverse-proxy forwarder and threat filter
│   │   │   ├── incidentService.ts# Event aggregation and policy evaluation
│   │   │   └── integrityService.ts# Canonical JSON and HMAC-SHA256 engine
│   │   └── utils/                # Password hashing and token generation
│   └── tests/                    # Automated verification suites
│
├── frontend/                      # SentinelAPI Security Analyst Dashboard (Next.js)
│   ├── .env.local.example        # Next.js API URL template
│   ├── package.json              # Frontend dependencies and test script
│   └── src/
│       ├── app/
│       │   ├── dashboard/        # KPI analytics and high-level platform status
│       │   ├── incidents/        # Incident investigation and lifecycle console
│       │   ├── integrity/        # Interactive HMAC signing and verification portal
│       │   ├── monitoring/       # Filterable security events and live threat stream
│       │   └── login/            # Security portal authentication
│       ├── components/AppShell.tsx# Persistent sidebar and header navigation
│       └── lib/api.ts            # Type-safe API client connecting to port 4000
│
└── nexacart/                      # Demo E-Commerce Application Protected by SentinelAPI
    ├── docker-compose.yml        # Docker configuration for NexaCart PostgreSQL (port 5434)
    ├── backend/                  # Upstream Store API (port 5001)
    │   ├── .env.example          # Sanitized template
    │   ├── prisma/schema.prisma  # NexaCart product and order catalog schema
    │   └── src/                  # Express catalog routes (/api/products)
    └── frontend/                 # Customer Shopping Storefront (port 3001)
        ├── .env.local.example    # Points to SentinelAPI gateway (port 4000)
        └── src/                  # Modern e-commerce shopping experience
```

---

## 7. Request Lifecycle & Threat Detection Workflow

### A. Clean Gateway Request Flow
1. A user browses products on NexaCart (`http://localhost:3001`).
2. NexaCart frontend issues an HTTP request to `http://127.0.0.1:4000/api/gateway/nexacart/api/products`.
3. **Gateway Rate Limiter** validates that the client has not exceeded 120 requests/minute.
4. **Gateway Threat Inspector** inspects the URL, query parameters, and body against SQLi and Path Traversal regex signatures.
5. If clean, SentinelAPI rewires headers (`X-Request-Id`, `X-Forwarded-For`), strips internal authorization tokens, and reverse-proxies the request to NexaCart upstream (`http://127.0.0.1:5001/api/products`).
6. NexaCart upstream responds with HTTP 200 and the product catalog.
7. SentinelAPI streams the response back to the client and records an `ApiRequestLog`.

### B. Malicious Request Flow (e.g., SQL Injection Attempt)
1. An attacker sends: `GET /api/gateway/nexacart/api/products?category=' OR 1=1--`.
2. The request enters SentinelAPI Gateway on port 4000.
3. The URL and query string are safely decoded (up to 2 passes to prevent double-encoding bypasses).
4. `evaluateGatewayThreat()` flags a match against `('\s*or\s+['"\d\w]+\s*=\s*['"\d\w]+)`.
5. **Immediate Drop**: The gateway halts execution immediately and returns **HTTP 400 Bad Request**:
   ```json
   {
     "error": {
       "code": "THREAT_BLOCKED",
       "message": "Request blocked by SentinelAPI Security Gateway: Malicious payload pattern identified.",
       "threatType": "SQL_INJECTION",
       "requestId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d"
     }
   }
   ```
6. **No Forwarding**: The request **never reaches** NexaCart backend.
7. **Security Event Created**: A `SecurityEvent` record is persisted with `actionTaken = "BLOCKED"`, `threatType = "SQL_INJECTION"`, and `serviceId` linked to NexaCart.
8. **Incident Aggregation**: `IncidentService` checks for active incidents from this IP. It groups the event under an existing incident or opens a new CRITICAL incident.
9. **Dashboard Update**: The event and incident immediately appear on the Monitoring (`/monitoring`) and Incidents (`/incidents`) dashboards.

---

## 8. Local Setup & Quickstart Guide

### Prerequisites
- **Node.js**: v20+ (v22 LTS recommended)
- **npm**: v10+
- **Docker & Docker Compose**: For local PostgreSQL databases

### Step 1: Start Database Containers
From the repository root, start both isolated PostgreSQL instances:

```bash
# 1. Start SentinelAPI PostgreSQL on port 5433
docker compose up -d

# 2. Start NexaCart PostgreSQL on port 5434
cd nexacart
docker compose up -d
cd ..
```

### Step 2: Configure Environment Files
Copy the safe example files in all four subprojects:

```bash
# SentinelAPI Backend
cp backend/.env.example backend/.env

# SentinelAPI Frontend
cp frontend/.env.local.example frontend/.env.local

# NexaCart Backend
cp nexacart/backend/.env.example nexacart/backend/.env

# NexaCart Frontend
cp nexacart/frontend/.env.local.example nexacart/frontend/.env.local
```

*(On Windows PowerShell, use `Copy-Item backend/.env.example backend/.env`)*

### Step 3: Install Dependencies & Run Database Migrations

```bash
# 1. Install & migrate SentinelAPI Backend
cd backend
npm install
npx prisma migrate deploy
cd ..

# 2. Install SentinelAPI Frontend
cd frontend
npm install
cd ..

# 3. Install & initialize NexaCart Backend
cd nexacart/backend
npm install
npx prisma db push
cd ../..

# 4. Install NexaCart Frontend
cd nexacart/frontend
npm install
cd ../..
```

### Step 4: Provision an Administrator Account
Run the automated CLI setup script to create an initial security administrator:

```bash
cd backend
ADMIN_EMAIL="admin@sentinelapi.local" ADMIN_PASSWORD="Password123!@#" npm run admin:create
cd ..
```

---

## 9. Starting the Applications

Open 4 separate terminal tabs to run the services concurrently:

| Service | Working Directory | Command | Accessible URL |
| :--- | :--- | :--- | :--- |
| **SentinelAPI Backend** | `backend/` | `npm run dev` | `http://127.0.0.1:4000` |
| **SentinelAPI Frontend** | `frontend/` | `npm run dev` | `http://localhost:3000` |
| **NexaCart Backend** | `nexacart/backend/` | `npm run dev` | `http://127.0.0.1:5001` |
| **NexaCart Frontend** | `nexacart/frontend/` | `npm run dev` | `http://localhost:3001` |

---

## 10. Running Automated Tests

Run the deterministic test suites to verify functionality:

```bash
# Run SentinelAPI Authentication Test Suite (10/10 scenarios)
npm --prefix backend run test:auth

# Run SentinelAPI Gateway Proxy Tests
npm --prefix backend run test:gateway

# Run SentinelAPI Incident Aggregation Tests
npm --prefix backend run test:incident

# Run SentinelAPI HMAC Integrity Tests
npm --prefix backend run test:integrity

# Run SentinelAPI Frontend Contract Tests (6/6 scenarios)
npm --prefix frontend test

# Run NexaCart Backend Route Tests (3/3 scenarios)
npm --prefix nexacart/backend run test:health
```

---

## 11. Quick Demo Walkthrough

### 1. View Normal Shopping Experience
Open `http://localhost:3001` in your browser. You will see the NexaCart modern e-commerce storefront. Browsing products transparently routes requests through SentinelAPI's gateway on port 4000 to the backend on port 5001.

### 2. Test SQL Injection Protection via PowerShell
Open PowerShell and send a simulated SQL injection query:

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:4000/api/gateway/nexacart/api/products?category=' OR 1=1--" -Method Get
```

**Expected Response**: HTTP 400 Bad Request with code `THREAT_BLOCKED`.

### 3. Test Path Traversal Protection
Send a directory traversal pattern:

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:4000/api/gateway/nexacart/api/products/..%2f..%2fetc%2fpasswd" -Method Get
```

**Expected Response**: HTTP 400 Bad Request with code `THREAT_BLOCKED`.

### 4. Verify Live Evidence in SentinelAPI Dashboard
1. Open `http://localhost:3000/login` and log in using:
   - Email: `admin@sentinelapi.local`
   - Password: `Password123!@#`
2. Navigate to **Engine & Monitoring** (`/monitoring`):
   - Notice the newly recorded `SQL_INJECTION` and `PATH_TRAVERSAL` events marked with the red **BLOCKED** badge and attributed to **NexaCart Demo Store**.
3. Navigate to **Security Incidents** (`/incidents`):
   - Notice the automatically generated incident with **CRITICAL** severity and status **DETECTED**.
4. Navigate to **HMAC Data Integrity** (`/integrity`):
   - Generate an HMAC-SHA256 signature for a sample JSON payload.
   - Alter any character in the payload to demonstrate tamper detection.

---

## 12. Known Limitations & Future Roadmap

- **In-Memory Rate Limiting**: The sliding-window rate limiter stores request timestamps in Node.js process memory. In a distributed multi-instance deployment, rate limiting must be backed by a centralized Redis cluster.
- **Regex-Based Threat Matching**: The threat engine uses deterministic regular expressions for common SQLi and Path Traversal patterns. Highly obfuscated payloads or AST-based SQL analysis are planned for future versions.
- **Simulated Response Actions**: While the gateway directly rejects attacks (HTTP 400), response actions generated by the incident service (`IP_BLOCK`) are recorded in the database rather than dynamically pushing rules to cloud network security groups.
- **TLS/HTTPS**: Designed for local development over HTTP. Production deployment requires TLS termination at a reverse proxy (e.g., NGINX, Traefik, or AWS ALB).

---

## 13. Resume & Portfolio Summary

> **SentinelAPI — API Security Gateway & Incident Monitoring Platform**  
> *TypeScript, Node.js, Express, Next.js 16, React 19, PostgreSQL, Prisma, Docker*
> - Engineered an intelligent reverse-proxy security gateway that sits in front of microservices to inspect HTTP traffic, blocking SQL injection and path traversal attacks in-flight before reaching upstream backends.
> - Developed a cryptographic data integrity engine utilizing HMAC-SHA256, deterministic JSON canonicalization, and timing-safe equality to detect payload tampering.
> - Implemented an automated incident aggregation service with in-memory concurrency locking, grouping related threat events by source IP and escalating severity within a 15-minute sliding window.
> - Built a Next.js 16 cybersecurity analyst dashboard featuring live threat streams, customizable filtering, RBAC authentication (Argon2id + JWT), and full incident lifecycle tracking.
> - Demonstrated real-world protection by integrating and shielding **NexaCart**, a separate full-stack e-commerce demo application running in an isolated multi-container environment.
