# ProofPost API Contracts
# docs/API_CONTRACTS.md

## BASE URL
`http://localhost:7821`

---

## SYSTEM ENDPOINTS

### GET /health
Checks system status including Database and AI provider.
- **Response**: `200 OK`
- **Body**: `HealthResponse`
```json
{
  "status": "ok",
  "timestamp": "123.45",
  "db": true,
  "ai": true,
  "queue": {
    "pending": 0,
    "dispatched": 0
  }
}
```

### GET /
Serves the operator dashboard.
- **Response**: `200 OK`
- **Body**: `text/html` (FileResponse)

---

## PIPELINE ENDPOINTS

### POST /webhook/github
Ingestion point for GitHub webhooks. Requires valid `X-Hub-Signature-256`.
- **Request Headers**: `X-Hub-Signature-256`
- **Request Body**: Raw GitHub Webhook JSON
- **Response**: `200 OK`
- **Body**: `WebhookResponse`
```json
{
  "status": "accepted",
  "facts_extracted": 2,
  "facts_verified": 1,
  "trace_id": "uuid-v4"
}
```
- **Errors**:
  - `401 Unauthorized`: Invalid signature
  - `413 Payload Too Large`: Body exceeds max_payload_size

---

## OPERATOR API

### GET /api/facts/pending
Returns list of verified facts awaiting approval.
- **Response**: `200 OK`
- **Body**: `PendingQueueResponse`
```json
{
  "items": [
    {
      "id": "fact-123",
      "fact_type": "BUILD_SUCCESS",
      "summary": "Build succeeded in main branch",
      "source_snippet": "commit hash: a1b2c3d...",
      "confidence_score": 1.0,
      "created_at": "2024-01-01T12:00:00Z",
      "status": "pending"
    }
  ],
  "total": 1
}
```

### POST /api/facts/{id}/approve
Approves a fact for immediate publication.
- **Path Params**: `id`
- **Response**: `200 OK`
- **Body**: `ActionResponse`

### POST /api/facts/{id}/reject
Rejects and discards a fact.
- **Path Params**: `id`
- **Response**: `200 OK`
- **Body**: `ActionResponse`

### GET /api/history
Returns log of dispatched posts.
- **Response**: `200 OK`
- **Body**: `HistoryResponse`

---

## CONFIGURATION API

### GET /api/platforms
Returns connection status for all configured platforms.
- **Response**: `200 OK`
- **Body**: `PlatformsResponse`

### POST /api/platforms/{id}/test
Triggers a connection test for a platform.
- **Path Params**: `id`
- **Response**: `200 OK`
- **Body**: `TestPlatformResponse`

### GET /api/settings
Returns current settings with sensitive values masked.
- **Response**: `200 OK`
- **Body**: `SettingsResponse`

### POST /api/settings
Updates application settings.
- **Request Body**: Partial or full settings JSON
- **Response**: `200 OK`
- **Body**: `ActionResponse`
```json
{
  "status": "success",
  "message": "Settings updated"
}
```

### POST /api/settings/test-ai
Tests AI provider credentials with a real API call.
- **Request Body**: `TestAIRequest`
- **Response**: `200 OK`
- **Body**: `TestAIResponse`

---

## OBSERVABILITY API

### GET /api/events
Returns recent pipeline events for the Observability view.
- **Query Params**: `limit` (default 100)
- **Response**: `200 OK`
- **Body**: `EventsResponse`

---

## WORKSPACE API

### GET /api/facts/{id}/preview
Generates a platform-specific post preview using AI.
- **Path Params**: `id`
- **Query Params**: `platform` (default "bluesky")
- **Response**: `200 OK`
- **Body**: `PreviewResponse`

---

## ERROR SCHEMA
Standard FastAPI error shape used for all non-200 responses.
```json
{
  "detail": "Error message description"
}
```
