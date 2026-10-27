# SentinelAPI — Visual Screenshot Checklist & Evidence Guide

> **Note on Verification**: Because automated browser drivers require external CDN access unavailable in this environment, this checklist provides the exact URLs, recommended file paths, and visual elements to capture manually for your documentation, presentation slides, or portfolio.

---

## Recommended Folder Location
Save your captured PNG screenshots to:
`docs/screenshots/`

---

## 1. SentinelAPI Security Monitoring Dashboard
- **File Name**: `docs/screenshots/01_sentinel_dashboard.png`
- **Page URL**: `http://localhost:3000/dashboard`
- **Recommended State**:
  - Four aligned KPI cards visible at the top:
    - **Total Requests**
    - **Threats Blocked**
    - **Open Incidents**
    - **Protected Services** (showing NexaCart Active)
  - Protected Services card showing NexaCart Demo Store with healthy latency.
  - Recent Security Events stream showing recent `SQL_INJECTION` or `PATH_TRAVERSAL` activity.

---

## 2. Live Threat Stream & Filterable Event Feed
- **File Name**: `docs/screenshots/02_security_events_monitoring.png`
- **Page URL**: `http://localhost:3000/monitoring`
- **Recommended State**:
  - Filter dropdowns visible: Service (`NexaCart Demo Store`), Action Taken (`BLOCKED` or `THROTTLED`), Severity (`CRITICAL` or `HIGH`).
  - Table displaying the red **BLOCKED** badge for SQL injection and amber **THROTTLED** badge for rate limits.
  - Open the **Inspect Event** modal to show the sanitized query payload (`?category=' OR 1=1--`).

---

## 3. Security Incident Investigation Console
- **File Name**: `docs/screenshots/03_incident_investigation.png`
- **Page URL**: `http://localhost:3000/incidents`
- **Recommended State**:
  - Incident list showing an active case: `[SQL_INJECTION] Security alert from 127.0.0.1`.
  - Right-side investigation drawer open showing:
    - Severity: `CRITICAL`
    - Status: `DETECTED` or `INVESTIGATING`
    - Timeline of aggregated `SecurityEvent` records.
    - Proposed response action (`IP_BLOCK` with status `PENDING` or `APPLIED`).
    - Status transition buttons (`Start Investigation`, `Mitigate`, `Resolve`).

---

## 4. Cryptographic Data Integrity (HMAC-SHA256)
- **File Name**: `docs/screenshots/04_hmac_tamper_detection.png`
- **Page URL**: `http://localhost:3000/integrity`
- **Recommended State**:
  - Top section: Generated HMAC-SHA256 signature for resource `Order` (`ORD-90210`).
  - Bottom section: Red alert banner demonstrating failed verification after modifying a payload value (`"amount": 49.99` instead of `499.99`):
    - *"HMAC signature mismatch: payload modification detected."*

---

## 5. Protected Demo Storefront (NexaCart)
- **File Name**: `docs/screenshots/05_nexacart_storefront.png`
- **Page URL**: `http://localhost:3001`
- **Recommended State**:
  - Customer-facing homepage showing the Hero banner ("Elevate Your Everyday Essentials"), category navigation, and product cards (CyberShield Keyboard, PulseTracker Pro, Quantum Sound Headphones).
  - Browser DevTools (F12) Network tab open in the lower half showing requests to `http://127.0.0.1:4000/api/gateway/nexacart/api/products` returning `200 OK`.

---

## 6. Terminal Attack Simulation & Immediate Block
- **File Name**: `docs/screenshots/06_terminal_exploit_block.png`
- **Recommended State**:
  - PowerShell window showing the executed attack command:
    ```powershell
    Invoke-RestMethod -Uri "http://127.0.0.1:4000/api/gateway/nexacart/api/products?category=' OR 1=1--" -Method Get
    ```
  - Followed by the immediate HTTP 400 rejection:
    ```json
    {
      "error": {
        "code": "THREAT_BLOCKED",
        "message": "Request blocked by SentinelAPI Security Gateway: Malicious payload pattern identified.",
        "threatType": "SQL_INJECTION"
      }
    }
    ```
