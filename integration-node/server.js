const express = require("express");
const QRCode = require("qrcode");
const { provider, contract } = require("./common");

const PUBLIC_URL = process.env.PUBLIC_URL || "http://127.0.0.1:8000";
const app = express();
app.use(express.urlencoded({ extended: false }));
app.use("/gateway", require("./gateway"));

const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));   // contract text is untrusted
const day = (t) => new Date(Number(t) * 1000).toISOString().slice(0, 10);

async function readBatch(id) {
  const b = await contract.getBatch(id);
  if (b[0] === "") return null;
  const h = await contract.getHealth(id);
  const l = await contract.getLabReport(id);
  return {
    batchId: b[0], beekeeper: b[1], hiveId: b[2], location: b[3],
    harvestDate: Number(b[4]), quantity: Number(b[5]), status: b[6],
    jarCount: Number(await contract.jarCount(id)),
    claimedCount: Number(await contract.claimedCount(id)),
    health: Number(h[3]) === 0 ? null :
      { condition: h[0], confidencePct: Number(h[1]), gainGrams: Number(h[2]), recordedAt: Number(h[3]) },
    lab: Number(l[3]) === 0 ? null :
      { address: l[0], reportHash: l[1], passed: l[2], recordedAt: Number(l[3]) },
  };
}

const page = (body) => `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>HoneyChain records</title>
<style>body{font-family:system-ui,sans-serif;max-width:480px;margin:20px auto;padding:0 16px;color:#222}
.card{border:1px solid #ddd;border-radius:12px;padding:16px;margin:12px 0}
.warn{background:#fff8e1;border-color:#e6c200}.note{font-size:13px;color:#666}
td{padding:4px 12px 4px 0;vertical-align:top}input{font-size:16px;padding:8px;width:70%}button{font-size:16px;padding:8px 12px}</style></head>
<body><h1>HoneyChain</h1>${body}
<p class="note">This page shows the records saved for this batch. It does not test the honey and is not a guarantee of quality or purity.</p>
</body></html>`;

const checkForm = (id, message = "") => `
  <div class="card"><h3>Check this jar's code</h3>${message}
  <form method="post" action="/check/${encodeURIComponent(id)}">
    <input name="secret" placeholder="Code under the seal" autocomplete="off">
    <button type="submit">Check</button>
  </form></div>`;

const wrap = (fn) => (req, res) => fn(req, res).catch((e) => {
  console.error(e);
  res.status(500).send(page(`<div class="card warn"><p>Could not read the records right now.</p></div>`));
});

app.get("/api/batch/:id", wrap(async (req, res) => {
  const d = await readBatch(req.params.id);
  d ? res.json(d) : res.status(404).json({ error: "Batch not found" });
}));

app.get("/verify/:id", wrap(async (req, res) => {
  const d = await readBatch(req.params.id);
  if (!d) {
    return res.send(page(`<div class="card warn"><p>No record for <b>${esc(req.params.id)}</b> was found. This does not tell us what is in the jar.</p></div>`));
  }

  const lab = d.lab
    ? `<p>A lab report for this batch was recorded by address <b>${esc(d.lab.address.slice(0, 10))}...</b> on ${day(d.lab.recordedAt)}.
       Result recorded: <b>${d.lab.passed ? "passed" : "did not pass"}</b>. Please check the report itself.</p>
       <p class="note">Report fingerprint: ${esc(d.lab.reportHash.slice(0, 18))}...</p>`
    : `<p>No lab report has been recorded for this batch.</p>`;

  const health = d.health
    ? `<p>Hive condition recorded: <b>${esc(d.health.condition)}</b> (${d.health.confidencePct}% model confidence).
       Estimated daily gain: ${d.health.gainGrams} g/day.</p>
       <p class="note">Recorded ${day(d.health.recordedAt)}. Prototype estimate from a model trained on simulated data. It describes the hive, not the honey.</p>`
    : `<p>No hive condition has been recorded for this batch.</p>`;

  const jars = d.jarCount > 0
    ? `<p>Jar codes registered for this batch: ${d.jarCount}. Codes used so far: ${d.claimedCount}.</p>`
    : `<p>No jar codes have been registered for this batch.</p>`;

  res.send(page(`
    <div class="card"><h3>Batch record</h3><table>
      <tr><td>Batch ID</td><td><b>${esc(d.batchId)}</b></td></tr>
      <tr><td>Beekeeper</td><td>${esc(d.beekeeper)}</td></tr>
      <tr><td>Hive</td><td>${esc(d.hiveId)}</td></tr>
      <tr><td>Location</td><td>${esc(d.location)}</td></tr>
      <tr><td>Harvest date</td><td>${day(d.harvestDate)}</td></tr>
      <tr><td>Quantity</td><td>${d.quantity}</td></tr>
      <tr><td>Status</td><td>${esc(d.status)}</td></tr></table></div>
    <div class="card ${d.lab && d.lab.passed ? "" : "warn"}"><h3>Lab report</h3>${lab}</div>
    <div class="card"><h3>Hive condition</h3>${health}</div>
    <div class="card"><h3>Jar codes</h3>${jars}</div>
    ${checkForm(d.batchId)}`));
}));

app.post("/check/:id", wrap(async (req, res) => {
  const id = req.params.id;
  const d = await readBatch(id);
  if (!d) {
    return res.send(page(`<div class="card warn"><p>No record for <b>${esc(id)}</b> was found.</p></div>`));
  }
  const secret = String(req.body.secret || "").trim().toUpperCase();
  const back = `<p><a href="/verify/${encodeURIComponent(id)}">Back to the batch record</a></p>`;
  if (!secret) {
    return res.send(page(checkForm(id, `<p class="note">Please type the code.</p>`)));
  }

  let [registered, claimed, claimedAt, codeBatch] = await contract.getJarStatus(secret);

  if (!registered) {
    return res.send(page(`<div class="card warn"><h3>Code not found</h3>
      <p>This code was not found in our records. This does not tell us what is in the jar.</p></div>${back}`));
  }
  if (codeBatch !== id) {
    return res.send(page(`<div class="card warn"><h3>Code belongs to another batch</h3>
      <p>This code is registered to batch <b>${esc(codeBatch)}</b>, not <b>${esc(id)}</b>. Please be cautious.</p></div>${back}`));
  }

  if (!claimed) {
    try {
      const relayer = await provider.getSigner(6);   // a spare test account that pays for the claim
      await (await contract.connect(relayer).claimJar(secret)).wait();
      return res.send(page(`<div class="card"><h3>First use of this code</h3>
        <p>This is the first time this jar's code has been used. This does not confirm the contents of the jar.</p></div>${back}`));
    } catch (e) {
      // someone else may have claimed it a moment ago, so look again
      [registered, claimed, claimedAt] = await contract.getJarStatus(secret);
      if (!claimed) throw e;
    }
  }

  res.send(page(`<div class="card warn"><h3>Code already used</h3>
    <p>Our records show this jar's code was already used on ${day(claimedAt)}. If that wasn't you, this jar may have been opened or its code copied. Please be cautious.</p></div>${back}`));
}));

app.get("/qr/:id", wrap(async (req, res) => {
  if (!(await readBatch(req.params.id))) return res.status(404).send("Batch not found");
  res.type("png").send(await QRCode.toBuffer(`${PUBLIC_URL}/verify/${encodeURIComponent(req.params.id)}`));
}));

app.listen(8000, "0.0.0.0", () => console.log("Records server on http://0.0.0.0:8000"));