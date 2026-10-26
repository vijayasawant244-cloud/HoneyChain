const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { ethers } = require("ethers");
const { provider, contract } = require("./common");

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";   // no I, O, 0 or 1, which are easy to confuse

function makeSecret() {
  let s = "";
  for (let i = 0; i < 12; i++) {
    s += ALPHABET[crypto.randomInt(ALPHABET.length)];
    if (i % 4 === 3 && i < 11) s += "-";
  }
  return s;
}

async function main() {
  const batchId = process.argv[2] || "HC100";
  const count = Number(process.argv[3] || 5);
  const file = path.join(__dirname, `jar-codes-${batchId}.csv`);

  if (fs.existsSync(file)) {
    console.log(`${file} already exists. If you restarted the node, delete that file first, because its codes no longer exist on the chain.`);
    process.exit(1);
  }

  const beekeeper = await provider.getSigner(1);   // must be the account that created the batch (bridge.js uses account 1)
  const secrets = Array.from({ length: count }, makeSecret);
  const hashes = secrets.map((s) => ethers.keccak256(ethers.toUtf8Bytes(s)));

  await (await contract.connect(beekeeper).registerJars(batchId, hashes)).wait();
  fs.writeFileSync(file, "jar_number,secret_code\n" + secrets.map((s, i) => `${i + 1},${s}`).join("\n") + "\n");
  console.log(`Registered ${count} jar codes for ${batchId}. Secrets saved to ${file}`);
}

main().catch((e) => { console.error(e); process.exit(1); });