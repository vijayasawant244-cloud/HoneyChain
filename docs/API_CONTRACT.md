# HoneyChain API contract (draft v1)

Ports: frontend 5173, Spring Boot backend 8080, Node gateway 8000 (internal only), Hardhat node 8545.
Users reach only the frontend and the backend. The gateway is called only by the backend.

## Roles
ADMIN (contract owner), BEEKEEPER, PROCESSOR, DISTRIBUTOR, LAB. A consumer has no login.

## Conventions
- JSON everywhere. Login token goes in the header: Authorization: Bearer <token>
- Dates in the API are "YYYY-MM-DD" (stored on-chain as Unix seconds).
- batchId: letters, digits and hyphens, up to 30 characters. hiveId looks like HIVE-1.
- quantity: whole kg (to be confirmed by the team).
- condition: "ideal" or "non_ideal". confidencePct: whole number 0-100. estDailyGainGrams: whole grams.
- Errors: { "error": "message" } with status 400, 401, 403, 404 or 409.
- Public text never uses the words pure, verified, genuine or authentic.

## A. Backend API (Spring Boot, called by the frontend)

| Method | Path | Who | What it does |
|---|---|---|---|
| POST | /api/auth/login | anyone | body {username, password}, returns {token, role} |
| GET | /api/hives | any logged-in user | list hives |
| GET | /api/hives/{hiveId}/readings/latest | any logged-in user | latest reading |
| GET | /api/hives/{hiveId}/readings?days=7 | any logged-in user | recent readings |
| POST | /api/hives/{hiveId}/readings | ADMIN or the simulator key | body {hiveTemp, hiveHumidity, weightKg, time} |
| GET | /api/hives/{hiveId}/condition | any logged-in user | returns {condition, confidencePct, estDailyGainGrams} from the latest reading |
| POST | /api/batches | BEEKEEPER | body {batchId, hiveId, location, harvestDate, quantity} |
| GET | /api/batches | any logged-in user | list batches |
| GET | /api/batches/{batchId} | any logged-in user | full record |
| POST | /api/batches/{batchId}/health | BEEKEEPER or ADMIN | stores the hive's current condition on the batch |
| POST | /api/batches/{batchId}/lab-report | LAB | body {reportHash, passed} |
| POST | /api/batches/{batchId}/status | PROCESSOR (Tested) or DISTRIBUTOR (Shipped) | body {status} |
| POST | /api/batches/{batchId}/jars | BEEKEEPER (the batch creator) | body {count}, returns {codes: [...]} shown once |
| GET | /api/public/batches/{batchId} | nobody needs to log in | consumer view of the records |
| POST | /api/public/batches/{batchId}/check-code | nobody needs to log in | body {code}, returns {result, usedOn?} |

check-code results: FIRST_USE, ALREADY_USED, NOT_FOUND, OTHER_BATCH.

## B. Gateway API (Node, internal, every call needs header X-Gateway-Key)

Exists today: GET /api/batch/:id, GET /verify/:id, POST /check/:id (HTML form), GET /qr/:id

To build:
| Method | Path | Body |
|---|---|---|
| POST | /gateway/predict | {hiveTemp, hiveHumidity} returns {condition, confidencePct, gainGrams} |
| POST | /gateway/batches | {actor, batchId, hiveId, location, harvestDate, quantity} |
| POST | /gateway/batches/:id/health | {condition, confidencePct, gainGrams} |
| POST | /gateway/batches/:id/lab-report | {reportHash, passed} |
| POST | /gateway/batches/:id/status | {actor, status} |
| POST | /gateway/batches/:id/jars | {count} returns {codes} |
| POST | /gateway/check-code | {batchId, code} |

The gateway signs with test accounts: ADMIN is account 0, BEEKEEPER 1, PROCESSOR 2, DISTRIBUTOR 3, LAB 4, and claims use account 6.
The backend checks who the user is, then tells the gateway which actor to use.

## Known limits (also for the report)
- The server holds the test keys, so users do not sign with their own wallets.
- The chain is local and resets when the node restarts. The data is simulated.
- The record shows what was saved. It does not test the honey.