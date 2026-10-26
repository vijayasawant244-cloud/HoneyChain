const express = require("express");
const crypto = require("crypto");
const { ethers } = require("ethers");
const { provider, contract, predictHive } = require("./common");

const router = express.Router();
router.use(express.json());

// ---- every gateway call must carry the shared key in the X-Gateway-Key header ----
function keyOk(given) {
  const a = Buffer.from(String(given || ""));
  const b = Buffer.from(process.env.GATEWAY_KEY || "");
  return b.length > 0 && a.length === b.length && crypto.timingSafeEqual(a, b);
}
router.use((req, res, next) => {
  if (!process.env.GATEWAY_KEY) return res.status(503).json({ error: "GATEWAY_KEY is not set in .env" });
  if (!keyOk(req.get("X-Gateway-Key"))) return res.status(401).json({ error: "Bad or missing gateway key" });
  next();
});

// ---- which test account acts for which role ----
const ACTOR_INDEX = { ADMIN: 0, BEEKEEPER: 1, PROCESSOR: 2, DISTRIBUTOR: 3, LAB: 4 };
const ROLE_NUMBER = { BEEKEEPER: 1, PROCESSOR: 2, DISTRIBUTOR: 3, LAB: 4 };
const CLAIM_ACCOUNT = 6;   // pays for jar-code claims

const signerFor = (actor) => provider.getSigner(ACTOR_INDEX[actor]);

// makes sure the test accounts hold their roles on the current chain
async function ensureRoles() {
  const owner = await signerFor("ADMIN");
  for (const [actor, role] of Object.entries(ROLE_NUMBER)) {
    const addr = await (await signerFor(actor)).getAddress();
    if (Number(await contract.roles(addr)) !== role) {
      await (await contract.connect(owner).assignRole(addr, role)).wait();
    }
  }
}

// ---- small helpers ----
const ID_RE = /^[A-Za-z0-9-]{1,30}$/;
const isId = (s) => typeof s === "string" && ID_RE.test(s);
const isText = (s, max) => typeof s === "string" && s.trim().length > 0 && s.length <= max;
const bad = (res, msg) => res.status(400).json({ error: msg });

function reasonOf(e) {
  return (e && e.revert && e.revert.args && e.revert.args[0]) || (e && e.reason) || (e && e.shortMessage) || "Transaction failed";
}
function statusOf(reason) {
  if (/does not exist|not found/i.test(reason)) return 404;
  if (/already/i.test(reason)) return 409;
  if (/role|Only/i.test(reason)) return 403;
  return 400;
}
const handle = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (e) {
    if (e && (e.revert || e.code === "CALL_EXCEPTION")) {   // the contract refused the call
      const reason = reasonOf(e);
      return res.status(statusOf(reason)).json({ error: reason });
    }
    console.error("gateway error:", e);
    res.status(500).json({ error: "Gateway error" });
  }
};

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";   // no I, O, 0 or 1
function makeSecret() {
  let s = "";
  for (let i = 0; i < 12; i++) {
    s += ALPHABET[crypto.randomInt(ALPHABET.length)];
    if (i % 4 === 3 && i < 11) s += "-";
  }
  return s;
}

// ---- endpoints ----
router.get("/ping", handle(async (req, res) => {
  res.json({ ok: true, contract: await contract.getAddress(), block: await provider.getBlockNumber() });
}));

router.post("/predict", handle(async (req, res) => {
  const { hiveTemp, hiveHumidity } = req.body || {};
  if (!Number.isFinite(hiveTemp) || !Number.isFinite(hiveHumidity)) return bad(res, "hiveTemp and hiveHumidity must be numbers");
  if (hiveTemp < -20 || hiveTemp > 80 || hiveHumidity < 0 || hiveHumidity > 100) return bad(res, "Values out of range");
  const r = predictHive(hiveTemp, hiveHumidity);
  res.json({ condition: r.condition, confidencePct: r.confidencePct, gainGrams: r.gainGrams });
}));

router.post("/batches", handle(async (req, res) => {
  const { beekeeperName, batchId, hiveId, location, harvestDate, quantity } = req.body || {};
  if (!isText(beekeeperName, 60)) return bad(res, "beekeeperName required (up to 60 characters)");
  if (!isId(batchId)) return bad(res, "batchId must be letters, digits and hyphens, up to 30 characters");
  if (!isId(hiveId)) return bad(res, "hiveId must be letters, digits and hyphens, up to 30 characters");
  if (!isText(location, 60)) return bad(res, "location required (up to 60 characters)");
  const ts = /^\d{4}-\d{2}-\d{2}$/.test(String(harvestDate)) ? Math.floor(Date.parse(harvestDate + "T00:00:00Z") / 1000) : NaN;
  if (!Number.isFinite(ts)) return bad(res, "harvestDate must be YYYY-MM-DD");
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100000) return bad(res, "quantity must be a whole number from 1 to 100000");

  await ensureRoles();
  const tx = await contract.connect(await signerFor("BEEKEEPER")).createBatch(batchId, beekeeperName, hiveId, location, ts, quantity);
  await tx.wait();
  res.status(201).json({ batchId, txHash: tx.hash });
}));

router.post("/batches/:id/health", handle(async (req, res) => {
  const id = req.params.id;
  const { condition, confidencePct, gainGrams } = req.body || {};
  if (!isId(id)) return bad(res, "Invalid batch ID");
  if (!["ideal", "non_ideal"].includes(condition)) return bad(res, "condition must be ideal or non_ideal");
  if (!Number.isInteger(confidencePct) || confidencePct < 0 || confidencePct > 100) return bad(res, "confidencePct must be a whole number 0-100");
  if (!Number.isInteger(gainGrams) || gainGrams < 0 || gainGrams > 100000) return bad(res, "gainGrams must be a whole number of grams");

  await ensureRoles();
  const tx = await contract.connect(await signerFor("ADMIN")).setHealth(id, condition, confidencePct, gainGrams);
  await tx.wait();
  res.json({ batchId: id, txHash: tx.hash });
}));

router.post("/batches/:id/lab-report", handle(async (req, res) => {
  const id = req.params.id;
  const { reportHash, passed } = req.body || {};
  if (!isId(id)) return bad(res, "Invalid batch ID");
  if (!ethers.isHexString(reportHash, 32)) return bad(res, "reportHash must be 0x followed by 64 hex characters");
  if (typeof passed !== "boolean") return bad(res, "passed must be true or false");

  await ensureRoles();
  const tx = await contract.connect(await signerFor("LAB")).recordLabReport(id, reportHash, passed);
  await tx.wait();
  res.status(201).json({ batchId: id, txHash: tx.hash });
}));

router.post("/batches/:id/status", handle(async (req, res) => {
  const id = req.params.id;
  const { status } = req.body || {};
  if (!isId(id)) return bad(res, "Invalid batch ID");
  const actor = status === "Tested" ? "PROCESSOR" : status === "Shipped" ? "DISTRIBUTOR" : null;
  if (!actor) return bad(res, "status must be Tested or Shipped");

  await ensureRoles();
  const tx = await contract.connect(await signerFor(actor)).updateStatus(id, status);
  await tx.wait();
  res.json({ batchId: id, status, txHash: tx.hash });
}));

router.post("/batches/:id/jars", handle(async (req, res) => {
  const id = req.params.id;
  const count = req.body && req.body.count;
  if (!isId(id)) return bad(res, "Invalid batch ID");
  if (!Number.isInteger(count) || count < 1 || count > 100) return bad(res, "count must be a whole number from 1 to 100");

  const secrets = Array.from({ length: count }, makeSecret);
  const hashes = secrets.map((s) => ethers.keccak256(ethers.toUtf8Bytes(s)));
  await ensureRoles();
  const tx = await contract.connect(await signerFor("BEEKEEPER")).registerJars(id, hashes);
  await tx.wait();
  res.status(201).json({ batchId: id, codes: secrets });   // shown once; the gateway does not keep them
}));

router.post("/check-code", handle(async (req, res) => {
  const { batchId, code } = req.body || {};
  if (!isId(batchId) || typeof code !== "string" || code.trim().length < 1 || code.length > 40) return bad(res, "batchId and code required");
  const secret = code.trim().toUpperCase();

  let [registered, claimed, claimedAt, codeBatch] = await contract.getJarStatus(secret);
  if (!registered) return res.json({ result: "NOT_FOUND" });
  if (codeBatch !== batchId) return res.json({ result: "OTHER_BATCH" });

  if (!claimed) {
    try {
      const relayer = await provider.getSigner(CLAIM_ACCOUNT);
      await (await contract.connect(relayer).claimJar(secret)).wait();
      return res.json({ result: "FIRST_USE" });
    } catch (e) {
      [registered, claimed, claimedAt] = await contract.getJarStatus(secret);   // someone may have claimed it a moment ago
      if (!claimed) throw e;
    }
  }
  res.json({ result: "ALREADY_USED", usedOn: new Date(Number(claimedAt) * 1000).toISOString().slice(0, 10) });
}));

module.exports = router;