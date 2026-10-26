# SentinelAPI — Backend Service

The core backend service for the **SentinelAPI** framework, built with Node.js, Express.js, and TypeScript.

---

## 1. Prerequisites

- **Node.js**: v20+ (v22.x recommended)
- **npm**: v10+

---

## 2. Installation

From the `backend/` directory:

```bash
npm install
```

---

## 3. Configuration

Copy the example environment configuration file:

```bash
# On Windows (PowerShell)
Copy-Item .env.example .env

# On Linux/macOS
cp .env.example .env
```

Default settings in `.env.example`:
* `PORT`: `4000` (Default HTTP port)
* `HOST`: `127.0.0.1` (Bound locally to avoid unnecessary network exposure)
* `NODE_ENV`: `development`
* `SERVICE_NAME`: `sentinel-api-backend`

---

## 4. Running the Application

### Development Mode (with hot-reloading)
Runs directly using `tsx`:
```bash
npm run dev
```

### Building for Production
Compiles TypeScript into `dist/`:
```bash
npm run build
```

### Starting the Production Build
Runs the compiled code from `dist/server.js`:
```bash
npm start
```

---

## 5. API Endpoints

### Health Check
* **Method:** `GET`
* **Path:** `/api/health`
* **Response:**
  ```json
  {
    "status": "ok",
    "service": "sentinel-api-backend",
    "timestamp": "2026-10-23T05:25:00.000Z"
  }
  ```

### Error Responses
* **Unknown Route (404):**
  ```json
  {
    "error": {
      "code": "NOT_FOUND",
      "message": "Cannot GET /unknown-path"
    }
  }
  ```
* **Malformed JSON (400):**
  ```json
  {
    "error": {
      "code": "BAD_REQUEST",
      "message": "Invalid or malformed JSON payload"
    }
  }
  ```
