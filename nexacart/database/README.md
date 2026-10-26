# NexaCart Database Documentation

## Isolated Database Architecture

NexaCart uses a dedicated PostgreSQL 17 instance that is completely isolated from SentinelAPI and ShadowShield.

### Network & Port Configuration
- **Container Name:** `nexacart-postgres`
- **Host Binding:** `127.0.0.1:5434:5432`
- **Internal Port:** `5432`
- **Database Name:** `nexacart_db`
- **Dedicated Volume:** `nexacart_postgres_data`

### Port Preservation
- `5432`: Reserved for `shadowshield-postgres` (Preserved)
- `5433`: Reserved for `sentinelapi-postgres` (Preserved)
- `5434`: Dedicated to `nexacart-postgres` (NexaCart store)

### Starting the Database
From the `nexacart/` directory:
```bash
docker compose up -d
```
Verify container health:
```bash
docker ps --filter "name=nexacart-postgres"
```
