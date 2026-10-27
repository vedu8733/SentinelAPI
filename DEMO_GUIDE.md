# SentinelAPI — Live Technical Demo & Interview Presentation Guide

This guide contains step-by-step, reproducible instructions for demonstrating SentinelAPI and NexaCart during a technical interview or live project presentation.

---

## 1. Demo Architecture & Port Reference

Ensure the following 4 services and 2 databases are running:

| Service Name | Port | Base URL | Function in Demo |
| :--- | :--- | :--- | :--- |
| **SentinelAPI Gateway & Backend** | `4000` | `http://127.0.0.1:4000` | Intercepts, filters, and logs all traffic |
| **SentinelAPI Monitoring Console** | `3000` | `http://localhost:3000` | Shows real-time KPIs, events, incidents, and HMAC tool |
| **NexaCart Upstream Catalog API** | `5001` | `http://127.0.0.1:5001` | Protected upstream store API |
| **NexaCart Customer Storefront** | `3001` | `http://localhost:3001` | Customer-facing e-commerce UI |
| **SentinelAPI PostgreSQL** | `5433` | `127.0.0.1:5433` | Stores security logs, events, and incidents |
| **NexaCart PostgreSQL** | `5434` | `127.0.0.1:5434` | Stores product catalog and store orders |

---

## 2. Pre-Demo Setup & Health Check

### Objective
Verify that all 4 processes and database containers are healthy before starting your presentation.

### PowerShell Command:
```powershell
# Check health of both backends
Invoke-RestMethod -Uri "http://localhost:4000/api/health" -Method Get
Invoke-RestMethod -Uri "http://localhost:5001/api/health" -Method Get
```

### Expected Output:
```json
{
  "status": "ok",
  "service": "sentinel-api-backend",
  "timestamp": "2026-10-27T07:18:32.047Z"
}
{
  "status": "ok",
  "service": "nexacart-backend",
  "timestamp": "2026-10-27T07:18:34.362Z"
}
```

---

## 3. Demo Scenario 1: Clean Traffic Forwarding

### Objective
Show that under normal conditions, SentinelAPI acts as a completely transparent reverse proxy, allowing ordinary shoppers to browse NexaCart seamlessly.

### Steps:
1. Open your browser and navigate to `http://localhost:3001`.
2. Observe the modern NexaCart storefront loading products ("CyberShield Mech Keyboard", "Quantum Sound ANC Headphones", etc.).
3. Open browser DevTools (F12) &rarr; **Network** tab.
4. Refresh the page or click a product. Notice the request goes to:
   `http://127.0.0.1:4000/api/gateway/nexacart/api/products`
5. The request returns **HTTP 200 OK**. SentinelAPI forwarded the request to `http://127.0.0.1:5001/api/products` and returned the catalog without modifying data.

### Explanation to the Interviewer:
> *"NexaCart is completely decoupled from security rules. Its frontend points to SentinelAPI's gateway on port 4000. When traffic is benign, SentinelAPI transparently forwards it to NexaCart's private backend on port 5001 and streams the response back."*

---

## 4. Demo Scenario 2: Active SQL Injection (SQLi) Blocking

### Objective
Demonstrate that SentinelAPI inspects inbound parameters in-flight and actively blocks malicious SQL patterns with **HTTP 400**, preventing the request from ever reaching NexaCart.

### Preconditions:
SentinelAPI backend running on port 4000.

### PowerShell Command:
```powershell
try {
    Invoke-RestMethod -Uri "http://127.0.0.1:4000/api/gateway/nexacart/api/products?category=' OR 1=1--" -Method Get
} catch {
    $stream = $_.Exception.Response.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($stream)
    $reader.ReadToEnd()
}
```

### Expected HTTP Response:
- **HTTP Status Code**: `400 Bad Request`
- **Response Body**:
  ```json
  {
    "error": {
      "code": "THREAT_BLOCKED",
      "message": "Request blocked by SentinelAPI Security Gateway: Malicious payload pattern identified.",
      "threatType": "SQL_INJECTION",
      "requestId": "e89c1692-bb8f-43ea-9fc0-4a87ad1e847c"
    }
  }
  ```

### Dashboard Evidence:
1. Open `http://localhost:3000/monitoring` in your browser.
2. In the Live Threat Stream, observe the top row:
   - **Threat Type**: `SQL_INJECTION`
   - **Severity**: Red badge `CRITICAL`
   - **Action Taken**: Red badge `BLOCKED`
   - **Service**: `NexaCart Demo Store`
3. Click the event to inspect details: the exact blocked query parameter `?category=' OR 1=1--` is displayed without logging sensitive secrets.

---

## 5. Demo Scenario 3: Directory / Path Traversal Blocking

### Objective
Demonstrate that directory traversal payloads (`../` or `%2e%2e/`) attempting to escape the API root are detected and dropped.

### PowerShell Command:
```powershell
try {
    Invoke-RestMethod -Uri "http://127.0.0.1:4000/api/gateway/nexacart/api/products/..%2f..%2fetc%2fpasswd" -Method Get
} catch {
    $stream = $_.Exception.Response.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($stream)
    $reader.ReadToEnd()
}
```

### Expected HTTP Response:
- **HTTP Status Code**: `400 Bad Request`
- **Response Body**:
  ```json
  {
    "error": {
      "code": "THREAT_BLOCKED",
      "message": "Request blocked by SentinelAPI Security Gateway: Malicious payload pattern identified.",
      "threatType": "PATH_TRAVERSAL",
      "requestId": "..."
    }
  }
  ```

### Dashboard Evidence:
1. Open `http://localhost:3000/monitoring`.
2. Notice the `PATH_TRAVERSAL` event marked `HIGH` severity and `BLOCKED`.
3. Open `http://localhost:3000/incidents`. Notice that SentinelAPI created a new incident: `[PATH_TRAVERSAL] Security alert from 127.0.0.1` with status `DETECTED`.

---

## 6. Demo Scenario 4: Gateway Rate Limiting & HTTP 429

### Objective
Demonstrate that excessive request volume is throttled using a sliding window counter, returning **HTTP 429 Too Many Requests** and logging a `THROTTLED` security event.

### Explanation:
The NexaCart gateway route is configured with a threshold of **120 requests per minute**. Native SentinelAPI endpoints use 100 req/min.

### PowerShell Command (Simulate high-volume burst):
```powershell
# Send a rapid burst of 125 requests to trigger the 120 req/min limit
1..125 | ForEach-Object {
    try {
        $res = Invoke-WebRequest -Uri "http://127.0.0.1:4000/api/gateway/nexacart/api/products" -Method Get -UseBasicParsing
        Write-Host "Req $_ : $($res.StatusCode)"
    } catch {
        Write-Host "Req $_ : $($_.Exception.Response.StatusCode) (Throttled)" -ForegroundColor Yellow
    }
}
```

### Expected Response on Reaching Limit:
- **HTTP Status Code**: `429 Too Many Requests`
- **Response Body**:
  ```json
  {
    "error": {
      "code": "TOO_MANY_REQUESTS",
      "message": "NexaCart gateway rate limit exceeded. Please wait before retrying."
    }
  }
  ```

### Dashboard Evidence:
1. Open `http://localhost:3000/monitoring`.
2. Filter the Action dropdown by `THROTTLED`.
3. Notice the event with `ThreatType = RATE_LIMIT_EXCEEDED`, amber badge `THROTTLED`, and Service attributed to `NexaCart Demo Store`.

---

## 7. Demo Scenario 5: Cryptographic Data Integrity (HMAC-SHA256)

### Objective
Demonstrate that SentinelAPI provides cryptographic tamper-proofing for sensitive payloads and immediately flags tampering when a single character is modified.

### UI Steps:
1. Log into the SentinelAPI Console: `http://localhost:3000/login`
   - Email: `admin@sentinelapi.local`
   - Password: `Password123!@#`
2. Navigate to **HMAC Data Integrity** (`/integrity`).
3. Under **Sign Payload**:
   - Resource Type: `Order`
   - Resource ID: `ORD-90210`
   - JSON Payload:
     ```json
     {
       "orderId": "ORD-90210",
       "amount": 499.99,
       "currency": "USD",
       "recipient": "Alice Johnson"
     }
     ```
   - Click **Generate HMAC Signature**.
   - Notice the calculated 64-character hex signature (e.g. `d7a8f...`) and key ID `sentinel-hmac-v1`.
4. Under **Verify Payload**:
   - Click **Verify Integrity** with the unaltered JSON.
   - Result: Green alert &rarr; **"Data integrity verified successfully. No tampering detected."**
5. **Simulate Adversarial Tampering**:
   - In the verify form, change `"amount": 499.99` to `"amount": 49.99` (simulating a client attempting to pay less).
   - Click **Verify Integrity**.
   - Result: Red alert &rarr; **"HMAC signature mismatch: payload modification detected."**
6. Open **Engine & Monitoring** (`/monitoring`):
   - A new `CRITICAL` severity event `HMAC_VERIFICATION_FAILED` is recorded in the audit log!

---

## 8. Demo Scenario 6: Incident Investigation & Lifecycle Management

### Objective
Demonstrate how a security analyst investigates and resolves an incident.

### UI Steps:
1. Navigate to **Security Incidents** (`http://localhost:3000/incidents`).
2. Click on an incident with status **DETECTED** (e.g., from the SQLi demo).
3. The right-hand inspection drawer opens showing:
   - **Incident Summary**: Title, Source IP (`127.0.0.1`), Service (`NexaCart Demo Store`), Severity (`CRITICAL`).
   - **Linked Security Events**: The exact timeline of events that triggered this incident.
   - **Proposed Response Action**: `IP_BLOCK` with status `PENDING` or `APPLIED`.
4. Transition the Incident Status:
   - Click **Start Investigation** &rarr; Status updates to **INVESTIGATING**.
   - Click **Mitigate** &rarr; Status updates to **MITIGATED**.
   - Click **Resolve Incident** &rarr; Status updates to **RESOLVED**.
5. Explain to the interviewer:
   > *"SentinelAPI enforces a strict finite state machine for incident lifecycles: DETECTED &rarr; INVESTIGATING &rarr; MITIGATED &rarr; RESOLVED. Every transition is recorded in the database audit log with the analyst's user ID."*

---

## 9. Understanding HTTP Status Codes in Security Demonstrations

Explain these distinctions clearly to an interviewer:

| Status Code | Meaning in SentinelAPI | Does It Prove Protection? |
| :--- | :--- | :--- |
| **HTTP 200 OK** | Request was clean, forwarded to upstream, and returned data | **Yes**: Confirms normal proxy forwarding works |
| **HTTP 400 Bad Request** | Request contained an attack pattern and was dropped by the gateway | **Yes**: Confirms active threat prevention |
| **HTTP 429 Too Many Requests** | Request exceeded the configured sliding window rate limit | **Yes**: Confirms rate limiting protection |
| **HTTP 502 Bad Gateway** | Gateway could not connect to NexaCart backend (offline) | **No**: Indicates an upstream connectivity issue |
| **HTTP 504 Gateway Timeout** | Upstream took longer than 8000ms to respond | **No**: Indicates upstream latency or hanging process |

---

## 10. How to Recover or Reset During a Demo

If something goes wrong during your presentation:

1. **Do NOT run `docker compose down -v`**:
   - This would wipe the PostgreSQL database volumes.
2. **Restart backend services cleanly**:
   - If an Express process hangs, simply press `Ctrl+C` in that terminal and run `npm run dev`.
3. **Reset in-memory counters**:
   - Restarting the SentinelAPI backend process (`backend/src/server.ts`) immediately clears in-memory rate-limit sliding windows and event cooldowns without deleting persistent database records.
