# HoneyChain handoff: blockchain and integration

## Working today
- Smart contract (blockchain/contracts/HoneyBatch.sol, 36 tests passing): roles Beekeeper, Processor, Distributor, Lab; batches with hive ID and location; one lab report per batch; AI hive-condition record; one-time jar codes.
- Records page and read API (integration-node/server.js).
- AI part: a simple rule (condition_tree.json) for ideal / non_ideal, plus average daily gain per condition.
- MySQL database honeychain, table hive_readings (1,095 rows of simulated data).

## Not built yet
Gateway write endpoints, login, dashboard, simulator connection.

## Run order (every session; restarting the node empties the chain)
1. Window A: cd blockchain, then npx hardhat node (leave it open)
2. Window B: cd blockchain, then npx hardhat run scripts/deploy.ts --network localhost
3. cd integration-node, then node bridge.js (creates test batch HC100)
4. node makeJars.js HC100 5 (creates jar codes in a local CSV; delete an old CSV first)
5. node server.js (page at http://127.0.0.1:8000/verify/HC100)

## Settings (.env in the repo root, never committed)
DB_PASSWORD=...  CONTRACT_ADDRESS=0x...  PUBLIC_URL=http://127.0.0.1:8000

## Read API you can call now
GET http://127.0.0.1:8000/api/batch/HC100 returns batchId, beekeeper, hiveId, location, harvestDate (Unix seconds), quantity, status, jarCount, claimedCount, health (or null), lab (or null).

## Local test accounts (index: role)
0 owner/admin, 1 Beekeeper, 2 Processor, 3 Distributor, 4 Lab, 6 claims jar codes.

## Rules
Do not commit .env, node_modules or jar-codes CSV files. Run git pull before you start. Each person edits mainly their own folder. The planned endpoints are in docs/API_CONTRACT.md.